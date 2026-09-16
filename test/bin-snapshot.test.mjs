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

test("an operator error is one stderr line and exit 2, never a stack", () => {
  const run = (args) => {
    try {
      execFileSync("node", [bin, ...args], { encoding: "utf8", stdio: "pipe" });
      assert.fail("expected the process to exit non-zero");
    } catch (err) {
      return err;
    }
  };
  const oneLine = (err) => {
    assert.equal(err.status, 2);
    const lines = err.stderr.trim().split("\n");
    assert.equal(lines.length, 1, err.stderr);
    assert.ok(!/^\s*at\s/m.test(err.stderr), err.stderr);
  };
  const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "snap-")), "snapshot.json");

  oneLine(run(["--nope", path.join(fixtureRoot, "example/model"), path.join(fixtureRoot, "core"), "--out", outFile]));
  oneLine(run([path.join(fixtureRoot, "example/model", "nope"), path.join(fixtureRoot, "core"), "--out", outFile]));

  const noManifestCore = fs.mkdtempSync(path.join(os.tmpdir(), "core-"));
  const noManifest = run([path.join(fixtureRoot, "example/model"), noManifestCore, "--out", outFile]);
  oneLine(noManifest);
  assert.match(noManifest.stderr, /manifest\.json/);

  const noAt = run(["--github", "owner/name", "--out", outFile]);
  oneLine(noAt);
  assert.match(noAt.stderr, /--github wants owner\/name@sha/);

  const twoAts = run(["--github", "owner/name@sha@extra", "--out", outFile]);
  oneLine(twoAts);
  assert.match(twoAts.stderr, /--github wants owner\/name@sha/);
});
