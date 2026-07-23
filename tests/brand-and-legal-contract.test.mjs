import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships Cognora brand assets and public Google verification pages", async () => {
  const [layout, manifest, home, workspace, auth, privacy, terms] = await Promise.all([
    read("app/layout.tsx"),
    read("app/manifest.ts"),
    read("app/page.tsx"),
    read("components/application/cognora-app.tsx"),
    read("components/auth/auth-screen.tsx"),
    read("app/privacy/page.tsx"),
    read("app/terms/page.tsx"),
  ]);

  assert.match(layout, /cognora-favicon-32\.png/);
  assert.match(layout, /cognora-favicon-64\.png/);
  assert.match(manifest, /cognora-logo-google\.png/);
  assert.match(auth, /href="\/privacy"/);
  assert.match(auth, /href="\/terms"/);
  assert.match(home, /CognoraAI turns every course into a plan you can actually follow/);
  assert.match(home, /Study Planner/);
  assert.match(home, /Lecture Companion/);
  assert.match(home, /Learning Roadmaps/);
  assert.match(home, /Assignment Feedback/);
  assert.match(home, /Knowledge Gap Detector/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/terms"/);
  assert.match(home, /href="\/app"/);
  assert.match(workspace, /Public legal information/);
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /Limited Use requirements/);
  assert.match(terms, /AI output and academic responsibility/);

  for (const path of [
    "public/brand/cognora-logo-google.png",
    "public/brand/cognora-app-icon-192.png",
    "public/brand/cognora-favicon-64.png",
    "public/brand/cognora-favicon-32.png",
    "public/apple-touch-icon.png",
    "public/og.png",
  ]) {
    const asset = await stat(new URL(`../${path}`, import.meta.url));
    assert.ok(asset.size > 0, `${path} should not be empty`);
  }
});

test("uses the CognoraAI name on the public landing page", async () => {
  const [home, layout, manifest, privacy, terms] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/manifest.ts"),
    read("app/privacy/page.tsx"),
    read("app/terms/page.tsx"),
  ]);

  assert.match(home, /<strong>CognoraAI<\/strong>/);
  assert.doesNotMatch(home, /<strong>Cognora<\/strong>/);
  assert.match(layout, /applicationName: "CognoraAI"/);
  assert.match(manifest, /short_name: "CognoraAI"/);
  assert.doesNotMatch([home, layout, manifest, privacy, terms].join("\n"), /Cognora AI/);
});

test("explains CognoraAI and its Google Calendar data use without requiring login", async () => {
  const home = await read("app/page.tsx");

  assert.match(home, /CognoraAI is an AI-powered learning platform for students/);
  assert.match(home, /Why CognoraAI requests Google Calendar data/);
  assert.match(home, /Google Calendar access is optional/);
  assert.match(home, /create, update, and synchronize/);
  assert.match(home, /Google user data is not used for/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /"@type": "SoftwareApplication"/);
  assert.match(home, /name: "CognoraAI"/);
  assert.match(home, /url: "https:\/\/cognora-ai\.tech\/"/);
});
