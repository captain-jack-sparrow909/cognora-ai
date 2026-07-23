import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Phase 6 beta growth contract wired end to end", async () => {
  const [page, manifest, worker, beta, analytics, engine, provision] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../components/operations/beta-growth-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/product-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../functions/learning-engine/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/provision.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /PwaInstallButton/);
  assert.match(page, /trackProductEvent/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /script.*style.*font.*image/);
  assert.match(beta, /text\/calendar/);
  assert.match(beta, /calendar\.google\.com/);
  assert.doesNotMatch(beta, /outlook\.live\.com/);
  assert.match(beta, /create_google_calendar_authorization/);
  assert.match(beta, /sync_google_calendar/);
  assert.match(beta, /analyticsEnabled/);
  assert.match(analytics, /allowedEvents/);
  assert.doesNotMatch(analytics, /courseId|materialId|question|answer|content/);
  assert.match(engine, /knowledge_chunks/);
  assert.match(engine, /Query\.search\("content", message\)/);
  assert.match(engine, /Retrieved source passages/);
  for (const table of ["knowledge_chunks", "beta_profiles", "analytics_events", "product_feedback", "calendar_oauth_states", "calendar_credentials", "calendar_event_links"]) {
    assert.match(provision, new RegExp(`id: "${table}"`));
  }
  assert.match(provision, /TablesDBIndexType\.Fulltext/);
});
