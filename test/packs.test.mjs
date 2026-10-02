// An instance that takes a pack (meta-model 0.68.0) is served in full: the pack's schemas are
// read beside the core from wherever the instance's manifest says, so its pages parse instead of
// meeting R13, and its types are listed, described, diagrammed and linked to their own files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readDir, readSchemas, readGitHubSchemas } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";
import { listTypes, describeSchema, describeRelations, getEntityById } from "../lib/model.mjs";
import { diagram } from "../lib/diagram.mjs";
import { fixtureRoot, packInstanceDir, CONTEXT_ID, COMMIT, PARSER, exampleSnapshot } from "./helpers.mjs";

const PACK_TYPES = ["aggregate", "bounded-context", "concept-design", "domain-event", "feature-design"];
const REPO = "companygraph/pack-instance";
const root = packInstanceDir();
const snapshotOf = (dir) => buildSnapshot({ files: readDir(path.join(dir, "model")), schemas: readSchemas(path.join(dir, "meta", "core")),
  sub: "model/", core: "meta/core/", commit: COMMIT, repo: REPO, parserTag: PARSER });

test("a core read without its packs leaves a pack's page to R13, which is what the reader is for", () => {
  assert.throws(() => buildSnapshot({ files: readDir(path.join(root, "model")), schemas: readDir(path.join(root, "meta", "core")), sub: "model/" }), /R13/);
});

test("the schemas of a core whose instance takes a pack carry the pack's files under the pack's name", () => {
  const schemas = readSchemas(path.join(root, "meta", "core"));
  for (const t of PACK_TYPES) assert.ok(schemas.has(`software/${t}-schema.md`), t);
  assert.ok(schemas.has("manifest.json") && schemas.has("CONVENTIONS.md"), "core's files keep their bare keys");
  assert.ok(![...schemas.keys()].some((k) => k.startsWith("core/")));
});

test("a core with no instance around it, or one that takes no pack, is read exactly as before", () => {
  const bare = path.join(fixtureRoot, "core");
  assert.deepEqual(readSchemas(bare), readDir(bare));
  const plain = packInstanceDir({ packs: [] });
  assert.deepEqual(readSchemas(path.join(plain, "meta", "core")), readDir(path.join(plain, "meta", "core")));
  const s = buildSnapshot({ files: readDir(path.join(fixtureRoot, "example", "model")), schemas: readSchemas(bare), sub: "example/model/", core: "core/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  assert.deepEqual(s, exampleSnapshot());
});

test("a pack the manifest names that is not there is an error naming it, never a silent core-only read", () => {
  const broken = packInstanceDir();
  fs.rmSync(path.join(broken, "meta", "software"), { recursive: true });
  assert.throws(() => readSchemas(path.join(broken, "meta", "core")), /software/);
});

test("the snapshot holds the pack's schemas addressed by the pack, and the context's page", () => {
  const s = snapshotOf(root);
  for (const t of PACK_TYPES) assert.ok(s.schemas.some((x) => x.address === `software/${t}`), t);
  const context = s.entities.find((e) => e.id === CONTEXT_ID);
  assert.equal(context.type, "bounded-context");
  assert.equal(context.path, "model/bounded-contexts/quoting/quoting.md");
});

test("list_types and describe_schema answer for a pack's type, and its link is the pack's own file", () => {
  const s = snapshotOf(root);
  const listed = listTypes(s).types.find((x) => x.type === "bounded-context");
  assert.equal(listed.count, 1);
  assert.equal(listed.name, "Bounded Context Schema");
  const d = describeSchema(s, "bounded-context");
  assert.equal(d.type, "bounded-context");
  assert.equal(d.url, `https://github.com/${REPO}/blob/${COMMIT}/meta/software/bounded-context-schema.md`);
  assert.equal(describeSchema(s, "domain").url, `https://github.com/${REPO}/blob/${COMMIT}/meta/core/domain-schema.md`);
  assert.ok(d.relations.references.some((x) => x.via === "realizes" && x.to === "domain"), JSON.stringify(d.relations.references));
});

test("get_entity returns the bounded context, and the relations name the pack's types", () => {
  const s = snapshotOf(root);
  const e = getEntityById(s, CONTEXT_ID).entity;
  assert.equal(e.name, "Quoting");
  assert.equal(e.url, `https://github.com/${REPO}/blob/${COMMIT}/model/bounded-contexts/quoting/quoting.md`);
  const r = describeRelations(s);
  assert.ok(r.ownership.some((x) => x.owned === "aggregate" && x.owner === "bounded-context"), JSON.stringify(r.ownership));
});

test("the schema diagram draws a pack's type under its own address and links its own file", () => {
  const s = snapshotOf(root);
  const d = diagram(s, { shape: "schema", type: "bounded-context" });
  const node = d.nodes.find((n) => n.title === "bounded-context");
  assert.equal(node.id, "software/bounded-context");
  assert.equal(node.url, `https://github.com/${REPO}/blob/${COMMIT}/meta/software/bounded-context-schema.md`);
  assert.equal(d.nodes.find((n) => n.title === "domain").id, "core/domain");
});

test("the snapshot command reads the packs from two local directories without a new argument", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "snap-")), "snapshot.json");
  execFileSync("node", [new URL("../bin/snapshot.mjs", import.meta.url).pathname, path.join(root, "model"), path.join(root, "meta", "core"),
    "--commit", COMMIT, "--repo", REPO, "--core", "meta/core/", "--out", out], { encoding: "utf8" });
  const s = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.ok(s.entities.some((e) => e.id === CONTEXT_ID));
  assert.ok(s.schemas.some((x) => x.address === "software/bounded-context"));
});

