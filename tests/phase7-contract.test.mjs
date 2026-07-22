import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Phase 7 launch and scale contract wired end to end", async () => {
  const [launch, engine, client, models, provision, deploy, environment, page] = await Promise.all([
    readFile(new URL("../components/operations/launch-scale-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../functions/learning-engine/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/learning-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/models.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/provision.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/deploy-learning-engine.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const table of ["entitlements", "launch_preferences", "calendar_connections", "course_members", "launch_admins"]) {
    assert.match(provision, new RegExp(`id: "${table}"`));
  }
  assert.match(provision, /createPermissions: \[\]/);
  assert.match(provision, /createWebPlatform/);
  assert.match(engine, /embedTexts/);
  assert.match(engine, /cosineSimilarity/);
  assert.match(engine, /embeddingJson/);
  assert.match(engine, /APPWRITE_EMAIL_READY/);
  assert.match(engine, /createEmail/);
  assert.match(engine, /getLaunchSnapshot/);
  assert.match(engine, /claimLaunchAdmin/);
  assert.match(engine, /entitlementRows\.rows\[0\]\?\.aiDailyLimit/);
  assert.match(client, /get_launch_snapshot/);
  assert.match(client, /claim_launch_admin/);
  assert.match(models, /LaunchSnapshot/);
  assert.match(launch, /Truthful readiness/);
  assert.match(launch, /conflictPolicy/);
  assert.match(launch, /Claim launch ownership/);
  assert.match(launch, /No learner content is included/);
  assert.match(deploy, /MessagesWrite/);
  assert.match(deploy, /UsersRead/);
  assert.match(environment, /EMBEDDING_API_KEY/);
  assert.match(environment, /APPWRITE_EMAIL_READY=false/);
  assert.match(page, /Phase 9 · Providers gated/);
});
