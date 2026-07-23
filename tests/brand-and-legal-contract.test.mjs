import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships Cognora brand assets and public Google verification pages", async () => {
  const [layout, manifest, home, auth, privacy, terms] = await Promise.all([
    read("app/layout.tsx"),
    read("app/manifest.ts"),
    read("app/page.tsx"),
    read("components/auth/auth-screen.tsx"),
    read("app/privacy/page.tsx"),
    read("app/terms/page.tsx"),
  ]);

  assert.match(layout, /cognora-favicon-32\.png/);
  assert.match(layout, /cognora-favicon-64\.png/);
  assert.match(manifest, /cognora-logo-google\.png/);
  assert.match(auth, /href="\/privacy"/);
  assert.match(auth, /href="\/terms"/);
  assert.match(home, /Public legal information/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/terms"/);
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
