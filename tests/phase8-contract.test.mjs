import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Phase 8 collaboration and launch-gate contract wired end to end", async () => {
  const [launch, engine, client, models, provision, courses, load, packageJson, page] = await Promise.all([
    readFile(new URL("../components/operations/launch-scale-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../functions/learning-engine/src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/learning-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/models.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/provision.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/appwrite/courses.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/appwrite/load-launch.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const table of ["course_invites", "launch_cohorts", "cohort_memberships", "security_events"]) assert.match(provision, new RegExp(`id: "${table}"`));
  for (const action of ["create_course_invite", "accept_course_invite", "create_launch_cohort", "join_launch_cohort", "run_launch_review"]) {
    assert.match(engine, new RegExp(action));
    assert.match(client, new RegExp(action));
  }
  assert.match(engine, /createHash/);
  assert.match(engine, /refreshCourseAccess/);
  assert.match(engine, /auditSecurityEvent/);
  assert.match(engine, /publicLaunchReady/);
  assert.match(models, /LaunchReview/);
  assert.match(courses, /listAccessibleCourses/);
  assert.match(launch, /Private course invitations/);
  assert.match(launch, /Founding learner access/);
  assert.match(launch, /Run launch review/);
  assert.match(launch, /Public access is never enabled by a preference toggle/);
  assert.match(load, /LAUNCH_LOAD_CONCURRENCY/);
  assert.match(packageJson, /appwrite:load-launch/);
  assert.match(page, /Phase 9 · Providers gated/);
});
