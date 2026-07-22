import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Phase 9 provider activation and billing contract wired end to end", async () => {
  const [activation, engine, webhook, client, models, provision, deploy, billingDeploy, environment, page] = await Promise.all([
    readFile(new URL("../components/operations/provider-activation-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../functions/learning-engine/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/billing-webhook/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/learning-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/models.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/provision.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/deploy-learning-engine.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/deploy-billing-webhook.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const table of ["provider_activations", "subscriptions", "billing_events", "launch_approvals"]) assert.match(provision, new RegExp(`id: "${table}"`));
  for (const action of ["get_provider_activation_snapshot", "verify_provider_activations", "backfill_embeddings", "create_billing_checkout", "create_final_launch_approval"]) {
    assert.match(engine, new RegExp(action));
    assert.match(client, new RegExp(action));
  }
  assert.match(engine, /Cognora provider readiness check/);
  assert.match(engine, /Stripe account verification failed/);
  assert.match(engine, /publicLaunchReady/);
  assert.match(webhook, /verifyStripeSignature/);
  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /billing_events/);
  assert.match(webhook, /subscriptions/);
  assert.match(webhook, /entitlements/);
  assert.match(deploy, /ProvidersRead/);
  assert.match(billingDeploy, /Role\.any\(\)/);
  assert.match(environment, /STRIPE_WEBHOOK_SECRET/);
  assert.match(environment, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(environment, /MICROSOFT_CLIENT_SECRET/);
  assert.doesNotMatch(models, /microsoft-calendar/);
  assert.match(models, /ProviderActivationSnapshot/);
  assert.match(activation, /External systems must prove they are ready/);
  assert.match(activation, /Opening access is a separate explicit action/);
  assert.match(page, /Phase 9 · Providers gated/);
});
