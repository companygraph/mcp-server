import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fixtureRoot } from "./helpers.mjs";

const bin = new URL("../bin/snapshot.mjs", import.meta.url).pathname;

test("writes a snapshot from two local directories", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "snap-")), "snapshot.json");
  const stdout = execFileSync("node", [bin, path.join(fixtureRoot, "example/model"), path.join(fixtureRoot, "core"),
    "--commit", "abc123", "--repo", "companygraph/meta-model", "--sub", "example/model/", "--out", out], { encoding: "utf8" });
  const s = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(s.commit, "abc123");
  assert.equal(s.core.version, "0.25.2");
  assert.equal(s.entities.length, 34);
  assert.match(stdout, /34 entities/);
});

test("refuses to run without --out", () => {
  assert.throws(() => execFileSync("node", [bin, "a", "b"], { encoding: "utf8", stdio: "pipe" }), /--out/);
});
