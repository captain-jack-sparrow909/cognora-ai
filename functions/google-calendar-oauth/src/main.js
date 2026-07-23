import { createCipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Client, Permission, Role, TablesDB } from "node-appwrite";

function queryValue(req, name) {
  if (typeof req.query?.[name] === "string") return req.query[name];
  try { return new URL(req.url).searchParams.get(name) || ""; }
  catch { return ""; }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function matches(left, right) {
  try { return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex")); }
  catch { return false; }
}

function encryptionKey() {
  const key = Buffer.from(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || "", "hex");
  if (key.length !== 32) throw new Error("Calendar token encryption key must contain 32 bytes.");
  return key;
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function redirect(res, outcome) {
  const base = String(process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  return res.redirect(`${base}/?calendar=${encodeURIComponent(outcome)}`, 302);
}

export default async function main({ req, res, error }) {
  try {
    const code = queryValue(req, "code");
    const state = queryValue(req, "state");
    const oauthError = queryValue(req, "error");
    if (oauthError) return redirect(res, "denied");
    if (!code || !state.includes(".")) return redirect(res, "invalid");

    const [stateId, secret] = state.split(".", 2);
    const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT;
    const client = new Client().setEndpoint(endpoint).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(process.env.APPWRITE_FUNCTION_API_KEY);
    const tables = new TablesDB(client);
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const savedState = await tables.getRow({ databaseId, tableId: "calendar_oauth_states", rowId: stateId });
    if (new Date(savedState.expiresAt).getTime() < Date.now() || !matches(savedState.stateHash, hash(secret))) return redirect(res, "expired");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error_description || token.error || `Google token exchange failed (${tokenResponse.status}).`);

    let existing;
    try { existing = await tables.getRow({ databaseId, tableId: "calendar_credentials", rowId: savedState.ownerId }); }
    catch (caught) { if (caught?.code !== 404) throw caught; }
    const refreshTokenEncrypted = token.refresh_token ? encrypt(token.refresh_token) : existing?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) throw new Error("Google did not return a refresh token. Revoke the existing grant and reconnect.");
    const now = new Date().toISOString();
    await tables.upsertRow({
      databaseId,
      tableId: "calendar_credentials",
      rowId: savedState.ownerId,
      data: {
        ownerId: savedState.ownerId,
        provider: "google",
        accessTokenEncrypted: token.access_token ? encrypt(token.access_token) : undefined,
        refreshTokenEncrypted,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : undefined,
        scope: String(token.scope || "https://www.googleapis.com/auth/calendar.events"),
        updatedAt: now,
      },
      permissions: [],
    });
    await tables.upsertRow({
      databaseId,
      tableId: "calendar_connections",
      rowId: `${savedState.ownerId}-google`,
      data: { ownerId: savedState.ownerId, provider: "google", status: "connected", syncMode: "two-way", conflictPolicy: "ask", updatedAt: now },
      permissions: [Permission.read(Role.user(savedState.ownerId)), Permission.update(Role.user(savedState.ownerId)), Permission.delete(Role.user(savedState.ownerId))],
    });
    await tables.deleteRow({ databaseId, tableId: "calendar_oauth_states", rowId: stateId });
    return redirect(res, "connected");
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return redirect(res, "error");
  }
}
