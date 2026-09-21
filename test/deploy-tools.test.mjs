// The tests this package ships for a deployment's suite, run here as a deployment runs them:
// from a directory holding its pin and its snapshot. They shipped unrun by this suite before,
// so a change to a tool's arguments could break every deployment and pass here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function deployment(commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-"));
  fs.writeFileSync(path.join(dir, "source.json"), JSON.stringify({ repo: "companygraph/meta-model", commit }));
  fs.mkdirSync(path.join(dir, "dist"));
  fs.writeFileSync(path.join(dir, "dist", "snapshot.json"), JSON.stringify(exampleSnapshot()));
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  const shared = pathToFileURL(path.join(root, "deploy", "test", "tools.mjs")).href;
  fs.writeFileSync(path.join(dir, "shared.test.mjs"), `import { registerToolsTests } from ${JSON.stringify(shared)};\nregisterToolsTests();\n`);
  // This file already runs under `node --test`, which marks its own environment so a nested
  // `--test` run recognizes it and steps aside; without stripping that mark, the child below
  // would see it too and skip its file rather than run it, and this test would read an empty
  // pass instead of the deployment's own suite.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  const r = spawnSync(process.execPath, ["--test", "shared.test.mjs"], { cwd: dir, encoding: "utf8", env });
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

test("the shared tools tests pass over a snapshot that is its pin", () => {
  const r = deployment(COMMIT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /every tool the server lists answers inside its schema/);
});

test("and fail over one that is not, so a pass above means something", () => {
  const r = deployment("f".repeat(40));
  assert.notEqual(r.status, 0);
});
