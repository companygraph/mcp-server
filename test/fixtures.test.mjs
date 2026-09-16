import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixtureRoot, instanceRoot, INSTANCE_COMMIT } from "./helpers.mjs";

test("the fixtures hold the example and the core at the pinned tag", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const tag = pkg.dependencies["companygraph-meta-model"].split("#")[1];
  assert.equal(fs.readFileSync(path.join(fixtureRoot, ".ref"), "utf8").trim(), tag);
  assert.ok(fs.existsSync(path.join(fixtureRoot, "example/model/identity.md")));
  assert.ok(fs.existsSync(path.join(fixtureRoot, "core/manifest.json")));
});

test("the fixtures hold the reference instance at the named commit", () => {
  assert.equal(fs.readFileSync(path.join(instanceRoot, ".ref"), "utf8").trim(), INSTANCE_COMMIT);
  assert.ok(fs.existsSync(path.join(instanceRoot, "model/identity.md")));
  assert.ok(fs.existsSync(path.join(instanceRoot, "meta/core/manifest.json")));
});
