// The tests this package ships for a deployment's suite, run here as a deployment runs them:
// from a directory holding its pins and its snapshot. They shipped unrun by this suite before,
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
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// A deployment as the shared tests see it: its model pin, its snapshot, its server pin in the
// three places the pin test reads, and a node_modules in which this package is installed under
// its own name. The package is linked to this checkout rather than fetched, so what runs is the
// code on this branch; every other package is linked one by one, because a single link to this
// checkout's node_modules would hold no entry for this package itself.
function deployment({ commit, tag, register }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-"));
  fs.writeFileSync(path.join(dir, "source.json"), JSON.stringify({ repo: "companygraph/meta-model", commit }));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { "companygraph-mcp-server": `github:companygraph/mcp-server#${tag}` } }));
  fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".github", "workflows", "deployment.yml"), `jobs:\n  deploy:\n    uses: companygraph/mcp-server/.github/workflows/deployment.yml@${tag}\n`);
  fs.mkdirSync(path.join(dir, "infra"));
  fs.writeFileSync(path.join(dir, "infra", "main.tf"), `module "mcp" {\n  source = "github.com/companygraph/mcp-server//deploy/terraform?ref=${tag}"\n}\n`);
  fs.mkdirSync(path.join(dir, "dist"));
  fs.writeFileSync(path.join(dir, "dist", "snapshot.json"), JSON.stringify(exampleSnapshot()));
  fs.mkdirSync(path.join(dir, "node_modules"));
  for (const name of fs.readdirSync(path.join(root, "node_modules"))) {
    if (name.startsWith(".")) continue;
    fs.symlinkSync(path.join(root, "node_modules", name), path.join(dir, "node_modules", name), "dir");
  }
  fs.symlinkSync(root, path.join(dir, "node_modules", "companygraph-mcp-server"), "dir");
  const shared = pathToFileURL(path.join(root, "deploy", "test", register.file)).href;
  fs.writeFileSync(path.join(dir, "shared.test.mjs"), `import { ${register.fn} } from ${JSON.stringify(shared)};\n${register.fn}();\n`);
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

const TOOLS = { file: "tools.mjs", fn: "registerToolsTests" };
const PIN = { file: "pin.mjs", fn: "registerPinTests" };
const OWN = `v${pkg.version}`;

test("the shared tools tests pass over a snapshot that is its pin", () => {
  const r = deployment({ commit: COMMIT, tag: OWN, register: TOOLS });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /every tool the server lists answers inside its schema/);
});

test("and fail over one that is not, so a pass above means something", () => {
  const r = deployment({ commit: "f".repeat(40), tag: OWN, register: TOOLS });
  assert.notEqual(r.status, 0);
});

// The pin tests hold a deployment's release in every place it is named to the package that is
// installed, and to the page and the health body that package serves. Run over a fixture
// that pins this checkout's own version, they pass; over one that pins another, every one of
// them fails, the served page and the health body among them.
test("the shared pin tests pass over a deployment that pins this release everywhere", () => {
  const r = deployment({ commit: COMMIT, tag: OWN, register: PIN });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /✔ the served page and the health body name the release package\.json pins/);
});

test("and fail over one that pins another release, so the served page is held to the pin", () => {
  const r = deployment({ commit: COMMIT, tag: "v0.0.1", register: PIN });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /✖ the served page and the health body name the release package\.json pins/);
});
