import { createHmac, timingSafeEqual } from "node:crypto";
import { Client, ID, Permission, Query, Role, TablesDB } from "node-appwrite";

function header(headers, name) {
  const key = Object.keys(headers || {}).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : "";
}

function rawRequestBody(req) {
  if (typeof req.bodyText === "string") return req.bodyText;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body || {});
}

function verifyStripeSignature(rawBody, signature, secret) {
  const parts = String(signature).split(",").map((part) => part.split("=")).filter((part) => part.length === 2);
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((candidate) => {
    try { return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex")); }
    catch { return false; }
  });
}

function subscriptionStatus(value) {
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due" || value === "unpaid") return "past-due";
  if (value === "canceled" || value === "incomplete_expired") return "canceled";
  return "inactive";
}

function unixDate(value) {
  return value ? new Date(Number(value) * 1000).toISOString() : undefined;
}

async function processSubscription(tables, databaseId, object, eventType) {
  const userId = object.metadata?.appwriteUserId || object.client_reference_id || object.subscription_details?.metadata?.appwriteUserId;
  if (!userId) return { status: "ignored", userId: undefined };
  let subscription = object;
  if (eventType === "checkout.session.completed") {
    if (!object.subscription || !process.env.STRIPE_SECRET_KEY) return { status: "ignored", userId };
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(object.subscription)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
    if (!response.ok) throw new Error(`Stripe subscription lookup failed (${response.status}).`);
    subscription = await response.json();
  }
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = priceId && priceId === process.env.STRIPE_PRICE_EDUCATION ? "education" : "pro";
  await tables.upsertRow({
    databaseId,
    tableId: "subscriptions",
    rowId: userId,
    data: {
      ownerId: userId,
      provider: "stripe",
      plan,
      status: subscriptionStatus(subscription.status),
      externalCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      externalSubscriptionId: subscription.id,
      priceId,
      currentPeriodEnd: unixDate(subscription.current_period_end),
      updatedAt: new Date().toISOString(),
    },
    permissions: [Permission.read(Role.user(userId))],
  });
  const entitlements = { pro: { aiDailyLimit: 200, storageLimitMb: 10_240, collaborationSeats: 10 }, education: { aiDailyLimit: 500, storageLimitMb: 51_200, collaborationSeats: 100 } };
  const limits = entitlements[plan];
  await tables.upsertRow({ databaseId, tableId: "entitlements", rowId: userId, data: { ownerId: userId, plan, status: ["active", "trialing"].includes(subscriptionStatus(subscription.status)) ? "active" : "paused", ...limits, updatedAt: new Date().toISOString() }, permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))] });
  return { status: "processed", userId };
}

export default async function main({ req, res, error }) {
  try {
    if (req.method !== "POST") return res.json({ ok: true, function: "billing-webhook" }, 200);
    if (!process.env.STRIPE_WEBHOOK_SECRET) return res.json({ ok: false, error: "Billing webhook is not configured." }, 503);
    const rawBody = rawRequestBody(req);
    if (!verifyStripeSignature(rawBody, header(req.headers, "stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) return res.json({ ok: false, error: "Invalid webhook signature." }, 401);
    const event = JSON.parse(rawBody);
    const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT;
    const client = new Client().setEndpoint(endpoint).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(process.env.APPWRITE_FUNCTION_API_KEY);
    const tables = new TablesDB(client);
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const existing = await tables.listRows({ databaseId, tableId: "billing_events", queries: [Query.equal("eventId", [String(event.id)]), Query.limit(1)] });
    if (existing.rows.length) return res.json({ ok: true, duplicate: true }, 200);
    const supported = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
    const result = supported.includes(event.type) ? await processSubscription(tables, databaseId, event.data?.object || {}, event.type) : { status: "ignored", userId: undefined };
    await tables.createRow({ databaseId, tableId: "billing_events", rowId: ID.unique(), data: { eventId: String(event.id).slice(0, 128), eventType: String(event.type).slice(0, 128), status: result.status, userId: result.userId, metadataJson: JSON.stringify({ livemode: Boolean(event.livemode), apiVersion: event.api_version || undefined }), createdAt: new Date(Number(event.created || Date.now() / 1000) * 1000).toISOString(), processedAt: new Date().toISOString() }, permissions: [] });
    return res.json({ ok: true, status: result.status }, 200);
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return res.json({ ok: false, error: "Billing event processing failed." }, 400);
  }
}
