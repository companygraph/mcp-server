import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixtureRoot, instanceRoot, INSTANCE_COMMIT } from "./helpers.mjs";
import { pinOf, PARSER } from "../lib/pin.mjs";

test("the fixtures hold the example and the core at the pinned tag", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const { tag } = pinOf(pkg, PARSER);
  assert.equal(fs.readFileSync(path.join(fixtureRoot, ".ref"), "utf8").trim(), tag);
  assert.ok(fs.existsSync(path.join(fixtureRoot, "example/model/identity.md")));
  assert.ok(fs.existsSync(path.join(fixtureRoot, "core/manifest.json")));
});

test("the fixtures hold the reference instance at the named commit", () => {
  assert.equal(fs.readFileSync(path.join(instanceRoot, ".ref"), "utf8").trim(), INSTANCE_COMMIT);
  assert.ok(fs.existsSync(path.join(instanceRoot, "model/identity.md")));
  assert.ok(fs.existsSync(path.join(instanceRoot, "meta/core/manifest.json")));
});

// The lockfile keeps the old commit unless the package is installed by name (2026-09-17): an
// edit to package.json's pin with no `npm install <name>@...` leaves node_modules and
// package-lock.json naming the superseded release while package.json names the new one. The
// installed package's own version is the one thing the tag cannot lie about, and the lockfile's
// own record of it is held to the same version, so a stale lockfile fails here rather than only
// showing up as a schema mismatch three tests later.
test("the parser installed, and the one package-lock.json records, are the release package.json pins", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const { name, spec, tag } = pinOf(pkg, PARSER);
  // From npm, by an exact version and nothing a range could move, because a package a consumer
  // outside the family installs refuses a dependency from git.
  assert.equal(name, "@companygraph/meta-model");
  assert.match(spec, /^\d+\.\d+\.\d+$/);
  const installed = JSON.parse(fs.readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8"));
  assert.equal("v" + installed.version, tag);
  const lock = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(lock.packages[""].dependencies[name], spec);
  const entry = lock.packages[`node_modules/${name}`];
  assert.equal(entry.version, installed.version);
  assert.equal(entry.resolved, `https://registry.npmjs.org/${name}/-/meta-model-${installed.version}.tgz`);
  assert.match(entry.integrity, /^sha512-/);
});
