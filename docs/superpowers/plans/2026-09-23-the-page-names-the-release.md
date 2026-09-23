# The page names the release implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The page a browser gets and the `/health` body both name the release of this package that is serving, read from the same `package.json` the handshake reads, and a deployment's shared tests hold both to the tag it pins.

**Architecture:** `lib/page.mjs` reads `package.json` once, as `lib/server.mjs` does, exports the pair as `SERVER` and takes `server: { name, version }` as an option of `renderPage` defaulting to it; the lede under "What it reads" ends "served by <name> v<version>". `lib/http.mjs` writes the same pair into the health body as `server`, additive beside `ok` and `model`. `deploy/test/pin.mjs` gains one case that starts the deployment's own server and holds the served page and the health body to the tag `package.json` pins, and the suite's deployment harness runs the pin tests over a fixture deployment so the case is exercised here and not only in a deployment.

**Tech Stack:** Node 22+, `node:test`, `@modelcontextprotocol/client` for the contract tests, Playwright for the page tests. No dependency is added.

**Spec:** `docs/superpowers/specs/2026-09-23-the-page-names-the-release-design.md` (this branch). Read it before any task.

## Global constraints

- **One repository, one branch.** The worktree exists: `~/git/companygraph/mcp-server-the-page-names-the-release`, branch `the-page-names-the-release`, carrying the spec and this plan; pull request #56 is open on it. The clone at `~/git/companygraph/mcp-server` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test`, which fetches the fixtures first and opens a browser for the page tests. `sh conventions/conventions-check` and `sh conventions/conventions-format` exit 0 before every commit.
- **The spec decides, and this plan does not reopen:** the clause reads "served by companygraph-mcp-server v0.26.0" with the `v` the tags write; the option is `server: { name, version }` and defaults to the package's own; the health field is `server: { name, version }` and everything the body carried stays; the handshake's `instructions` still name no version, held by `test/server.test.mjs`; the page says nothing new about the model.
- **The version moves in this branch** to `0.27.0`, the next minor after `main`'s `0.26.0`, by the owner's instruction. Additive: no tool, argument, answer or error moves, `docs/INTERFACE.md` does not describe the page or the health body, so the release notes carry no `Interface` heading and `npm run interface` is not run.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The pull request body the same, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, deployed or deleted by an agent.** The last task pushes, updates #56's body and stops.
- **No count or version of something that still moves** in any prose or comment. A test reads the version from `package.json`, never types it.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.

### Rulings the plan makes where the spec is silent

1. **The README sentence the spec names does not exist.** §3 and §5 speak of "the README's own sentence about the deploy, that a GET proves the route and never the release". `README.md` on `main` at `4c46e3b` carries no such sentence: the word "proves" occurs nowhere in the repository's prose outside the spec itself. The nearest sentences are line 43, which lists what `GET /` carries, and line 59, which says a shared test holds a deployment's three pins to one. Task 4 changes those two to say what is now true, and the pull request body says the named sentence was not found and asks whether the owner meant another file, since a deployment's own README is outside this repository and this task.
2. **`lib/http.mjs` takes the pair from `lib/page.mjs`.** The spec has `lib/page.mjs` read the package; the health handler imports `SERVER` from there rather than reading the file a third time, so the page and the body cannot disagree. `createHttpServer` gains no option for it: a deployment never hands its own release in, and the test seam is `renderPage`'s option.
3. **The deployment case lives in `deploy/test/pin.mjs`, inside `registerPinTests`**, because "beside the pin test" is where a deployment's owner looks for what holds its release, and the tag it compares against is the one that function already reads. It starts `createHttpServer` over the deployment's snapshot with no stylesheet and no browser: the clause and the body are text, and the browser tests in `deploy/test/page.mjs` are about layout.
4. **The suite runs the pin tests over a fixture deployment.** `test/deploy-tools.test.mjs` today builds a temporary deployment and runs the shared tools tests in it, so a change to a tool cannot pass here and break every deployment; the pin tests ship unrun the same way. Task 3 extends that harness: the fixture gains a `package.json` pinning this package at its own version, a workflow and a module naming the same tag, and a `node_modules` in which this package is reachable by name, and the suite asserts the pin tests pass there and fail when the fixture pins another release. The rule stays the harness's: nothing a deployment does changes.
5. **The route row on the page for `/health` is unchanged.** It says the path answers whether the server is up and the model commit it answers from; both stay true, and the spec's §7 keeps the page's words about the model where they are.

