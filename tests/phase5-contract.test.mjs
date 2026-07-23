import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Phase 5 realtime and operations contract wired end to end", async () => {
  const [page, operations, learningClient, engine, provision, styles] = await Promise.all([
    readFile(new URL("../components/application/cognora-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/operations/operations-workspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/learning-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../functions/learning-engine/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/provision.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /skip-link/);
  assert.match(page, /aria-current/);
  assert.match(page, /lazy\(\(\) => import/);
  assert.match(operations, /aria-live="polite"/);
  assert.match(operations, /Channel\.tablesdb/);
  assert.match(learningClient, /table\("ai_jobs"\)/);
  assert.match(learningClient, /cognora:ai-job/);
  assert.match(engine, /AI_DAILY_REQUEST_LIMIT/);
  assert.match(engine, /learning_action_completed/);
  assert.match(engine, /promptTokens/);
  assert.match(provision, /id: "ai_jobs"/);
  assert.match(provision, /id: "notifications"/);
  assert.match(provision, /id: "reminder_preferences"/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /focus-visible/);
});
