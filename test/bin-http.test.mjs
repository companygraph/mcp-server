import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const bin = new URL("../bin/http.mjs", import.meta.url).pathname;

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

  oneLine(run(["--nope"]));
  oneLine(run(["--snapshot", path.join(os.tmpdir(), "does-not-exist.json")]));

  const badJson = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "http-bad-")), "bad.json");
  fs.writeFileSync(badJson, "{not json");
  oneLine(run(["--snapshot", badJson]));
});