// The deploy build reads a pinned commit from GitHub: one listing of the tree, the manifest, the
// core and each pack it names, every file fetched once.
const fakeGitHub = (files) => {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (url.includes("/git/trees/")) return { ok: true, json: async () => ({ truncated: false, tree: [
      { type: "tree", path: "meta" },
      ...Object.keys(files).map((p) => ({ type: "blob", path: p })),
    ] }) };
    const p = url.split(`/${COMMIT}/`)[1];
    if (!(p in files)) return { ok: false, status: 404 };
    return { ok: true, text: async () => files[p] };
  };
  return { fetch, calls };
};

test("readGitHubSchemas reads the core and each pack the commit's manifest names, listing the tree once", async () => {
  const { fetch, calls } = fakeGitHub({
    ".companygraph/manifest.json": JSON.stringify({ packs: ["software"] }),
    "meta/core/manifest.json": "{}", "meta/core/domain-schema.md": "core domain",
    "meta/software/manifest.json": "{}", "meta/software/aggregate-schema.md": "pack aggregate",
    "meta/other/x-schema.md": "a unit the instance did not take", "model/identity.md": "a page",
  });
  const schemas = await readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "meta/core/", fetch });
  assert.deepEqual([...schemas.keys()], ["domain-schema.md", "manifest.json", "software/aggregate-schema.md", "software/manifest.json"]);
  assert.equal(schemas.get("software/aggregate-schema.md"), "pack aggregate");
  assert.equal(calls.filter((u) => u.includes("/git/trees/")).length, 1);
});

test("readGitHubSchemas reads the core alone where the commit has no manifest or takes no pack", async () => {
  for (const manifest of [undefined, JSON.stringify({})]) {
    const { fetch } = fakeGitHub({ ...(manifest ? { ".companygraph/manifest.json": manifest } : {}),
      "meta/core/manifest.json": "{}", "meta/core/domain-schema.md": "core domain", "meta/software/aggregate-schema.md": "pack aggregate" });
    const schemas = await readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "meta/core", fetch });
    assert.deepEqual([...schemas.keys()], ["domain-schema.md", "manifest.json"]);
  }
});

test("readGitHubSchemas follows the manifest's units, and refuses a pack that is not in the commit", async () => {
  const { fetch } = fakeGitHub({ ".companygraph/manifest.json": JSON.stringify({ units: "vocab", packs: ["software"] }),
    "vocab/core/manifest.json": "{}", "vocab/software/aggregate-schema.md": "pack aggregate" });
  const schemas = await readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "vocab/core/", fetch });
  assert.deepEqual([...schemas.keys()], ["manifest.json", "software/aggregate-schema.md"]);
  const missing = fakeGitHub({ ".companygraph/manifest.json": JSON.stringify({ packs: ["software"] }), "meta/core/manifest.json": "{}" });
  await assert.rejects(readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "meta/core/", fetch: missing.fetch }), /software/);
});

// A manifest that is not JSON, or whose `packs` is not a list of names, is refused by a sentence
// naming the manifest, never a bare SyntaxError and never a string read one letter at a time.
test("a malformed manifest, or a packs field that is not a list of names, is refused naming the manifest", async () => {
  const local = packInstanceDir();
  const manifest = path.join(local, ".companygraph", "manifest.json");
  for (const [text, said] of [["{ not json", /manifest\.json.*not JSON/], [JSON.stringify({ packs: "software" }), /manifest\.json.*packs/], [JSON.stringify({ packs: [1] }), /manifest\.json.*packs/]]) {
    fs.writeFileSync(manifest, text);
    assert.throws(() => readSchemas(path.join(local, "meta", "core")), (err) => !(err instanceof SyntaxError) && said.test(err.message) && err.message.includes(manifest));
    const { fetch } = fakeGitHub({ ".companygraph/manifest.json": text, "meta/core/manifest.json": "{}", "meta/software/aggregate-schema.md": "pack aggregate" });
    await assert.rejects(readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "meta/core/", fetch }),
      (err) => !(err instanceof SyntaxError) && said.test(err.message) && err.message.includes(`o/r@${COMMIT}:.companygraph/manifest.json`));
  }
});

test("readGitHubSchemas reads the core alone where the core read is not the manifest's units core", async () => {
  const { fetch } = fakeGitHub({ ".companygraph/manifest.json": JSON.stringify({ packs: ["software"] }),
    "elsewhere/core/manifest.json": "{}", "meta/software/aggregate-schema.md": "pack aggregate" });
  const schemas = await readGitHubSchemas({ repo: "o/r", commit: COMMIT, core: "elsewhere/core", fetch });
  assert.deepEqual([...schemas.keys()], ["manifest.json"]);
});