---

### Task 0: A working tree that passes

**Files:** none changed.

- [ ] **Step 1: Install and fetch fixtures**

```sh
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/companygraph/mcp-server-the-page-names-the-release
git config user.email
npm ci
```

Expected: the address is `robert.blust@flatland.ch`; `npm ci` exits 0.

- [ ] **Step 2: Run the suite as the baseline**

Run: `npm test; echo "exit $?"`

Expected: `exit 0`, and the summary's `skipped` count is the deploy tools tests' by-name skips only. A failure that remains is reported before any task starts; it is not worked around.

- [ ] **Step 3: Commit this plan**

```sh
sh conventions/conventions-format; echo "exit $?"
git add docs/superpowers/plans/2026-09-23-the-page-names-the-release.md
git commit
```

Message subject: `The plan for the release on the page`. Body: one paragraph saying the plan builds the spec task by task, test first, that the README sentence the spec names was not found and how the plan treats that, and where the plan stops; a `Verified:` line naming conventions-format; the trailer.

---

### Task 1: The lede names the release

**Files:**

- Modify: `lib/page.mjs` (the imports, the signature of `renderPage`, the "What it reads" paragraph)
- Test: `test/page-contract.test.mjs`

**Interfaces:**

- Produces: `export const SERVER = { name, version }`, read from `package.json`; `renderPage(snapshot, { origin, css, icon, brand, jsonld, server = SERVER })`, where `server` is `{ name: string, version: string }` and the rendered page contains `served by ${name} v${version}` in the `.lede` paragraph under "What it reads".

- [ ] **Step 1: Write the failing test**

Append to `test/page-contract.test.mjs`, after the README test:

```js
// The one fact about the server a reader could not check: which release is answering. The
// handshake names it from package.json, and the page names it from the same file, so a
// deployment's pin, the handshake and the page agree by construction. A test hands its own
// pair in to show the option is the seam and the package is only the default.
test("the page names the release that serves it, from the package unless one is handed in", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(html.includes(`served by ${pkg.name} v${pkg.version}.`), "the lede ends with the package's own name and version");
  const other = renderPage(exampleSnapshot(), { origin: "https://example.test", server: { name: "x", version: "9.9.9" } });
  assert.ok(other.includes("served by x v9.9.9."), "a server handed in is the one named");
  assert.ok(!other.includes(pkg.version), "and the package's own version is then nowhere on the page");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/page-contract.test.mjs; echo "exit $?"`

Expected: exit 1; the new test fails on "the lede ends with the package's own name and version". The four older tests still pass.

- [ ] **Step 3: Read the package and write the clause**

In `lib/page.mjs`, add `fs` to the imports and read the package beside them, with the comment saying why the page reads it itself:

```js
import fs from "node:fs";
import { provenance } from "./model.mjs";
import { noteFor } from "./server.mjs";
import { TOOLS } from "./tools.mjs";

// The release of this package, read from the file the handshake reads. A person who opens the
// page has no client to read `serverInfo` from, and a deployment's pin is the one thing a
// reader could not check against the page until the page named it; read here rather than
// handed in, so the page and the handshake cannot say two things.
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const SERVER = { name: pkg.name, version: pkg.version };
```

Change the signature:

```js
export function renderPage(snapshot, { origin, css = null, icon = null, brand = null, jsonld = null, server = SERVER }) {
```

Change the "What it reads" paragraph so the sentence ends with the server:

```html
      <h2>What it reads</h2>
      <p class="lede">A snapshot of ${source}, parsed at build time against the core that
        instance vendored, core ${esc(model.core)} with parser ${esc(model.parser)}, served by
        ${esc(server.name)} v${esc(server.version)}. Every answer carries that commit, so an
        answer can be checked against the files it came from.</p>
```

- [ ] **Step 4: Run the file and the neighbors**

Run: `node --test test/page-contract.test.mjs test/http.test.mjs test/server.test.mjs test/portability.test.mjs; echo "exit $?"`

Expected: exit 0. `portability.test.mjs` forbids the capitalized project name in `lib/`; `companygraph-mcp-server` is lowercase and passes. `server.test.mjs` still holds the instructions to name no version.

