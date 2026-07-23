import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public CognoraAI homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>CognoraAI/);
  assert.match(html, /CognoraAI turns every course into a plan you can actually follow/);
  assert.match(html, /CognoraAI is an AI-powered learning platform for students/);
  assert.match(html, /Why CognoraAI requests Google Calendar data/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /SoftwareApplication/);
  assert.match(html, /Study Planner/);
  assert.match(html, /Knowledge Gap Detector/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the authenticated Cognora workspace at /app", async () => {
  const response = await render("/app");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Connecting your learning workspace/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
});

test("keeps the finished product free of starter preview assets", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../components/application/cognora-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ActivityCenter|SettingsWorkspace|Suspense/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
