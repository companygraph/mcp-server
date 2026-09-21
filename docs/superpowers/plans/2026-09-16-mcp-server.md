# CompanyGraph MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only MCP server package that serves any CompanyGraph instance from a build-time snapshot through seven schema-derived tools, over stdio and stateless Streamable HTTP.

**Architecture:** `lib/read.mjs` turns a directory or a GitHub commit into a map of path → text. `lib/snapshot.mjs` feeds that map to the meta-model's parser and adds provenance and each entity's source Markdown. `lib/model.mjs` answers the seven queries over a snapshot with no I/O. `lib/tools.mjs` and `lib/server.mjs` wrap the queries as MCP tools on an `McpServer`. Three `bin/` entry points: write a snapshot, serve stdio, serve HTTP.

**Tech Stack:** Node 22, plain ESM `.mjs`, `node --test`; `companygraph-meta-model` by git tag for the parser; `@modelcontextprotocol/server` 2.x and `@modelcontextprotocol/node` 2.x; `zod` 4; `@modelcontextprotocol/client` 2.x for tests only.

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-server-design.md`

## Global Constraints

- Node `>=22`, `"type": "module"`, no build step, no TypeScript.
- The parser is imported from `companygraph-meta-model/instance` (`parseInstance`, `parseSchemas`). Never copy or reimplement any part of it.
- No instance-specific type, field, person, company or fact in `lib/` or `bin/`. Core type names (`skill`, `vision`, `identity`) are core's vocabulary and allowed.
- A name resolves within a type (R2). A lookup without a type that finds a name under more than one type refuses and names the types. Never the first match. An unresolvable reference is an error (R4).
- Every tool response carries `model: { commit, repo, core, parser }`.
- Evidence and every other string from the model are returned verbatim. No summary, ranking or added claim.
- HTTP: stateless (`sessionIdGenerator: undefined`), JSON responses (`enableJsonResponse: true`), `Cache-Control: no-store` on every response, `POST /mcp` only.
- Commits and pull request bodies are prose ending `Verified: …`, then the `Co-Authored-By` trailer. Read `conventions/WRITING.md` and `conventions/WORKING.md` before writing one.
- `sh conventions/conventions-check` passes before every commit.
- Work on branch `build`. One pull request at the end; merging is the owner's call.

---

## File structure

| File | Responsibility |
| --- | --- |
| `package.json` | name, version, bins, exports, scripts, pins |
| `scripts/fixtures.mjs` | fetch `companygraph/meta-model` at the pinned tag into `test/fixtures/meta-model/` |
| `lib/read.mjs` | `readDir(root)` and `readGitHub({ repo, commit, sub })` → `Map(path → text)` |
| `lib/snapshot.mjs` | `buildSnapshot(...)` and `parserTag()` |
| `lib/model.mjs` | `ModelError` and the seven queries |
| `lib/tools.mjs` | `registerTools(server, snapshot)` |
| `lib/server.mjs` | `createServer(snapshot, { name, version })` |
| `lib/http.mjs` | `createHttpServer(snapshot, { allowedHosts })` → `node:http` server |
| `bin/snapshot.mjs` | CLI writing a snapshot file |
| `bin/stdio.mjs` | CLI serving a model directory over stdio |
| `bin/http.mjs` | CLI serving a snapshot file over HTTP |
| `test/helpers.mjs` | `exampleSnapshot()`, `fixtureRoot`, `withSharedName()` |
| `test/*.test.mjs` | one file per module |

Parser facts the tests rely on (from running the parser on the example at v0.25.2): 34 entities, 77 edges, root `Beacon Systems` with `rootId` `identity`; ids are folder paths without `.md`, such as `skills/domain-driven-design` and `profiles/mira-halvorsen/experiences/2022-beacon-systems`; a profile's Skills row is an edge `via: "Skills.Skill"` with `attrs: { Level: "proficiency-levels/competent", Evidence: "…" }` where `Level` is already the resolved id; an experience's `skills` list is an edge `via: "skills"` with empty attrs; a role's `requires` is an edge `via: "requires"`. `parseSchemas(core).entities` has 15 entries with ids `core/<type>` and sections `File Location`, `Frontmatter`, `Sections`, `Purpose`, `Writing rules`. `core/manifest.json` is `{ "version": "0.25.2", "shape": 2 }`.

---

### Task 1: Package and fixtures

**Files:**

- Create: `package.json`, `scripts/fixtures.mjs`, `test/fixtures.test.mjs`
- Modify: `.gitignore` (already lists `test/fixtures/`)

**Interfaces:**

- Produces: `test/fixtures/meta-model/` holding `example/model/` and `core/` at the pinned tag, and `test/fixtures/mental-model/` holding the reference instance (`model/`, `meta/core/`) at the commit the script names; `npm test` runs `node --test test/` after `npm run fixtures`.

- [ ] **Step 1: Create the branch and the package**

```bash
git checkout -b build
```

`package.json`:

```json
{
  "name": "companygraph-mcp-server",
  "version": "0.1.0",
  "description": "A read-only MCP server for any CompanyGraph instance",
  "license": "Apache-2.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "files": ["lib", "bin"],
  "bin": {
    "companygraph-mcp": "bin/stdio.mjs",
    "companygraph-mcp-snapshot": "bin/snapshot.mjs",
    "companygraph-mcp-http": "bin/http.mjs"
  },
  "exports": {
    ".": "./lib/server.mjs",
    "./model": "./lib/model.mjs",
    "./snapshot": "./lib/snapshot.mjs",
    "./read": "./lib/read.mjs",
    "./http": "./lib/http.mjs"
  },
  "scripts": {
    "fixtures": "node scripts/fixtures.mjs",
    "pretest": "node scripts/fixtures.mjs",
    "test": "node --test test/"
  },
  "dependencies": {
    "@modelcontextprotocol/node": "^2.0.0",
    "@modelcontextprotocol/server": "^2.0.0",
    "companygraph-meta-model": "github:companygraph/meta-model#v0.25.2",
    "zod": "^4.2.0"
  },
  "devDependencies": {
    "@modelcontextprotocol/client": "^2.0.0"
  }
}
```

Run `npm install` and commit `package-lock.json` with it.

- [ ] **Step 2: Write the failing fixtures test**

`test/fixtures.test.mjs`:

```js
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
```

`test/helpers.mjs` (first version; later tasks add to it):

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
export const fixtureRoot = path.join(fixtures, "meta-model");
export const instanceRoot = path.join(fixtures, "mental-model");
// The reference instance the suite runs against, pinned here as test data: 143 entities, 608
// edges, core 0.25.2 vendored, and an identity and a profile that share one name.
export const INSTANCE_COMMIT = "2fd146fe669ef80f7d7b8090ad1cf533b9020ebc";
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/fixtures.test.mjs` Expected: FAIL, `ENOENT` on `.tag`.

- [ ] **Step 4: Write the fixtures script**

`scripts/fixtures.mjs`:

```js
// Fetches the two repositories the suite runs against into test/fixtures/: companygraph/
// meta-model at the tag package.json pins, for its worked example and core/, and the reference
// instance robertblust/mental-model at one commit, for real values. Neither is in node_modules:
// the package ships lib/ and bin/ only, and an instance is content, not a dependency.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const [, metaRepo, tag] = pkg.dependencies["companygraph-meta-model"].match(/^github:([^#]+)#(.+)$/);

// The instance commit is test data and lives here, beside the one test helper that repeats it.
const INSTANCE_COMMIT = "2fd146fe669ef80f7d7b8090ad1cf533b9020ebc";

const FIXTURES = [
  { repo: metaRepo, ref: tag, url: `https://codeload.github.com/${metaRepo}/tar.gz/refs/tags/${tag}`, dir: "meta-model" },
  { repo: "robertblust/mental-model", ref: INSTANCE_COMMIT, url: `https://codeload.github.com/robertblust/mental-model/tar.gz/${INSTANCE_COMMIT}`, dir: "mental-model" },
];

for (const f of FIXTURES) {
  const target = path.join(root, "test", "fixtures", f.dir);
  const marker = path.join(target, ".ref");
  if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === f.ref) {
    console.log(`fixtures: ${f.repo}@${f.ref.slice(0, 12)} already present`);
    continue;
  }
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  execFileSync("tar", ["-xz", "--strip-components=1", "-C", target], { input: Buffer.from(await res.arrayBuffer()) });
  fs.writeFileSync(marker, f.ref + "\n");
  console.log(`fixtures: ${f.repo}@${f.ref.slice(0, 12)} fetched into test/fixtures/${f.dir}`);
}
```

- [ ] **Step 5: Run the script and the test**

Run: `npm run fixtures && node --test test/fixtures.test.mjs` Expected: two `fetched` lines, then 2 pass. Run `npm run fixtures` again: two `already present` lines.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check
git add package.json package-lock.json scripts/fixtures.mjs test/fixtures.test.mjs test/helpers.mjs
git commit -F - <<'EOF'
The package and its fixtures

package.json names the package, its three binaries, its exports and its pins: the meta-model parser by tag, the two MCP SDK packages and zod at runtime, the MCP client for tests. The pretest step fetches two repositories into test/fixtures/: companygraph/meta-model at the pinned tag, because the package ships lib/ and bin/ only and the suite runs against its worked example and core, and robertblust/mental-model at one commit, because the suite also runs against the reference instance for real values; the folder is gitignored and a marker file per fixture makes the fetch idempotent.

Verified: `npm run fixtures` fetches both once and reports present on the second run; `node --test test/fixtures.test.mjs` 2 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: Reading files — `lib/read.mjs`

**Files:**

- Create: `lib/read.mjs`, `test/read.test.mjs`

**Interfaces:**

- Produces: `readDir(root: string): Map<string, string>` with keys relative to `root`, forward slashes, sorted; `readGitHub({ repo, commit, sub, token?, fetch? }): Promise<Map<string, string>>` with keys relative to `sub`.

- [ ] **Step 1: Write the failing tests**

`test/read.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readDir, readGitHub } from "../lib/read.mjs";
import { fixtureRoot } from "./helpers.mjs";

test("readDir maps every file under the root by its relative path", () => {
  const files = readDir(path.join(fixtureRoot, "example", "model"));
  assert.ok(files.has("identity.md"));
  assert.ok(files.has("profiles/tomas-reyes/tomas-reyes.md"));
  assert.match(files.get("identity.md"), /^---\n/);
  assert.deepEqual([...files.keys()], [...files.keys()].sort());
});

test("readGitHub lists the tree at the commit and reads each blob under sub", async () => {
  const calls = [];
  const fetch = async (url, { headers }) => {
    calls.push({ url, headers });
    if (url.includes("/git/trees/")) {
      return { ok: true, json: async () => ({ truncated: false, tree: [
        { type: "blob", path: "model/identity.md" },
        { type: "blob", path: "README.md" },
        { type: "tree", path: "model/skills" },
        { type: "blob", path: "model/skills/a.md" },
      ] }) };
    }
    return { ok: true, text: async () => `text of ${url.split("/").pop()}` };
  };
  const files = await readGitHub({ repo: "o/r", commit: "abc", sub: "model/", token: "T", fetch });
  assert.deepEqual([...files.keys()], ["identity.md", "skills/a.md"]);
  assert.equal(files.get("identity.md"), "text of identity.md");
  assert.equal(calls[0].url, "https://api.github.com/repos/o/r/git/trees/abc?recursive=1");
  assert.equal(calls[0].headers.authorization, "Bearer T");
  assert.equal(calls[1].url, "https://raw.githubusercontent.com/o/r/abc/model/identity.md");
});

test("readGitHub fails on a truncated listing and on a failed blob", async () => {
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async () => ({ ok: true, json: async () => ({ truncated: true, tree: [] }) }) }), /truncated/);
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async (url) => url.includes("/git/trees/")
      ? { ok: true, json: async () => ({ truncated: false, tree: [{ type: "blob", path: "model/x.md" }] }) }
      : { ok: false, status: 500 } }), /model\/x\.md: HTTP 500/);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/read.test.mjs` Expected: FAIL, cannot find module `../lib/read.mjs`.

- [ ] **Step 3: Implement**

`lib/read.mjs`:

```js
// The one place this package touches a filesystem or the network. Everything below it takes a
// Map(path → text), the shape the meta-model's parser reads, so the parser and the queries can
// be fed fixtures in tests.
import fs from "node:fs";
import path from "node:path";

// A directory as the parser wants it: keys relative to the root, forward slashes, sorted.
export function readDir(root) {
  const files = new Map();
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else files.set(path.relative(root, p).split(path.sep).join("/"), fs.readFileSync(p, "utf8"));
    }
  };
  walk(root);
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// One commit's worth of files under `sub`, from GitHub: the trees API for the listing, then
// each raw file. No tarball, nothing to untar. A token is sent when given and never printed.
export async function readGitHub({ repo, commit, sub, token = process.env.GITHUB_TOKEN, fetch = globalThis.fetch }) {
  const headers = { "user-agent": "companygraph-mcp-server" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`, { headers });
  if (!res.ok) throw new Error(`trees API for ${repo}@${commit}: HTTP ${res.status}`);
  const { tree, truncated } = await res.json();
  if (truncated) throw new Error(`trees API truncated the listing of ${repo}@${commit}`);
  const files = new Map();
  for (const e of tree) {
    if (e.type !== "blob" || !e.path.startsWith(sub)) continue;
    const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${e.path}`, { headers });
    if (!raw.ok) throw new Error(`${e.path}: HTTP ${raw.status}`);
    files.set(e.path.slice(sub.length), await raw.text());
  }
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/read.test.mjs` Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add lib/read.mjs test/read.test.mjs
git commit -F - <<'EOF'
Reading a model from a directory or a commit

lib/read.mjs is the one place the package touches a filesystem or the network. readDir maps a directory by relative path, sorted, the shape the parser reads. readGitHub lists a repository's tree at a commit and reads every blob under one subtree, sending a token when given; fetch is injectable so the tests need no network.

Verified: `node --test test/read.test.mjs` 3 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The snapshot — `lib/snapshot.mjs`

**Files:**

- Create: `lib/snapshot.mjs`, `test/snapshot.test.mjs`
- Modify: `test/helpers.mjs`

**Interfaces:**

- Consumes: `readDir` from Task 2; `parseInstance(files, { sub, schemas })` and `parseSchemas(files)` from `companygraph-meta-model/instance`.
- Produces: `buildSnapshot({ files, schemas, sub, commit, repo, parserTag }) → snapshot`; `parserTag() → string`; `exampleSnapshot()` in helpers.

The snapshot shape every later task reads:

```js
{ commit, repo, core: { version, parser }, root, rootId,
  types: [{ type, folder, owner, singular }],
  schemas: [{ id: "core/<type>", type: "schema", name, tagline, fields, sections, owner, path }],
  entities: [{ id, type, name, tagline, fields, sections, owner, path, stamp?, markdown }],
  edges: [{ from, to, via, attrs }] }
```

- [ ] **Step 1: Extend helpers and write the failing tests**

Add to `test/helpers.mjs`:

```js
import { readDir } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";

export const COMMIT = "0123456789abcdef0123456789abcdef01234567";

export function exampleFiles() {
  return { files: readDir(path.join(fixtureRoot, "example", "model")), schemas: readDir(path.join(fixtureRoot, "core")) };
}

export function exampleSnapshot() {
  const { files, schemas } = exampleFiles();
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: "v0.25.2" });
}

// The reference instance, read the way its own site reads it: model/ against the core it vendors.
export function instanceSnapshot() {
  return buildSnapshot({ files: readDir(path.join(instanceRoot, "model")), schemas: readDir(path.join(instanceRoot, "meta", "core")),
    sub: "model/", commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", parserTag: "v0.25.2" });
}
```

`test/snapshot.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseInstance } from "companygraph-meta-model/instance";
import { buildSnapshot, parserTag } from "../lib/snapshot.mjs";
import { exampleFiles, exampleSnapshot, COMMIT } from "./helpers.mjs";

test("the snapshot is the parser's graph plus provenance, schemas and source text", () => {
  const s = exampleSnapshot();
  const { files, schemas } = exampleFiles();
  const graph = parseInstance(files, { sub: "example/model/", schemas });
  assert.equal(s.commit, COMMIT);
  assert.equal(s.repo, "companygraph/meta-model");
  assert.deepEqual(s.core, { version: "0.25.2", parser: "v0.25.2" });
  assert.equal(s.root, graph.root);
  assert.equal(s.rootId, graph.rootId);
  assert.equal(s.entities.length, graph.entities.length);
  assert.equal(s.edges.length, graph.edges.length);
  assert.deepEqual(s.edges, graph.edges);
  assert.equal(s.schemas.length, 15);
  assert.ok(s.schemas.every((x) => x.id.startsWith("core/")));
  for (const e of s.entities) assert.equal(e.markdown, files.get(e.path.slice("example/model/".length)));
});

test("a core without a manifest is refused", () => {
  const { files, schemas } = exampleFiles();
  const bare = new Map([...schemas].filter(([k]) => k !== "manifest.json"));
  assert.throws(() => buildSnapshot({ files, schemas: bare, sub: "example/model/", parserTag: "v0" }), /manifest\.json/);
});

test("parserTag is the tag package.json pins", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(parserTag(), pkg.dependencies["companygraph-meta-model"].split("#")[1]);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/snapshot.test.mjs` Expected: FAIL, cannot find module `../lib/snapshot.mjs`.

- [ ] **Step 3: Implement**

`lib/snapshot.mjs`:

```js
// One instance, parsed once, into the document the server serves. The parser is the
// meta-model's own and is imported, never copied: an instance is read against the schemas it
// vendors, at the commit it is read from, and the result is the parser's graph untouched, plus
// where it came from and each entity's page as written.
import fs from "node:fs";
import { parseInstance, parseSchemas } from "companygraph-meta-model/instance";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// The parser's release is a fact about every answer, so it is read from the pin rather than typed.
export function parserTag() {
  return pkg.dependencies["companygraph-meta-model"].split("#")[1];
}

export function buildSnapshot({ files, schemas, sub = "", commit = null, repo = null, parserTag: tag = parserTag() }) {
  const manifest = schemas.get("manifest.json");
  if (!manifest) throw new Error("the core carries no manifest.json, so its version cannot be reported");
  const { version } = JSON.parse(manifest);
  const graph = parseInstance(files, { sub, schemas });
  const entities = graph.entities.map((e) => ({ ...e, markdown: files.get(e.path.slice(sub.length)) }));
  return {
    commit, repo,
    core: { version, parser: tag },
    root: graph.root, rootId: graph.rootId,
    types: graph.types,
    schemas: parseSchemas(schemas).entities,
    entities,
    edges: graph.edges,
  };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/snapshot.test.mjs` Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add lib/snapshot.mjs test/snapshot.test.mjs test/helpers.mjs
git commit -F - <<'EOF'
The snapshot the server serves

buildSnapshot feeds a model and its schemas to the meta-model's parser and returns the graph untouched beside what an answer has to carry: the commit and repository it was read from, the core version from the core's own manifest, the parser's tag from this package's pin, the parsed schemas, and each entity's page verbatim. A core without a manifest is refused rather than reported as unknown.

Verified: `node --test test/snapshot.test.mjs` 3 pass on the worked example at v0.25.2; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Types, schemas, entities — `lib/model.mjs` part one

**Files:**

- Create: `lib/model.mjs`, `test/model.test.mjs`

**Interfaces:**

- Consumes: the snapshot shape from Task 3.
- Produces: `class ModelError extends Error`; `provenance(s)`; `listTypes(s)`, `describeSchema(s, type)`, `listEntities(s, type)`, `getEntity(s, type, name)`. Every return carries `model: { commit, repo, core, parser }`.

- [ ] **Step 1: Write the failing tests**

`test/model.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listTypes, describeSchema, listEntities, getEntity } from "../lib/model.mjs";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: "0.25.2", parser: "v0.25.2" };

test("list_types names every declared type with its tagline and count", () => {
  const r = listTypes(s);
  assert.deepEqual(r.model, MODEL);
  assert.equal(r.types.length, 15);
  const skill = r.types.find((t) => t.type === "skill");
  assert.equal(skill.name, "Skill Schema");
  assert.equal(skill.count, s.entities.filter((e) => e.type === "skill").length);
  assert.equal(r.types.find((t) => t.type === "experience").owner, "profile");
  assert.equal(r.types.find((t) => t.type === "identity").count, 1);
});

test("describe_schema returns the schema's sections and refuses an undeclared type", () => {
  const r = describeSchema(s, "profile");
  assert.equal(r.name, "Profile Schema");
  assert.deepEqual(r.sections.map((x) => x.heading), ["File Location", "Frontmatter", "Sections", "Purpose", "Writing rules"]);
  assert.ok(r.sections.find((x) => x.heading === "Frontmatter").table.columns.includes("Field"));
  assert.throws(() => describeSchema(s, "person"), (e) => e instanceof ModelError && /no schema declares "person"/.test(e.message) && /skill/.test(e.message));
});

test("list_entities lists one type, sorted by id", () => {
  const r = listEntities(s, "skill");
  assert.equal(r.type, "skill");
  assert.deepEqual(r.entities.map((e) => e.id), ["skills/domain-driven-design", "skills/java-programming", "skills/product-discovery"]);
  assert.deepEqual(Object.keys(r.entities[0]), ["id", "name", "tagline", "owner"]);
  assert.throws(() => listEntities(s, "person"), ModelError);
});

test("get_entity resolves within the type and returns references both ways", () => {
  const r = getEntity(s, "skill", "Domain-Driven Design");
  assert.equal(r.entity.id, "skills/domain-driven-design");
  assert.equal(r.entity.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/skills/domain-driven-design.md`);
  assert.equal(r.entity.markdown, undefined);
  const claim = r.entity.referencedBy.find((x) => x.via === "Skills.Skill" && x.id === "profiles/mira-halvorsen");
  assert.equal(claim.type, "profile");
  assert.equal(claim.name, "Mira Halvorsen");
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  assert.match(claim.attrs.Evidence, /bounded contexts/);
  const source = r.entity.references.find((x) => x.via === "source");
  assert.equal(source.type, "source");
  assert.equal(source.name, "Local");
});

test("get_entity is an R4 error for a name the type does not hold, even if another type does", () => {
  assert.throws(() => getEntity(s, "skill", "Beacon Systems"), (e) => e instanceof ModelError && /R4/.test(e.message) && /skill/.test(e.message));
  assert.throws(() => getEntity(s, "identity", "Beacon Systems") && false, /false/); // sanity: the identity resolves
});
```

The last assertion is a guard that `getEntity(s, "identity", "Beacon Systems")` succeeds; replace it with a plain call and `assert.equal(getEntity(s, "identity", "Beacon Systems").entity.id, "identity")`.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/model.test.mjs` Expected: FAIL, cannot find module `../lib/model.mjs`.

- [ ] **Step 3: Implement part one**

`lib/model.mjs`:

```js
// The seven queries over a snapshot. Pure: a snapshot in, a JSON-shaped answer out, and every
// answer carries where it came from. Types and their descriptions come from the parsed
// schemas, so nothing here enumerates the vocabulary; references come from the parser's edges,
// so nothing here decides what a field means. A name resolves within a type (R2); a name that
// resolves to nothing is an error (R4); a name asked without a type that more than one type
// holds is refused with the types named, never given to the first match.

export class ModelError extends Error {}

export const provenance = (s) => ({ commit: s.commit, repo: s.repo, core: s.core.version, parser: s.core.parser });

const declaredTypes = (s) => s.schemas.map((x) => x.id.slice("core/".length));
const schemaOf = (s, type) => s.schemas.find((x) => x.id === "core/" + type);
const requireType = (s, type) => {
  const schema = schemaOf(s, type);
  if (!schema) throw new ModelError(`no schema declares "${type}"; the declared types are ${declaredTypes(s).join(", ")}`);
  return schema;
};
const index = (s) => new Map(s.entities.map((e) => [e.id, e]));
const fileUrl = (s, e) => (s.repo && s.commit ? `https://github.com/${s.repo}/blob/${s.commit}/${e.path}` : null);
const ref = (e) => ({ id: e.id, type: e.type, name: e.name });

// A qualifier the parser resolved arrives as an id; the reader wants the name beside it.
const resolveAttrs = (byId, attrs) =>
  Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, byId.has(v) ? ref(byId.get(v)) : v]));

const withReferences = (s, e) => {
  const byId = index(s);
  const { markdown, ...rest } = e;
  const references = s.edges.filter((x) => x.from === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.to)), attrs: resolveAttrs(byId, x.attrs) }));
  const referencedBy = s.edges.filter((x) => x.to === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.from)), attrs: resolveAttrs(byId, x.attrs) }));
  return { ...rest, url: fileUrl(s, e), references, referencedBy };
};

const resolveTyped = (s, type, name) => {
  requireType(s, type);
  const e = s.entities.find((x) => x.type === type && x.name === name);
  if (!e) throw new ModelError(`R4: "${name}" names no ${type}`);
  return e;
};

export function listTypes(s) {
  const counts = new Map();
  for (const e of s.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  const types = s.schemas.map((schema) => {
    const type = schema.id.slice("core/".length);
    const t = s.types.find((x) => x.type === type);
    return { type, name: schema.name, tagline: schema.tagline, owner: t?.owner ?? null, count: counts.get(type) ?? 0 };
  });
  return { types, model: provenance(s) };
}

export function describeSchema(s, type) {
  const schema = requireType(s, type);
  return { type, name: schema.name, tagline: schema.tagline, sections: schema.sections, model: provenance(s) };
}

export function listEntities(s, type) {
  requireType(s, type);
  const entities = s.entities.filter((e) => e.type === type).map(({ id, name, tagline, owner }) => ({ id, name, tagline, owner }));
  return { type, entities, model: provenance(s) };
}

export function getEntity(s, type, name) {
  return { entity: withReferences(s, resolveTyped(s, type, name)), model: provenance(s) };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/model.test.mjs` Expected: 5 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add lib/model.mjs test/model.test.mjs
git commit -F - <<'EOF'
Types, schemas and entities from a snapshot

lib/model.mjs begins: the types an instance declares are read from its parsed schemas with a count of entities each, a schema is described by its own sections, a type's entities are listed by id, and one entity is fetched within its type with the edges out of it and into it, each edge naming the entity at its other end and carrying its attributes with resolved qualifiers shown as the entity they name. A name the type does not hold is the R4 error it is, whatever another type holds under that name. Every answer carries the commit, the repository, the core version and the parser tag.

Verified: `node --test test/model.test.mjs` 5 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Evidence, search, fetch — `lib/model.mjs` part two

**Files:**

- Modify: `lib/model.mjs`, `test/model.test.mjs`, `test/helpers.mjs`

**Interfaces:**

- Produces: `findEvidence(s, skill)`, `search(s, query)`, `fetchEntity(s, id)`; `withSharedName()` in helpers, a snapshot in which a profile shares the identity's name.

- [ ] **Step 1: Add the helper for the shared-name fixture**

Add to `test/helpers.mjs`:

```js
// The company of one: an identity and a profile with the same name. The example has no such
// pair, so one is added — a profile page carries only what the parser needs to read it.
export function withSharedName() {
  const { files, schemas } = exampleFiles();
  const root = files.get("identity.md").match(/^# (.+)$/m)[1];
  const slug = root.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  files.set(`profiles/${slug}/${slug}.md`, `---\nsource: Local\nnature: human\n---\n\n# ${root}\n\n> The founder, profiled under the company's own name.\n\n## Summary\n\nOne person.\n`);
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: "v0.25.2" });
}
```

- [ ] **Step 2: Write the failing tests**

Append to `test/model.test.mjs` (extend the import line with `findEvidence, search, fetchEntity` and `withSharedName`):

```js
test("find_evidence groups every edge into the skill by the referencing type, attributes verbatim", () => {
  const r = findEvidence(s, "Domain-Driven Design");
  assert.deepEqual(r.skill, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design", tagline: s.entities.find((e) => e.id === "skills/domain-driven-design").tagline });
  assert.deepEqual(Object.keys(r.evidence).sort(), ["experience", "profile", "role"]);
  const mira = r.evidence.profile.find((x) => x.id === "profiles/mira-halvorsen");
  assert.equal(mira.via, "Skills.Skill");
  assert.equal(mira.attrs.Level.name, "Competent");
  assert.equal(mira.attrs.Evidence, "Split the billing domain into two bounded contexts; the seams have held under two years of change.");
  const exp = r.evidence.experience.find((x) => x.id === "profiles/mira-halvorsen/experiences/2022-beacon-systems");
  assert.equal(exp.via, "skills");
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.stamp, s.entities.find((e) => e.id === exp.id).stamp);
  assert.throws(() => findEvidence(s, "Knitting"), (e) => e instanceof ModelError && /R4/.test(e.message));
});

test("search matches name, tagline, fields, section text and cells, case-insensitive, sorted by type then name", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.ok(r.total >= 1);
  const mira = r.results.find((x) => x.id === "profiles/mira-halvorsen");
  assert.ok(mira.matched.includes("table:Skills"));
  assert.equal(mira.title, "Mira Halvorsen");
  assert.equal(mira.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/profiles/mira-halvorsen/mira-halvorsen.md`);
  const byName = search(s, "domain-driven").results.find((x) => x.id === "skills/domain-driven-design");
  assert.ok(byName.matched.includes("name"));
  const keys = r.results.map((x) => x.type + " " + x.name);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(search(s, "zzzz-nothing").total, 0);
  assert.throws(() => search(s, "  "), ModelError);
});

test("fetch takes an id, falls back to a name held by exactly one type, and refuses a shared name", () => {
  const byId = fetchEntity(s, "skills/domain-driven-design");
  assert.equal(byId.title, "Domain-Driven Design");
  assert.match(byId.text, /^---\n/);
  assert.equal(byId.entity.id, "skills/domain-driven-design");
  assert.equal(byId.entity.markdown, undefined);
  assert.equal(fetchEntity(s, "Beacon Systems").entity.id, "identity");
  const shared = withSharedName();
  assert.throws(() => fetchEntity(shared, "Beacon Systems"), (e) => e instanceof ModelError && /R2/.test(e.message) && /identity/.test(e.message) && /profile/.test(e.message));
  assert.throws(() => fetchEntity(s, "nothing/here"), (e) => e instanceof ModelError && /nothing\/here/.test(e.message));
});
```

- [ ] **Step 3: Run to see them fail**

Run: `node --test test/model.test.mjs` Expected: 5 pass, 3 fail (`findEvidence is not a function` and the like).

- [ ] **Step 4: Implement part two**

Append to `lib/model.mjs`:

```js
// Every edge into the skill, grouped by the type of the page that drew it. A profile's row
// arrives with the columns its schema declares beside the reference — Level, Evidence in core —
// under their own names and verbatim; an experience arrives with its stamp and owner. Nothing
// here names a column.
export function findEvidence(s, skill) {
  const e = resolveTyped(s, "skill", skill);
  const byId = index(s);
  const evidence = {};
  for (const x of s.edges.filter((x) => x.to === e.id)) {
    const from = byId.get(x.from);
    const entry = { via: x.via, ...ref(from), owner: from.owner, attrs: resolveAttrs(byId, x.attrs) };
    if (from.stamp) entry.stamp = from.stamp;
    (evidence[from.type] ??= []).push(entry);
  }
  return { skill: { ...ref(e), tagline: e.tagline }, evidence, model: provenance(s) };
}

// A substring match over everything an entity says, reported by where it hit. The order is
// type then name — a listing, not a ranking.
export function search(s, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) throw new ModelError("search needs a query");
  const hit = (text) => typeof text === "string" && text.toLowerCase().includes(q);
  const results = [];
  for (const e of s.entities) {
    const matched = [];
    if (hit(e.name)) matched.push("name");
    if (hit(e.tagline)) matched.push("tagline");
    for (const [k, v] of Object.entries(e.fields)) if ([v].flat().some(hit)) matched.push(`field:${k}`);
    for (const sec of e.sections) {
      if (hit(sec.text)) matched.push(`section:${sec.heading}`);
      if (sec.tables.some((t) => t.rows.some((row) => row.some(hit)))) matched.push(`table:${sec.heading}`);
    }
    if (matched.length) results.push({ id: e.id, title: e.name, url: fileUrl(s, e), type: e.type, tagline: e.tagline, matched });
  }
  results.sort((a, b) => (a.type === b.type ? (a.name ?? a.title) < (b.name ?? b.title) ? -1 : 1 : a.type < b.type ? -1 : 1));
  return { query, total: results.length, results, model: provenance(s) };
}

// An id first. A bare name resolves only when exactly one type holds it; two types holding it
// is the R2 case, refused with both named, never handed to the first.
export function fetchEntity(s, id) {
  const byId = index(s);
  let e = byId.get(id);
  if (!e) {
    const named = s.entities.filter((x) => x.name === id);
    if (named.length > 1) {
      throw new ModelError(`R2: "${id}" is the name of ${named.length} entities of different types (${named.map((x) => x.type).join(", ")}); ask by type with get_entity`);
    }
    if (named.length === 0) throw new ModelError(`nothing has the id or the name "${id}"`);
    e = named[0];
  }
  return { id: e.id, title: e.name, text: e.markdown, url: fileUrl(s, e), entity: withReferences(s, e), model: provenance(s) };
}
```

Note on `search`'s sort: `results` carry `title`, not `name`; sort on `a.title`. Write it as `a.title < b.title`.

- [ ] **Step 5: Run to see them pass**

Run: `node --test test/model.test.mjs` Expected: 8 pass.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check
git add lib/model.mjs test/model.test.mjs test/helpers.mjs
git commit -F - <<'EOF'
Evidence, search and fetch

find_evidence resolves a skill within its type and returns every edge into it grouped by the type that drew it: a profile's row with the columns its schema declares, verbatim, an experience with its stamp and owner, a role with its requirement. search is a substring match over a page's name, tagline, fields, section text and table cells, reported by where it hit and ordered by type then name, a listing rather than a ranking. fetch takes the id search returned and falls back to a name only when exactly one type holds it; two types holding it is the R2 case and is refused with both named. The test for that case adds a profile under the identity's name to the example, since the example has no such pair.

Verified: `node --test test/model.test.mjs` 8 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: Tools and server — `lib/tools.mjs`, `lib/server.mjs`

**Files:**

- Create: `lib/tools.mjs`, `lib/server.mjs`, `test/server.test.mjs`

**Interfaces:**

- Consumes: the seven queries and `ModelError` from Tasks 4 and 5.
- Produces: `registerTools(server, snapshot)`; `createServer(snapshot, { name?, version? }) → McpServer` with `title` the identity's H1 and `instructions` from the vision and identity taglines.

- [ ] **Step 1: Write the failing tests**

`test/server.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: "0.25.2", parser: "v0.25.2" };

async function connect(snapshot = s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(snapshot).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  return client;
}

test("the server names itself from the package and the model", async () => {
  const client = await connect();
  assert.deepEqual(client.getServerVersion(), { name: pkg.name, version: pkg.version, title: "Beacon Systems" });
  const identity = s.entities.find((e) => e.id === "identity");
  const vision = s.entities.find((e) => e.type === "vision");
  assert.equal(client.getInstructions(), `${vision.tagline}\n\n${identity.tagline}\n\nThis server reports what the model says at commit ${COMMIT} (core 0.25.2) and adds nothing.`);
});

test("seven tools, exact names", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["describe_schema", "fetch", "find_evidence", "get_entity", "list_entities", "list_types", "search"]);
  for (const t of tools) assert.ok(t.description.length > 20, t.name);
});

test("every tool returns structured content carrying the model", async () => {
  const client = await connect();
  const calls = [
    ["list_types", {}], ["describe_schema", { type: "skill" }], ["list_entities", { type: "skill" }],
    ["get_entity", { type: "skill", name: "Domain-Driven Design" }], ["find_evidence", { skill: "Domain-Driven Design" }],
    ["search", { query: "billing" }], ["fetch", { id: "skills/domain-driven-design" }],
  ];
  for (const [name, args] of calls) {
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, undefined, name);
    assert.deepEqual(r.structuredContent.model, MODEL, name);
    assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent, name);
  }
});

test("a model error is a tool error with the rule in its text", async () => {
  const client = await connect();
  const r = await client.callTool({ name: "get_entity", arguments: { type: "skill", name: "Beacon Systems" } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /R4/);
});

test("a model without a vision still has instructions", async () => {
  const bare = { ...s, entities: s.entities.filter((e) => e.type !== "vision"), edges: s.edges.filter((e) => !e.from.startsWith("vision") && !e.to.startsWith("vision")) };
  const client = await connect(bare);
  assert.ok(client.getInstructions().startsWith(s.entities.find((e) => e.id === "identity").tagline));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/server.test.mjs` Expected: FAIL, cannot find module `../lib/server.mjs`.

- [ ] **Step 3: Implement the tools**

`lib/tools.mjs`:

```js
// The seven tools, each a thin wrapper over one query: the arguments in, the query's answer
// out as structured content and as the same JSON in text, a ModelError out as a tool error
// with its sentence. Descriptions say what a tool does and name no instance fact.
import { z } from "zod";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, findEvidence, search, fetchEntity } from "./model.mjs";

const model = z.object({ commit: z.string().nullable(), repo: z.string().nullable(), core: z.string(), parser: z.string() });
const output = z.looseObject({ model });

const run = (fn) => async (args) => {
  try {
    const data = fn(args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
  } catch (err) {
    if (err instanceof ModelError) return { isError: true, content: [{ type: "text", text: err.message }] };
    throw err;
  }
};

export function registerTools(server, s) {
  server.registerTool("list_types", {
    description: "Every type the instance's schemas declare, with its tagline, its owner type and how many entities it holds.",
    inputSchema: z.object({}), outputSchema: output,
  }, run(() => listTypes(s)));

  server.registerTool("describe_schema", {
    description: "One type's schema as the instance vendors it: file location, frontmatter fields, sections and their columns, purpose and writing rules.",
    inputSchema: z.object({ type: z.string().describe("A type name from list_types, such as skill") }), outputSchema: output,
  }, run(({ type }) => describeSchema(s, type)));

  server.registerTool("list_entities", {
    description: "The id, canonical name and tagline of every entity of one type.",
    inputSchema: z.object({ type: z.string() }), outputSchema: output,
  }, run(({ type }) => listEntities(s, type)));

  server.registerTool("get_entity", {
    description: "One entity by type and canonical name: its frontmatter, sections and tables, with every reference it makes and every reference made to it. A name resolves within its type.",
    inputSchema: z.object({ type: z.string(), name: z.string().describe("The canonical name, the entity's H1") }), outputSchema: output,
  }, run(({ type, name }) => getEntity(s, type, name)));

  server.registerTool("find_evidence", {
    description: "Everything the model says about one skill: each profile's claimed level with its Evidence verbatim, each experience that lists the skill, and any other page that references it.",
    inputSchema: z.object({ skill: z.string().describe("The skill's canonical name") }), outputSchema: output,
  }, run(({ skill }) => findEvidence(s, skill)));

  server.registerTool("search", {
    description: "Entities whose name, tagline, fields, sections or table cells contain the query, case-insensitive, listed by type then name with the fields that matched. Use fetch with a result's id.",
    inputSchema: z.object({ query: z.string() }), outputSchema: output,
  }, run(({ query }) => search(s, query)));

  server.registerTool("fetch", {
    description: "One entity by the id search returned, with its page as written. A bare name is accepted only when exactly one type holds it.",
    inputSchema: z.object({ id: z.string() }), outputSchema: output,
  }, run(({ id }) => fetchEntity(s, id)));
}
```

`lib/server.mjs`:

```js
// The McpServer for one snapshot. Its title is the identity's name and its instructions are
// what the model says about itself — the vision's tagline, the identity's tagline — followed
// by the one sentence this package adds: that it adds nothing.
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export function instructionsFor(s) {
  const identity = s.entities.find((e) => e.id === s.rootId);
  const vision = s.entities.find((e) => e.type === "vision");
  return [vision?.tagline, identity?.tagline,
    `This server reports what the model says at commit ${s.commit ?? "(uncommitted)"} (core ${s.core.version}) and adds nothing.`]
    .filter(Boolean).join("\n\n");
}

export function createServer(s, { name = pkg.name, version = pkg.version } = {}) {
  const server = new McpServer({ name, version, title: s.root }, { instructions: instructionsFor(s) });
  registerTools(server, s);
  return server;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/server.test.mjs` Expected: 5 pass. If `getServerVersion()` returns more keys than the three, compare with `assert.equal` on each of `name`, `version`, `title` instead.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add lib/tools.mjs lib/server.mjs test/server.test.mjs
git commit -F - <<'EOF'
The seven tools on an McpServer

lib/tools.mjs registers list_types, describe_schema, list_entities, get_entity, find_evidence, search and fetch, each a wrapper over one query that returns the answer as structured content and as the same JSON in text, and a ModelError as a tool error carrying its sentence. lib/server.mjs builds the server: name and version from the package, title from the identity's H1, instructions from the vision's tagline and the identity's tagline followed by the one sentence this package adds. The tests speak to it through the SDK's in-memory transport.

Verified: `node --test test/server.test.mjs` 5 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: The snapshot CLI — `bin/snapshot.mjs`

**Files:**

- Create: `bin/snapshot.mjs`, `test/bin-snapshot.test.mjs`

**Interfaces:**

- Consumes: `readDir`, `readGitHub`, `buildSnapshot`.
- Produces: `companygraph-mcp-snapshot <model-dir> <core-dir> [--commit sha] [--repo owner/name] --out file` and `companygraph-mcp-snapshot --github owner/name@sha [--sub model/] [--core meta/core/] --out file`.

- [ ] **Step 1: Write the failing test**

`test/bin-snapshot.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/bin-snapshot.test.mjs` Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implement**

`bin/snapshot.mjs`:

```js
#!/usr/bin/env node
// Writes the snapshot the HTTP server serves. Two forms: two local directories, or a GitHub
// repository at a commit with the model and core subtrees named. Either way the file carries
// the commit it was read from, so a deployment can bake it and answer for one commit.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { readDir, readGitHub } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    github: { type: "string" }, sub: { type: "string", default: "model/" }, core: { type: "string", default: "meta/core/" },
    commit: { type: "string" }, repo: { type: "string" }, out: { type: "string" },
  },
});
if (!values.out) {
  console.error("usage: companygraph-mcp-snapshot <model-dir> <core-dir> [--commit sha] [--repo owner/name] [--sub model/] --out file\n" +
                "       companygraph-mcp-snapshot --github owner/name@sha [--sub model/] [--core meta/core/] --out file");
  process.exit(2);
}

let snapshot;
if (values.github) {
  const [repo, commit] = values.github.split("@");
  if (!repo || !commit) { console.error("--github wants owner/name@sha"); process.exit(2); }
  const [files, schemas] = await Promise.all([
    readGitHub({ repo, commit, sub: values.sub }),
    readGitHub({ repo, commit, sub: values.core }),
  ]);
  snapshot = buildSnapshot({ files, schemas, sub: values.sub, commit, repo });
} else {
  const [modelDir, coreDir] = positionals;
  if (!modelDir || !coreDir) { console.error("two directories: <model-dir> <core-dir>"); process.exit(2); }
  snapshot = buildSnapshot({ files: readDir(modelDir), schemas: readDir(coreDir), sub: values.sub, commit: values.commit ?? null, repo: values.repo ?? null });
}
fs.writeFileSync(values.out, JSON.stringify(snapshot) + "\n");
console.log(`wrote ${values.out}: ${snapshot.entities.length} entities, ${snapshot.edges.length} edges, core ${snapshot.core.version}, commit ${snapshot.commit ?? "(none)"}`);
```

Run `chmod +x bin/snapshot.mjs`.

- [ ] **Step 4: Run to see it pass**

Run: `node --test test/bin-snapshot.test.mjs` Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add bin/snapshot.mjs test/bin-snapshot.test.mjs
git commit -F - <<'EOF'
The snapshot command

companygraph-mcp-snapshot writes the document the HTTP server serves, from two local directories or from a GitHub repository at a commit with the model and core subtrees named, and reports the counts and the commit it read. The file is what a deployment bakes into its image.

Verified: `node --test test/bin-snapshot.test.mjs` 2 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: The stdio entry point — `bin/stdio.mjs`

**Files:**

- Create: `bin/stdio.mjs`, `test/bin-stdio.test.mjs`

**Interfaces:**

- Consumes: `readDir`, `buildSnapshot`, `createServer`; `StdioServerTransport` from `@modelcontextprotocol/server/stdio`.
- Produces: `companygraph-mcp <model-dir> <core-dir> [--sub model/] [--repo owner/name]`, commit from `git rev-parse HEAD` in the model directory when it is inside a repository.

- [ ] **Step 1: Write the failing test**

`test/bin-stdio.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fixtureRoot } from "./helpers.mjs";

const bin = new URL("../bin/stdio.mjs", import.meta.url).pathname;

test("the stdio server lists seven tools and answers with the model", async () => {
  const transport = new StdioClientTransport({ command: "node", args: [bin, path.join(fixtureRoot, "example/model"), path.join(fixtureRoot, "core"), "--sub", "example/model/"] });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  const r = await client.callTool({ name: "list_types", arguments: {} });
  assert.equal(r.structuredContent.model.core, "0.25.2");
  assert.equal(r.structuredContent.types.length, 15);
  await client.close();
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/bin-stdio.test.mjs` Expected: FAIL (the process exits or the module is missing).

- [ ] **Step 3: Implement**

`bin/stdio.mjs`:

```js
#!/usr/bin/env node
// The local form: a model directory and its core, served over stdio to whatever launched it.
// The snapshot is built in memory; the commit is what the directory's repository says, or
// null outside one — an uncommitted model answers as uncommitted rather than as a commit.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { readDir } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";
import { createServer } from "../lib/server.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { sub: { type: "string", default: "model/" }, repo: { type: "string" } },
});
const [modelDir, coreDir] = positionals;
if (!modelDir || !coreDir) {
  console.error("usage: companygraph-mcp <model-dir> <core-dir> [--sub model/] [--repo owner/name]");
  process.exit(2);
}
const commit = (() => {
  try { return execFileSync("git", ["-C", modelDir, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
})();
const snapshot = buildSnapshot({ files: readDir(modelDir), schemas: readDir(coreDir), sub: values.sub, commit, repo: values.repo ?? null });
await createServer(snapshot).connect(new StdioServerTransport());
```

Run `chmod +x bin/stdio.mjs`.

- [ ] **Step 4: Run to see it pass**

Run: `node --test test/bin-stdio.test.mjs` Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add bin/stdio.mjs test/bin-stdio.test.mjs
git commit -F - <<'EOF'
The stdio entry point

companygraph-mcp serves a model directory and its core over stdio, building the snapshot in memory and taking the commit from the directory's repository where there is one. This is the local form an agent launches from an instance's root. The test drives it through the SDK's stdio client.

Verified: `node --test test/bin-stdio.test.mjs` 1 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 9: The HTTP server — `lib/http.mjs`, `bin/http.mjs`

**Files:**

- Create: `lib/http.mjs`, `bin/http.mjs`, `test/http.test.mjs`

**Interfaces:**

- Consumes: `createServer`, `provenance`; `NodeStreamableHTTPServerTransport` from `@modelcontextprotocol/node`.
- Produces: `createHttpServer(snapshot, { allowedHosts?: string[] }) → http.Server`; `companygraph-mcp-http --snapshot file [--port n]` with `PORT` and `MCP_ALLOWED_HOSTS` read from the environment.

- [ ] **Step 1: Write the failing tests**

`test/http.test.mjs`:

```js
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpServer } from "../lib/http.mjs";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const s = exampleSnapshot();
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } };
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function listen(opts) {
  const server = createHttpServer(s, opts);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  after(() => server.close());
  return base;
}

test("POST /mcp answers JSON, statelessly, uncached", async () => {
  const base = await listen();
  const r = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal(r.headers.get("mcp-session-id"), null);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const body = await r.json();
  assert.equal(body.result.serverInfo.title, "Beacon Systems");
  const call = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_types", arguments: {} } }) });
  assert.equal((await call.json()).result.structuredContent.model.commit, COMMIT);
});

test("the SDK client lists seven tools over HTTP", async () => {
  const base = await listen();
  const client = new Client({ name: "t", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  assert.equal((await client.listTools()).tools.length, 7);
  await client.close();
});

test("other methods and paths", async () => {
  const base = await listen();
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/mcp`, { method: "DELETE" })).status, 405);
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
  const h = await fetch(`${base}/healthz`);
  assert.equal(h.status, 200);
  assert.equal(h.headers.get("cache-control"), "no-store");
  assert.deepEqual((await h.json()).model, { commit: COMMIT, repo: "companygraph/meta-model", core: "0.25.2", parser: "v0.25.2" });
});

test("a Host outside the allowed list is refused, an allowed one served", async () => {
  const base = await listen({ allowedHosts: ["mcp.example"] });
  const bad = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(bad.status, 403);
  const good = await fetch(`${base}/mcp`, { method: "POST", headers: { ...headers, host: "mcp.example" }, body: JSON.stringify(INIT) });
  assert.equal(good.status, 200);
});
```

If Node's `fetch` refuses to send a custom `host` header in the last test, send that request with `node:http` (`http.request({ host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { ...headers, host: "mcp.example" } })`) and assert on the status code.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/http.test.mjs` Expected: FAIL, cannot find module `../lib/http.mjs`.

- [ ] **Step 3: Implement**

`lib/http.mjs`:

```js
// One snapshot over Streamable HTTP with no session: a fresh transport and a fresh server per
// request, JSON responses rather than a stream, nothing cached. GET and DELETE have no meaning
// without a session and say so. A Host outside the allowed list is refused before the
// transport sees it; unset, nothing is checked, which is the local case.
import http from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer } from "./server.mjs";
import { provenance } from "./model.mjs";

export function createHttpServer(snapshot, { allowedHosts = null } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, model: provenance(snapshot) }) + "\n");
      return;
    }
    if (pathname !== "/mcp") { res.writeHead(404).end(); return; }
    if (allowedHosts && !allowedHosts.includes(req.headers.host ?? "")) {
      res.writeHead(403, { "Content-Type": "text/plain" }).end("host not allowed\n");
      return;
    }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await createServer(snapshot).connect(transport);
    await transport.handleRequest(req, res);
  });
}
```

`bin/http.mjs`:

```js
#!/usr/bin/env node
// Serves a baked snapshot. PORT is what Cloud Run sets; MCP_ALLOWED_HOSTS is the comma-separated
// list of hostnames a deployment answers to, and unset means any, for a local run.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { createHttpServer } from "../lib/http.mjs";

const { values } = parseArgs({ options: { snapshot: { type: "string" }, port: { type: "string" } } });
if (!values.snapshot) { console.error("usage: companygraph-mcp-http --snapshot file [--port n]"); process.exit(2); }
const snapshot = JSON.parse(fs.readFileSync(values.snapshot, "utf8"));
const port = Number(values.port ?? process.env.PORT ?? 8080);
const allowedHosts = process.env.MCP_ALLOWED_HOSTS ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean) : null;
createHttpServer(snapshot, { allowedHosts }).listen(port, "0.0.0.0", () => {
  console.log(`companygraph-mcp-http on :${port}, commit ${snapshot.commit ?? "(none)"}, core ${snapshot.core.version}, hosts ${allowedHosts ? allowedHosts.join(" ") : "any"}`);
});
```

Run `chmod +x bin/http.mjs`.

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/http.test.mjs` Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add lib/http.mjs bin/http.mjs test/http.test.mjs
git commit -F - <<'EOF'
The HTTP server

lib/http.mjs serves one snapshot over Streamable HTTP with no session: a fresh transport and server per POST to /mcp, JSON responses, Cache-Control no-store on everything, 405 for the methods a session would need, a /healthz that reports the model, and a Host check against an allowed list where a deployment sets one. bin/http.mjs reads the snapshot file, PORT and MCP_ALLOWED_HOSTS. The tests speak raw JSON-RPC for the headers and the SDK's HTTP client for the tool list.

Verified: `node --test test/http.test.mjs` 4 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 10: The reference instance, real values

**Files:**

- Create: `test/instance.test.mjs`

**Interfaces:**

- Consumes: `instanceSnapshot()` and `INSTANCE_COMMIT` from helpers; the queries from Tasks 4 and 5; `createServer` from Task 6.

The values below are what `robertblust/mental-model` holds at `2fd146f`. They are test data pinned with the fixture; a change to them is a change to the fixture commit, made on purpose.

- [ ] **Step 1: Write the tests**

`test/instance.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { ModelError, listTypes, listEntities, getEntity, findEvidence, search, fetchEntity } from "../lib/model.mjs";
import { createServer } from "../lib/server.mjs";
import { instanceSnapshot, INSTANCE_COMMIT } from "./helpers.mjs";

const s = instanceSnapshot();

test("the instance parses to what its site publishes", () => {
  assert.equal(s.root, "Robert Blust");
  assert.equal(s.rootId, "identity");
  assert.equal(s.entities.length, 143);
  assert.equal(s.edges.length, 608);
  assert.equal(listTypes(s).types.length, 15);
  assert.deepEqual(listTypes(s).model, { commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", core: "0.25.2", parser: "v0.25.2" });
});

test("the company of one: the identity and the profile share a name, and a bare name is refused", () => {
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && /R2/.test(e.message) && /identity/.test(e.message) && /profile/.test(e.message));
  assert.equal(fetchEntity(s, "profiles/robert-blust").title, "Robert Blust");
});

test("which skills are Expert, and on what evidence", () => {
  const profile = getEntity(s, "profile", "Robert Blust").entity;
  const expert = profile.references.filter((r) => r.via === "Skills.Skill" && r.attrs.Level.name === "Expert");
  assert.equal(expert.length, 27);
  assert.ok(expert.some((r) => r.name === "Agentic AI development"));
  const ev = findEvidence(s, "Agentic AI development");
  const claim = ev.evidence.profile.find((x) => x.id === "profiles/robert-blust");
  assert.equal(claim.attrs.Level.name, "Expert");
  assert.ok(claim.attrs.Evidence.startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  assert.ok(ev.evidence.experience.length >= 1);
});

test("what was built at LIKE MAGIC", () => {
  const hits = search(s, "LIKE MAGIC").results;
  assert.ok(hits.some((r) => r.id === "profiles/robert-blust/experiences/2022-likemagic"));
  const e = getEntity(s, "experience", "Co-Founder & Head of Technology").entity;
  assert.equal(e.id, "profiles/robert-blust/experiences/2022-likemagic");
  assert.equal(e.fields.organization, "LIKE MAGIC AG");
  assert.deepEqual(e.stamp, { kind: "Role", start: "2022-04", end: "2026-05" });
  assert.ok(e.sections.some((x) => x.heading === "Achievements"));
});

test("what he holds to", () => {
  const values = listEntities(s, "value").entities.map((v) => v.name);
  assert.deepEqual(values, ["Build the alternative before making the point", "Decide well over build fast", "Grow the people with the platform", "Model it before you build it", "Production is the finish line"]);
});

test("the server introduces the instance by its own words", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  assert.equal(client.getServerVersion().title, "Robert Blust");
  const vision = s.entities.find((e) => e.type === "vision");
  assert.ok(client.getInstructions().startsWith(vision.tagline));
  assert.match(client.getInstructions(), new RegExp(INSTANCE_COMMIT));
  await client.close();
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/instance.test.mjs` Expected: 6 pass. A failing count or value is a finding about the parser or the queries, not a number to edit: `s.entities.length` must equal what `parseInstance` returns, and the site pinned at this commit publishes 143 entities and 608 edges. If `e.fields.organization` arrives resolved rather than as the string, the experience schema declares it a reference: assert on `e.references.find((r) => r.via === "organization").name` instead and say so in the commit.

- [ ] **Step 3: Commit**

```bash
sh conventions/conventions-check
git add test/instance.test.mjs
git commit -F - <<'EOF'
The reference instance, real values

The suite runs the queries and the server against robertblust/mental-model at 2fd146f, the commit the fixtures pin: the counts its site publishes, the identity and the profile that share one name and the refusal that pair earns, the twenty-seven Expert skills and the Evidence one of them carries verbatim, the LIKE MAGIC experience by search and by name, the five values, and the instructions the server writes from the vision's own tagline. The values are test data pinned with the fixture.

Verified: `node --test test/instance.test.mjs` 6 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 11: Portability guard, README, pull request

**Files:**

- Create: `test/portability.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write the portability test**

`test/portability.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exampleSnapshot, instanceSnapshot } from "./helpers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["lib", "bin"].flatMap((d) => fs.readdirSync(path.join(root, d)).map((f) => path.join(d, f)));

test("lib/ and bin/ name no entity of the example and no fact of the reference instance", () => {
  const names = (snap) => snap.entities.map((e) => e.name).filter((n) => n.length > 3);
  const forbidden = [...names(exampleSnapshot()), ...names(instanceSnapshot()), "blust.ch", "mental-model"];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const word of forbidden) assert.ok(!text.includes(word), `${file} names "${word}"`);
  }
});
```

Run: `node --test test/portability.test.mjs`. Expected: PASS. If it fails, the hit is a defect to remove from the source, not a word to remove from the list.

- [ ] **Step 2: Run the whole suite**

Run: `npm test` Expected: every file passes; the fixtures step reports `already present`.

- [ ] **Step 3: Write the README**

Replace `README.md` (the title line stays exactly `# CompanyGraph — MCP Server`):

```markdown
# CompanyGraph — MCP Server

A read-only MCP server for any CompanyGraph instance. An agent connects to it and asks about
the company the way a person would read the model: which types it declares, what one entity
says, what evidence a profile gives for a skill. Every answer is what the model says at one
commit, verbatim, and the server adds nothing of its own.

It serves a snapshot parsed at build time with the meta-model's own parser, so a new type in
core appears here with no change to this package, and it knows no instance-specific type, name
or fact. The reference instance runs it at `mcp.blust.ch`; the deployment is
`robertblust/mcp-blust-ch`.

## Tools

| Tool | Returns |
| --- | --- |
| `list_types` | every type the instance's schemas declare, with its tagline |
| `describe_schema(type)` | the schema's frontmatter, sections, purpose and writing rules |
| `list_entities(type)` | the canonical names and taglines of one type |
| `get_entity(type, name)` | one entity with every reference it makes and receives |
| `find_evidence(skill)` | each profile's claimed level and Evidence for the skill, and every experience that lists it |
| `search(query)` | matching entities across types |
| `fetch(id)` | one entity by the id `search` returned, with its page as written |

A name resolves within a type. A lookup without a type that finds a name under more than one
type refuses and names the types. Every answer carries the model commit, the core version and
the parser's tag.

## Running it

From an instance's root, over stdio:

```sh
npx github:companygraph/mcp-server ./model ./meta/core
```

A snapshot for a deployment, then the HTTP server on it:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp-snapshot --github owner/name@<sha> --out snapshot.json
npx --package github:companygraph/mcp-server companygraph-mcp-http --snapshot snapshot.json
```

The HTTP server is stateless Streamable HTTP with JSON responses on `POST /mcp`, `no-store`, and a `/healthz`. `PORT` and `MCP_ALLOWED_HOSTS` come from the environment.

## Tests

`npm test` fetches `companygraph/meta-model` at the tag `package.json` pins and `robertblust/mental-model` at a named commit into `test/fixtures/`, and runs every tool against the worked example and the reference instance.

## License

Apache 2.0. See `LICENSE`.

```

- [ ] **Step 4: Check and commit**

```bash
sh conventions/conventions-check
git add test/portability.test.mjs README.md
git commit -F - <<'EOF'
The portability guard and the README

A test reads lib/ and bin/ for the name of any entity in the worked example or in the reference instance, and for the instance's domain and repository, and fails on a hit: the package serves any instance and names none. The README says what the server is, the seven tools, how to run it over stdio from an instance and over HTTP from a snapshot, and how the tests get their fixtures.

Verified: `npm test` passes every file; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 5: Open the pull request and stop**

```bash
git push -u origin build
gh pr create --title "The server" --body "$(cat <<'EOF'
The CompanyGraph MCP server as its design describes it. lib/read.mjs reads a model from a directory or a GitHub commit; lib/snapshot.mjs feeds it to the meta-model's parser, imported by tag, and adds the commit, the core version from the core's manifest, the parser's tag, the parsed schemas and each page verbatim; lib/model.mjs answers the seven queries with no I/O, resolving a name within its type and refusing a bare name two types hold; lib/tools.mjs and lib/server.mjs put them on an McpServer titled after the identity with instructions from the vision and identity taglines; three binaries write a snapshot, serve stdio and serve stateless Streamable HTTP with JSON responses. The suite runs every tool against the worked example at v0.25.2 and against the reference instance at a pinned commit with its real values, tests the refusal on the instance's own shared name, and greps the source for any instance fact.

Verified: `npm test` passes every file, `sh conventions/conventions-check` passes, and the MCP Inspector connects to `node bin/stdio.mjs <model> <core>` and lists seven tools.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Before the pull request body claims the Inspector check, run it: `npx @modelcontextprotocol/inspector --cli node bin/stdio.mjs test/fixtures/meta-model/example/model test/fixtures/meta-model/core --sub example/model/ --method tools/list` and confirm seven tools. If the Inspector's CLI flags differ, run the Inspector UI instead and record what was seen. Merging is the owner's call; do not merge.

---

## Self-review

- **Spec coverage.** §3 shape: Tasks 1, 2, 3, 4–5, 6, 7, 8, 9. §4 snapshot: Task 3, both CLI forms in Task 7. §5 tools and refusals: Tasks 4, 5, 6, with `list_types` count, `describe_schema` sections, `get_entity` references both ways, `find_evidence` grouped with attributes verbatim, `search` fields and order, `fetch` id-then-name with refusal. §6 server naming: Task 6, including the no-vision case. §7 transports: Tasks 8 and 9, stateless JSON, `no-store`, 405, `/healthz`, host list. §8 tests: every bullet has a test, the reference instance in Task 10, the portability grep in Task 11. §9 family: conventions check before every commit, prose register, PR left open. §10: the meta-model proposal is recorded in the spec and needs no task.
- **Placeholders.** None. One deliberate variance in Task 4's last test is called out and resolved in the step text.
- **Type consistency.** `provenance(s)` is exported from `lib/model.mjs` and used by `lib/http.mjs`; `fileUrl` returns `null` without repo or commit and the tests always pass both; `ref(e)` yields `{ id, type, name }` everywhere; `attrs` values are either strings or `{ id, type, name }`; `search` results carry `title`, and the sort uses it.