- [ ] **Step 5: Commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add lib/page.mjs test/page-contract.test.mjs
git commit
```

Subject: `The page names the release that serves it`. Body: why the page could not say it before, that it reads the package as the handshake does and takes the pair as an option a test can hand in; `Verified:` naming the four test files; the trailer.

---

### Task 2: The health body names the release

**Files:**

- Modify: `lib/http.mjs` (the import from `./page.mjs`, the `/health` handler, the header comment's line on `/health`)
- Test: `test/http.test.mjs`

**Interfaces:**

- Consumes: `SERVER` from `lib/page.mjs` (Task 1).
- Produces: `GET /health` answers `{ ok: true, model: provenance(snapshot), server: { name, version } }`.

- [ ] **Step 1: Write the failing test**

Add to `test/http.test.mjs`, after the "other methods and paths" test, with `fs` imported at the top of the file (`import fs from "node:fs";`):

```js
// A person with curl and no client can check a deployment's release against its pin in one
// line. The field is additive: whoever read ok and model reads what they read.
test("/health names the release that serves it, beside what it answered before", async () => {
  const base = await listen();
  const body = await (await fetch(`${base}/health`)).json();
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(body).sort(), ["model", "ok", "server"]);
  assert.equal(body.ok, true);
  assert.deepEqual(body.server, { name: pkg.name, version: pkg.version });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/http.test.mjs; echo "exit $?"`

Expected: exit 1; the new test fails on the keys, `["model", "ok"]` against `["model", "ok", "server"]`.

- [ ] **Step 3: Write the field**

In `lib/http.mjs`, import the pair beside `renderPage` and write it into the body:

```js
import { renderPage, SERVER } from "./page.mjs";
```

```js
    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, model: provenance(snapshot), server: SERVER }) + "\n");
      return;
    }
```

In the header comment, the sentence "/health is for the deployment" becomes "/health is for the deployment and for anyone checking which model and which release answer".

- [ ] **Step 4: Run the file**

Run: `node --test test/http.test.mjs; echo "exit $?"`

Expected: exit 0. The "other methods and paths" test compares `model` alone and is untouched.

- [ ] **Step 5: Commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add lib/http.mjs test/http.test.mjs
git commit
```

Subject: `The health body names the release`. Body: why, that the pair is the page's so the two cannot disagree, that the field is additive; `Verified:`; the trailer.

---

### Task 3: A deployment holds its page and its health to its pin

**Files:**

- Modify: `deploy/test/pin.mjs` (imports, one new test inside `registerPinTests`)
- Modify: `test/deploy-tools.test.mjs` (the fixture deployment gains pins and a `node_modules` directory; two new suite tests)

**Interfaces:**

- Consumes: `createHttpServer` from `companygraph-mcp-server/http`, which `deploy/test/page.mjs` already imports the same way; `snapshot()` from `../build/config.mjs`.
- Produces: in a deployment's suite, one more test under `registerPinTests`, named "the served page and the health body name the release package.json pins".

- [ ] **Step 1: Extend the harness so the pin tests run here**

In `test/deploy-tools.test.mjs`, replace the `deployment` function with one that takes the tag the fixture pins and which shared registration to run, and add the two tests. The whole file after its imports:

```js
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
// installed, and now to the page and the health body that package serves. Run over a fixture
// that pins this checkout's own version, they pass; over one that pins another, every one of
// them fails, the served page and the health body among them.
test("the shared pin tests pass over a deployment that pins this release everywhere", () => {
  const r = deployment({ commit: COMMIT, tag: OWN, register: PIN });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok \d+ - the served page and the health body name the release package\.json pins/);
});

test("and fail over one that pins another release, so the served page is held to the pin", () => {
  const r = deployment({ commit: COMMIT, tag: "v0.0.1", register: PIN });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /not ok \d+ - the served page and the health body name the release package\.json pins/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/deploy-tools.test.mjs; echo "exit $?"`

Expected: exit 1. The two tools tests pass as before; "the shared pin tests pass" fails because no test of that name ran; "and fail over one that pins another release" fails on its `match`. If the tools tests fail instead, the `node_modules` of the fixture is wrong and the harness is fixed before anything else.

- [ ] **Step 3: Write the deployment case**

In `deploy/test/pin.mjs`, add the imports and the test inside `registerPinTests`, after the three-place test:

```js
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHttpServer } from "companygraph-mcp-server/http";
import { ROOT, snapshot } from "../build/config.mjs";
```

```js
  // The installed package's version is read from a file; what a deployment serves is what its
  // process answers, and the two are the same only if the image ran the package the tests read.
  // The page and the health body name the release from the package that is serving, so a
  // deployment that built green from a stale lockfile is visible to anyone who opens its page,
  // and this holds both to the tag the deployment pins.
  test("the served page and the health body name the release package.json pins", async () => {
    const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
    const server = createHttpServer(snapshot());
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    after(() => server.close());
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.server.name, "companygraph-mcp-server");
    assert.equal("v" + health.server.version, tag, `the health body names ${health.server.version}; package.json pins ${tag}`);
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes(`served by companygraph-mcp-server ${tag}.`), `the page does not say it is served by ${tag}`);
  });
```

- [ ] **Step 4: Run the harness**

Run: `node --test test/deploy-tools.test.mjs; echo "exit $?"`

Expected: exit 0, four tests passing.

- [ ] **Step 5: Commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add deploy/test/pin.mjs test/deploy-tools.test.mjs
git commit
```

Subject: `A deployment holds its served page and health body to its pin`. Body: why the case sits beside the pin test and what it would have shown on 2026-09-17; that the suite's harness now runs the pin tests over a fixture deployment, which it did not before, and how the fixture is built; `Verified:`; the trailer.

---

### Task 4: The README says what the page and the health body now name

**Files:**

- Modify: `README.md` (line 43, the list of what `GET /` carries; line 59, the sentence on the shared pin test)

- [ ] **Step 1: Change the two sentences**

Line 43: the clause "every tool with what it returns, and the commit the snapshot was built from" becomes "every tool with what it returns, the commit the snapshot was built from and the release of this package that is serving it, read from the same `package.json` the handshake reads". The next sentence, "It is rendered from the snapshot, so it says nothing this package knows about any particular instance and cannot fall out of step with what the tools answer.", stays: the release is what the package knows about itself, not about an instance. After it, add: "`/health` answers `ok`, the same provenance under `model` and the same release under `server`, so a person with `curl` and no client can check a deployment's release against its pin in one line."

Line 59: after "A shared test holds the three to one, so a deployment that moved one place alone fails it rather than building with one release's code and applying with another's infrastructure." add: "Another holds the page and the health body the deployment's own server answers to the same tag, so a deployment whose image ran an older package than every visible pin names is visible to anyone who opens its page."

- [ ] **Step 2: Run the README's own tests and the form**

Run: `node --test test/page-contract.test.mjs; echo "exit $?"` (the README names every class the page emits; no class moved), then `sh conventions/conventions-check; echo "exit $?"` and `sh conventions/conventions-format; echo "exit $?"`.

Expected: exit 0 each.

- [ ] **Step 3: Commit**

```sh
git add README.md
git commit
```

Subject: `The README says the page and the health body name the release`. Body: what the two sentences now say; that the spec named a sentence on what a deploy's GET proves that the README does not carry, and that the pull request asks about it; `Verified:`; the trailer.

---

### Task 5: The release is 0.27.0

**Files:**

- Modify: `package.json` (`version`), `package-lock.json` (its two copies of the version)

- [ ] **Step 1: Move the version**

Run: `npm version 0.27.0 --no-git-tag-version; echo "exit $?"`

Expected: exit 0; `git diff --stat` shows `package.json` and `package-lock.json` only.

- [ ] **Step 2: Run the whole suite**

Run: `npm test; echo "exit $?"`

Expected: exit 0; the skipped count is unchanged from Task 0's baseline, and the pass count is the baseline's plus the five tests this branch added (one in `page-contract`, one in `http`, two in `deploy-tools`, and the pin case counted inside the fixture run is not a test of this suite). Read the numbers and write them into the pull request body.

- [ ] **Step 3: Commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add package.json package-lock.json
git commit
```

Subject: `The release is 0.27.0`. Body: the next minor after 0.26.0, additive, what the notes will say at tagging; `Verified:` with the suite's counts; the trailer.

---

### Task 6: Push and describe the build

- [ ] **Step 1: Push**

```sh
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push
```

- [ ] **Step 2: Update #56's body**

`gh pr edit 56 --body-file <file>`, the body written to the scratchpad first. It keeps the opening paragraph the spec commit wrote, replaces the paragraph that said the pull request opens with the spec alone with the build: the lede clause and the option, the health field, the deployment case and the harness that now runs the pin tests here, the README's two sentences, the version. One paragraph says the README sentence the spec names was not found and asks whether another file was meant. One paragraph names the release notes to write at tagging, with no `Interface` heading. A `Verified:` line with the suite's counts and the conventions scripts, then the Claude Code line.

- [ ] **Step 3: Stop**

Merging, the tag and the two re-pins are the owner's.
