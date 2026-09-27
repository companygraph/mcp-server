# A diagram tool implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new tool `diagram` answers Mermaid source for part of the model, built from the snapshot's edges, in three shapes: `concepts`, `process` and `neighborhood`.

**Architecture:** One new pure module, `lib/diagram.mjs`, builds the source from `allEdges`, `requireId` and `requireType`, which `lib/model.mjs` starts exporting. The tool is registered like every other, answers under a strict output schema, and refuses with the existing codes plus one new code, `cannot_draw`. The interface document, the contract's sample calls and the README follow.

**Tech Stack:** Node 22+, `node:test`, zod 4, `@modelcontextprotocol/client` for the contract tests, `companygraph-meta-model` (the parser, pinned by tag). No dependency is added.

**Spec:** `companygraph/chat-server`, branch `an-answer-can-show-a-diagram`, `docs/superpowers/specs/2026-09-27-an-answer-can-show-a-diagram-design.md`, section 2. Read it before any task; its sections 3 to 5 are the chat's and the widget's and are not built here.

## Global Constraints

- **One repository, one branch.** The worktree exists: `~/git/companygraph/mcp-server-a-diagram-tool`, branch `a-diagram-tool`, carrying this plan. The clone at `~/git/companygraph/mcp-server` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-diagram-tool`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test`, which fetches the fixtures first. `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before every commit.
- **Shapes:** exactly `concepts`, `process`, `neighborhood`, American spelling, declared once as `SHAPES` in `lib/schemas.mjs`.
- **The cap:** `DIAGRAM_CAP = 50` nodes besides a neighborhood's middle. A `concepts` or `process` diagram over it is refused as `cannot_draw` with `reason: "too_large"`; one with nothing to draw as `cannot_draw` with `reason: "empty"`; a neighborhood leaves out whole `via` groups, smallest first kept, and names them on a last node `more`.
- **The answer:** `{ shape, title, mermaid, nodes, edges, omitted, model }`, `nodes` each `{ node, id, title, type }` with `node` = `n0`, `n1`, … in the order drawn. `title` is the process's, entity's or domain's name, and null for every concept. No `click` line in any source.
- **A process node** is `<b>` + the phase's escaped title + `</b>`, then `<br/>` and who executes it; **a neighborhood's middle** is `<b>` + its escaped title + `</b>`. These are the only tags the source ever writes, and strict mode draws them (seen in the preview of 2026-09-27). Every other label is text.
- **Labels** go through `label()`: `#` → `#35;` first, then `"` → `#quot;`, `<` → `#lt;`, `>` → `#gt;`, a line break → a space. A concept outside the drawn domain is labeled `<its name> · <its domain's name>`; a class annotation (`<<…>>`) is never written, because Mermaid 12 refuses an escaped character inside one (found by rendering, see Task 3).
- **The tool description stays within sixty words** and contains `Returns `; `test/descriptions.test.mjs` holds it.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. After every commit, `git log -1 --format='[%s]'` shows the subject alone. The pull request body the same register, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, deployed or deleted by an agent.** The last task pushes, opens the pull request and stops. `package.json`'s version is not moved; the release is the owner's.
- **No count or version of something that still moves** in any prose or comment.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.

### Rulings the plan makes where the spec is silent

- **Phase order** is the process's Phases table, column `Phase`, each name matched to a phase the process owns, and a phase named twice is drawn once. A process with no Phases table is `empty`.
- **Gate arrows** are drawn only between two drawn phases, in the order of the phase they leave.
- **A self-reference** (an edge from the middle to itself) is not drawn in a neighborhood. In a concepts diagram a concept's Relations row naming itself is drawn, as Mermaid draws a loop.
- **An entity both referenced and referencing** is one node with two arrows, declared once.
- **Group order** in a neighborhood: fewest far entities first, then outgoing before incoming, then `via` by code point. Within a group, far entities by name, then id.
- **The `more` node** reads `+<omitted>: <via>, <via>` in group order; it is linked to the middle with `-.-` and is not in `nodes`.
- **The `concepts` diagram with `id`, and `process` or `neighborhood` with `domain`,** are refused as `invalid_argument` naming the argument, not ignored.
- **Sample call** for a deployment's suite: `{ shape: "neighborhood", id: s.rootId }`, which every instance can answer.
- **The interface example** is `{ shape: "process", id: "processes/delivery" }` on the worked example.

## Review Focus

1. **A title holding Mermaid's own syntax** (`"`, `<`, `>`, `#`, `-->`, brackets): the node shows the title as text and nothing else is drawn. Task 1 builds a concept titled `Partner "A" <B> #1 --> C` and holds its escaped label.
2. **An entity that references itself**: no arrow from the middle to the middle, and no node twice. Task 1 builds `Loop`, whose Relations names itself.
3. **An entity reached both ways** by one `via`: one node, two arrows. Task 1's `Loop` and `Partner` relate to each other.
4. **Two rows drawing the same edge** (Contract names Customer twice): one arrow, labeled `×2`. Task 1 holds the Contract neighborhood.
5. **A domain's concept pointing at a concept that belongs to no domain**: the stray is drawn by its title alone, with no `·` and nothing after it. Task 2 builds `Priced`, in Pricing, naming `Stray`, which has no domain. (A Phases row naming a phase no file holds cannot reach the tool: the parser refuses it under R4 before a snapshot exists.)

---

### Task 1: The three pictures, built from the snapshot

**Files:**

- Create: `lib/diagram.mjs`
- Modify: `lib/model.mjs` (export `requireType`, `allEdges`, `requireId`)
- Modify: `lib/schemas.mjs` (add `SHAPES` after `count`)
- Modify: `test/helpers.mjs` (add `withHub`, `withLoops`, `ODD`)
- Test: `test/diagram.test.mjs`

**Interfaces:**

- Consumes: `provenance(s)`, `ModelError`, the parser's snapshot shape (`entities` with `id`, `type`, `name`, `owner`, `fields`, `sections[].tables[].columns/rows`).
- Produces: `diagram(s, { shape, id?, domain? }) → { shape, title, mermaid, nodes: [{ node, id, title, type }], edges, omitted, model }`; `label(text) → string`; `DIAGRAM_CAP = 50`; `SHAPES` from `lib/schemas.mjs`; `allEdges`, `requireId`, `requireType` from `lib/model.mjs`; helpers `withHub({ out, into })`, `withLoops()`, `ODD`.

- [ ] **Step 1: Export the three helpers from the query layer**

In `lib/model.mjs` change the three declarations, and nothing else in them:

```js
export const requireType = (s, type) => {
```

```js
export const allEdges = (s) => {
```

```js
export const requireId = (s, id) => {
```

- [ ] **Step 2: Name the shapes once**

In `lib/schemas.mjs`, directly after `const count = z.number().int().nonnegative();`:

```js

// The diagrams the `diagram` tool draws, named once for its input, its answer and its refusal.
export const SHAPES = ["concepts", "process", "neighborhood"];
```

- [ ] **Step 3: Add the built fixtures**

Append to `test/helpers.mjs`:

```js
// Concepts made for the diagram tests, in the example's own form: a page, a tagline, and a
// Relations table naming other concepts by title. The example holds no concept with more than a
// handful of edges, none that names itself, and no title with Mermaid's own syntax in it.
const concept = (name, related) => `---\nsource: Local\n---\n\n# ${name}\n\n> A concept made for a test.\n`
  + (related.length ? `\n## Relations\n\n| Concept | Cardinality | As |\n| --- | --- | --- |\n${related.map((r) => `| ${r} | one | |`).join("\n")}\n` : "");

const built = (files, schemas) => buildSnapshot({ files, schemas, sub: "example/model/", core: "core/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });

// A concept, Hub, that names `out` leaves and is named by `into` feeders: past the cap when
// `out` is large, and exactly at it when the leaves, the feeders and its source make fifty.
export function withHub({ out = 60, into = 5 } = {}) {
  const { files, schemas } = exampleFiles();
  const leaves = Array.from({ length: out }, (_, i) => `Leaf ${String(i).padStart(2, "0")}`);
  files.set("concepts/hub.md", concept("Hub", leaves));
  leaves.forEach((name, i) => files.set(`concepts/leaf-${String(i).padStart(2, "0")}.md`, concept(name, [])));
  for (let i = 0; i < into; i++) files.set(`concepts/feeder-${i}.md`, concept(`Feeder ${i}`, ["Hub"]));
  return built(files, schemas);
}

// Loop names itself and Partner; Partner names Loop back, under a title full of Mermaid syntax.
export const ODD = 'Partner "A" <B> #1 --> C';
export function withLoops() {
  const { files, schemas } = exampleFiles();
  files.set("concepts/loop.md", concept("Loop", ["Loop", ODD]));
  files.set("concepts/partner.md", concept(ODD, ["Loop"]));
  return built(files, schemas);
}
```

- [ ] **Step 4: Write the failing tests**

Create `test/diagram.test.mjs`:

```js
// The diagram tool's pictures, over the worked example and over fixtures built for what the
// example does not hold. A shape's whole source is compared, because a client draws exactly what
// is sent and a line out of place is a different picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diagram, label, DIAGRAM_CAP } from "../lib/diagram.mjs";
import { ModelError } from "../lib/errors.mjs";
import { exampleSnapshot, instanceSnapshot, withHub, withLoops, ODD, COMMIT } from "./helpers.mjs";

const s = exampleSnapshot();
const lines = (d) => d.mermaid.split("\n");
const ids = (d) => d.nodes.map((n) => [n.node, n.id]);
const refused = (fn, code, details) => assert.throws(fn, (e) => {
  assert.ok(e instanceof ModelError, String(e));
  assert.equal(e.code, code);
  if (details) assert.deepEqual(e.details, details);
  return true;
});

test("a label escapes Mermaid's own characters, the hash first", () => {
  assert.equal(label('A "b" <c> #d\n  e'), "A #quot;b#quot; #lt;c#gt; #35;d e");
  assert.equal(label("x --> y"), "x --#gt; y");
});

test("every concept, with each Relations row an association labeled with its cardinality and role", () => {
  const d = diagram(s, { shape: "concepts" });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["concepts", null, 11, 0, COMMIT]);
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["Billing period"]', '  class n1["Contract"]', '  class n2["Credit note"]', '  class n3["Customer"]',
    '  class n4["Invoice"]', '  class n5["Invoice line"]', '  class n6["Pricing rule"]', '  class n7["Usage record"]',
    "  n1 --> n3 : one, signing customer", "  n1 --> n3 : maybe one, paying customer", "  n1 --> n6 : one to many, terms",
    "  n2 --> n4 : one, corrected invoice", "  n2 --> n5 : one to many, lines", "  n4 --> n0 : one",
    "  n4 --> n3 : one, billed customer", "  n4 --> n5 : one to many, lines", "  n5 --> n6 : one, rule",
    "  n5 --> n7 : many, usage read", "  n7 --> n1 : one",
  ]);
  assert.deepEqual(d.nodes[4], { node: "n4", id: "concepts/invoice", title: "Invoice", type: "concept" });
});

test("a domain draws its concepts, and one outside it that they reach carries its own domain's name", () => {
  const d = diagram(s, { shape: "concepts", domain: "domains/invoicing" });
  assert.deepEqual([d.title, d.edges], ["Invoicing", 7]);
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["Billing period"]', '  class n1["Credit note"]', '  class n2["Invoice"]', '  class n3["Invoice line"]',
    '  class n4["Customer · Pricing"]', '  class n5["Pricing rule · Pricing"]', '  class n6["Usage record · Pricing"]',
    "  n1 --> n2 : one, corrected invoice", "  n1 --> n3 : one to many, lines", "  n2 --> n0 : one",
    "  n2 --> n4 : one, billed customer", "  n2 --> n3 : one to many, lines", "  n3 --> n5 : one, rule", "  n3 --> n6 : many, usage read",
  ]);
  assert.deepEqual(d.nodes[4], { node: "n4", id: "concepts/customer", title: "Customer", type: "concept" });
});

test("a process draws its phases in its table's order, who executes each, and each gate with its approvers", () => {
  const d = diagram(s, { shape: "process", id: "processes/delivery" });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Delivery", 2, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<b>Specify</b><br/>Backend Engineer"]', '  n1["<b>Build</b><br/>Backend Engineer, Reviewer"]', '  n2["<b>Release</b><br/>Reviewer"]',
    '  n0 -->|"Reviewer"| n1', '  n1 -->|"Reviewer"| n2',
  ]);
  assert.deepEqual(ids(d), [["n0", "processes/delivery/phases/specify"], ["n1", "processes/delivery/phases/build"], ["n2", "processes/delivery/phases/release"]]);
});

test("a neighborhood draws one hop both ways, the smallest groups first", () => {
  const d = diagram(s, { shape: "neighborhood", id: "concepts/invoice" });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Invoice", 8, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<b>Invoice</b>"]', '  n1["Invoicing"]', '  n2["Local"]', '  n3["Credit note"]', '  n4["Billing run"]',
    '  n5["Credit notes"]', '  n6["Billing period"]', '  n7["Customer"]', '  n8["Invoice line"]',
    '  n0 -->|"domain"| n1', '  n0 -->|"source"| n2', '  n3 -->|"Relations.Concept"| n0', '  n4 -->|"concepts"| n0',
    '  n5 -->|"concepts"| n0', '  n0 -->|"Relations.Concept"| n6', '  n0 -->|"Relations.Concept"| n7', '  n0 -->|"Relations.Concept"| n8',
  ]);
  assert.deepEqual(d.nodes[0], { node: "n0", id: "concepts/invoice", title: "Invoice", type: "concept" });
});

test("two rows drawing one edge are one arrow that says how many", () => {
  const d = diagram(s, { shape: "neighborhood", id: "concepts/contract" });
  assert.ok(lines(d).includes('  n0 -->|"Relations.Concept ×2"| n4'), d.mermaid);
  assert.equal(d.nodes[4].id, "concepts/customer");
  assert.equal(d.edges, 9);
});

test("past the cap a neighborhood leaves out the largest group whole and names it", () => {
  const d = diagram(withHub({ out: 60, into: 5 }), { shape: "neighborhood", id: "concepts/hub" });
  assert.deepEqual([d.nodes.length, d.edges, d.omitted], [7, 6, 60]);
  assert.deepEqual(lines(d).slice(-2), ['  more["+60: Relations.Concept"]', "  n0 -.- more"]);
  assert.ok(!d.nodes.some((n) => n.node === "more"));
});

test("at the cap nothing is left out", () => {
  const d = diagram(withHub({ out: DIAGRAM_CAP - 6, into: 5 }), { shape: "neighborhood", id: "concepts/hub" });
  assert.deepEqual([d.nodes.length, d.omitted], [DIAGRAM_CAP + 1, 0]);
  assert.ok(!d.mermaid.includes("more"));
});

test("a busy entity of the reference instance is drawn within the cap and says what it left out", () => {
  const i = instanceSnapshot();
  const d = diagram(i, { shape: "neighborhood", id: "profiles/robert-blust" });
  assert.ok(d.nodes.length <= DIAGRAM_CAP + 1, `${d.nodes.length} nodes`);
  assert.ok(d.omitted > 0);
  assert.equal(lines(d).at(-1), "  n0 -.- more");
});

test("a self-reference is not drawn, an entity reached both ways is one node, and an odd title stays a label", () => {
  const d = diagram(withLoops(), { shape: "neighborhood", id: "concepts/loop" });
  const odd = label(ODD);
  assert.equal(odd, "Partner #quot;A#quot; #lt;B#gt; #35;1 --#gt; C");
  assert.deepEqual(lines(d), [
    "flowchart LR", '  n0["<b>Loop</b>"]', `  n1["${odd}"]`, '  n2["Local"]',
    '  n0 -->|"Relations.Concept"| n1', '  n0 -->|"source"| n2', '  n1 -->|"Relations.Concept"| n0',
  ]);
  assert.equal(d.nodes[1].title, ODD, "nodes carry the title as written, not escaped");
});

test("the arguments each shape does not take, needs or cannot use are refused by name", () => {
  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood" });
  refused(() => diagram(s, { shape: "concepts", id: "concepts/invoice" }), "invalid_argument", { argument: "id", reason: "not taken by concepts" });
  refused(() => diagram(s, { shape: "process", id: "processes/delivery", domain: "domains/pricing" }), "invalid_argument", { argument: "domain", reason: "not taken by process" });
  refused(() => diagram(s, { shape: "neighborhood" }), "invalid_argument", { argument: "id", reason: "needed by neighborhood" });
  refused(() => diagram(s, { shape: "process", id: "concepts/invoice" }), "invalid_argument", { argument: "id", reason: "not a process" });
  refused(() => diagram(s, { shape: "concepts", domain: "concepts/invoice" }), "invalid_argument", { argument: "domain", reason: "not a domain" });
  refused(() => diagram(s, { shape: "process", id: "nothing/here" }), "unknown_entity", { id: "nothing/here" });
  refused(() => diagram(instanceSnapshot(), { shape: "concepts" }), "unknown_type");
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `node --test test/diagram.test.mjs`

Expected: FAIL, `Cannot find module '…/lib/diagram.mjs'`.

- [ ] **Step 6: Write the module**

Create `lib/diagram.mjs`:

```js
// A picture of part of the model, as Mermaid source, built from the snapshot's edges and never
// from prose, so every node is an entity at the served commit and every arrow an edge the model
// draws. Three shapes: the concepts and their Relations, one process's phases in their order,
// and one entity with everything one hop from it. The source names its nodes n0, n1 and on, and
// `nodes` says which entity each one is, so a client links a node without reading the source.
// A label is a title escaped for Mermaid; nothing here is worded in any one language, so a
// client captions the picture in its reader's.
import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { provenance, allEdges, requireId, requireType } from "./model.mjs";

// How many nodes a picture holds besides the neighborhood's middle. Past it a neighborhood
// leaves out whole groups of edges and says which.
export const DIAGRAM_CAP = 50;

// Mermaid reads `#name;` and `#number;` as a character, so a title's own `#` goes first, and a
// quote, an angle bracket and a line break can then never close a label or start an arrow.
export const label = (text) => String(text)
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/\s*[\r\n]+\s*/g, " ");

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byName = (a, b) => cmp(a.name, b.name) || cmp(a.id, b.id);
// A qualifier the parser resolved arrives as the entity it names, and a plain one as its text.
const text = (v) => (v && typeof v === "object" ? v.name : typeof v === "string" ? v : "");
const names = (v) => [v].flat().filter((x) => typeof x === "string" && x.trim());

const notA = (argument, e, type) => new ModelError("invalid_argument", `${argument} names ${e.id}, which is a ${e.type} and not a ${type}`,
  { details: { argument, reason: `not a ${type}` } });

// Each entity drawn gets the next node name, once, however many edges reach it.
function namer() {
  const nodes = [], at = new Map();
  const of = (e) => {
    if (!at.has(e.id)) { at.set(e.id, `n${nodes.length}`); nodes.push({ node: `n${nodes.length}`, id: e.id, title: e.name, type: e.type }); }
    return at.get(e.id);
  };
  return { nodes, of };
}

function concepts(s, domain) {
  requireType(s, "concept");
  let dom = null;
  if (domain !== undefined) {
    dom = requireId(s, domain);
    if (dom.type !== "domain") throw notA("domain", dom, "domain");
  }
  const edges = allEdges(s);
  const domainOf = new Map(edges.filter((x) => x.via === "domain" && x.from.type === "concept").map((x) => [x.from.id, x.to]));
  const inside = s.entities.filter((e) => e.type === "concept" && (!dom || domainOf.get(e.id)?.id === dom.id)).sort(byName);
  const insideIds = new Set(inside.map((e) => e.id));
  const relations = edges.filter((x) => x.via === "Relations.Concept" && insideIds.has(x.from.id));
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  const outside = [...new Set(relations.map((x) => x.to.id).filter((id) => !insideIds.has(id)))].map((id) => byId.get(id)).sort(byName);
  const drawn = [...inside, ...outside];
  const { nodes, of } = namer();
  const lines = ["classDiagram"];
  // A concept from another domain carries that domain's name after its own, in the label: a
  // class annotation would say the same, but Mermaid does not read an escaped character there.
  const outsideIds = new Set(outside.map((e) => e.id));
  for (const e of drawn) {
    const home = outsideIds.has(e.id) ? domainOf.get(e.id) : null;
    lines.push(`  class ${of(e)}["${label(home ? `${e.name} · ${home.name}` : e.name)}"]`);
  }
  for (const x of relations) {
    const said = [text(x.attrs.Cardinality), text(x.attrs.As)].filter((v) => v.trim()).map(label).join(", ");
    lines.push(`  ${of(x.from)} --> ${of(x.to)}${said ? ` : ${said}` : ""}`);
  }
  return { title: dom ? dom.name : null, mermaid: lines.join("\n"), nodes, edges: relations.length, omitted: 0 };
}

function process(s, id) {
  requireType(s, "phase");
  const p = requireId(s, id);
  if (p.type !== "process") throw notA("id", p, "process");
  // The phases' order is the process's own table: the edges it draws are sorted by id.
  const table = p.sections.find((x) => x.heading === "Phases")?.tables?.[0];
  const col = table ? table.columns.indexOf("Phase") : -1;
  const owned = s.entities.filter((e) => e.type === "phase" && e.owner === p.id);
  const phases = (col < 0 ? [] : table.rows.map((r) => r[col]))
    .map((name) => owned.find((e) => e.name === name)).filter((e, i, all) => e && all.indexOf(e) === i);
  const { nodes, of } = namer();
  const lines = ["flowchart LR"];
  for (const e of phases) {
    const who = names(e.fields["executed-by"]).map(label).join(", ");
    // The phase's name is the node's heading and who executes it the line under it; `<b>` and
    // `<br/>` are the two tags written here, and a title is escaped, so no title makes one.
    lines.push(`  ${of(e)}["<b>${label(e.name)}</b>${who ? `<br/>${who}` : ""}"]`);
  }
  const drawnIds = new Set(phases.map((e) => e.id));
  const order = (x) => phases.findIndex((e) => e.id === x.from.id);
  const gates = allEdges(s).filter((x) => x.via === "gate-to" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id)).sort((a, b) => order(a) - order(b));
  const byId = new Map(phases.map((e) => [e.id, e]));
  for (const x of gates) {
    const approvers = names(byId.get(x.from.id).fields["gate-approvers"]).map(label).join(", ");
    lines.push(`  ${of(x.from)} -->${approvers ? `|"${approvers}"|` : ""} ${of(x.to)}`);
  }
  return { title: p.name, mermaid: lines.join("\n"), nodes, edges: gates.length, omitted: 0 };
}

// The edges between the middle and one entity by one `via` are one arrow; the arrows of one
// `via` and one direction are a group. Groups are taken smallest first and whole, while their
// entities fit, so an entity's many kinds of connection are drawn before the one it has most
// of; a group that does not fit is left out whole and named on a last node.
function neighborhood(s, id) {
  const e = requireId(s, id);
  const arrows = new Map();
  for (const x of allEdges(s)) {
    const out = x.from.id === e.id, into = x.to.id === e.id;
    if (!(out || into) || (out && into)) continue;
    const far = out ? x.to : x.from;
    const key = `${out ? ">" : "<"}\u0000${x.via}\u0000${far.id}`;
    const arrow = arrows.get(key) ?? { out, via: x.via, far, count: 0 };
    arrow.count++;
    arrows.set(key, arrow);
  }
  const groups = new Map();
  for (const a of arrows.values()) {
    const key = `${a.out ? ">" : "<"}\u0000${a.via}`;
    if (!groups.has(key)) groups.set(key, { out: a.out, via: a.via, arrows: [] });
    groups.get(key).arrows.push(a);
  }
  const ordered = [...groups.values()].sort((a, b) => a.arrows.length - b.arrows.length || Number(b.out) - Number(a.out) || cmp(a.via, b.via));
  const kept = [], left = [], far = new Set();
  for (const g of ordered) {
    const fresh = new Set(g.arrows.map((a) => a.far.id).filter((x) => !far.has(x)));
    if (far.size + fresh.size <= DIAGRAM_CAP) { kept.push(g); for (const x of fresh) far.add(x); }
    else left.push(g);
  }
  const { nodes, of } = namer();
  // The middle is the one the picture is of, so its name is set in bold, as a phase's is.
  const lines = ["flowchart LR", `  ${of(e)}["<b>${label(e.name)}</b>"]`];
  const sorted = (g) => [...g.arrows].sort((x, y) => byName(x.far, y.far));
  // An entity both referenced and referencing is one node with two arrows, declared once.
  const declared = new Set([e.id]);
  for (const g of kept) for (const a of sorted(g)) if (!declared.has(a.far.id)) { declared.add(a.far.id); lines.push(`  ${of(a.far)}["${label(a.far.name)}"]`); }
  let edges = 0;
  for (const g of kept) {
    for (const a of sorted(g)) {
      const said = label(a.count > 1 ? `${a.via} ×${a.count}` : a.via);
      lines.push(a.out ? `  ${of(e)} -->|"${said}"| ${of(a.far)}` : `  ${of(a.far)} -->|"${said}"| ${of(e)}`);
      edges += a.count;
    }
  }
  const omitted = left.reduce((n, g) => n + g.arrows.reduce((m, a) => m + a.count, 0), 0);
  if (left.length) {
    lines.push(`  more["${label(`+${omitted}: ${left.map((g) => g.via).join(", ")}`)}"]`);
    lines.push(`  ${of(e)} -.- more`);
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, edges, omitted };
}

export function diagram(s, { shape, id, domain } = {}) {
  if (!SHAPES.includes(shape)) throw new ModelError("invalid_argument", `shape is one of ${SHAPES.join(", ")}`, { details: { argument: "shape", reason: `one of ${SHAPES.join(", ")}` } });
  if (shape === "concepts" && id !== undefined) throw new ModelError("invalid_argument", "the concepts diagram takes no id; name a domain to draw part of it", { details: { argument: "id", reason: "not taken by concepts" } });
  if (shape !== "concepts" && domain !== undefined) throw new ModelError("invalid_argument", `the ${shape} diagram takes no domain`, { details: { argument: "domain", reason: `not taken by ${shape}` } });
  if (shape !== "concepts" && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? process(s, id) : neighborhood(s, id);
  return { shape, ...drawn, model: provenance(s) };
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `node --test test/diagram.test.mjs`

Expected: PASS, 11 tests. Then `npm test`; expected: every test passes, since nothing yet serves the module.

- [ ] **Step 8: Check and commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add lib/diagram.mjs lib/model.mjs lib/schemas.mjs test/helpers.mjs test/diagram.test.mjs
git commit -F - <<'EOF'
The model can be drawn as Mermaid from its own edges

A reader asking how the concepts relate, or how a process runs, gets a table of titles, because nothing turns the edges into a picture. A new module builds Mermaid source from the snapshot in three shapes: every concept with its Relations as labeled associations, one process's phases in its table's order with each gate, and one entity with everything one hop from it, capped at fifty nodes by leaving out whole groups of edges, the largest first, and naming them.

Every node is an entity at the served commit and the answer says which one each node is, so a client links a node without reading the source back; every title is escaped for Mermaid, so a title holding a quote or an arrow stays a label.

Verified: node --test test/diagram.test.mjs and npm test pass; conventions-check and conventions-format check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Replace the `Verified:` line with what actually ran if anything differs.

---

### Task 2: The tool, its refusal and its contract

**Files:**

- Modify: `lib/errors.mjs` (code `cannot_draw` and its `WHEN`)
- Modify: `lib/schemas.mjs` (`DETAILS.cannot_draw`, `OUTPUTS.diagram`)
- Modify: `lib/diagram.mjs` (the `cannot` refusal and its four checks)
- Modify: `lib/tools.mjs` (the tool)
- Modify: `lib/contract.mjs` (the sample call)
- Modify: `scripts/interface.mjs` (the example)
- Modify: `docs/INTERFACE.md` (the section, the refusal row, the Which tool paragraph), then regenerate
- Modify: `README.md` (the tools table)
- Modify: `test/helpers.mjs` (add `withNothingToDraw`)
- Test: `test/diagram.test.mjs`, `test/errors.test.mjs`, `test/server.test.mjs`, `test/schemas.test.mjs`, `test/contract.test.mjs`, `test/descriptions.test.mjs`

**Interfaces:**

- Consumes: `diagram`, `DIAGRAM_CAP`, `SHAPES` from Task 1.
- Produces: the MCP tool `diagram` with input `{ shape: "concepts"|"process"|"neighborhood", id?: string, domain?: string }` and output `OUTPUTS.diagram`; error code `cannot_draw`, details `{ shape, reason: "too_large"|"empty", nodes, limit }`; `sampleCalls(s).diagram = { shape: "neighborhood", id: s.rootId }`; helper `withNothingToDraw()`.

- [ ] **Step 1: Add the built fixture for nothing to draw**

Append to `test/helpers.mjs`:

```js
// A domain no concept names, a process with no phases yet, and a concept in Pricing that names
// a concept of no domain at all.
export function withNothingToDraw() {
  const { files, schemas } = exampleFiles();
  files.set("domains/support.md", "---\nsource: Local\n---\n\n# Support\n\n> A domain made for a test, which no concept names.\n");
  files.set("processes/intake/intake.md", "---\nsource: Local\n---\n\n# Intake\n\n> A process made for a test, which has no phases yet.\n");
  files.set("concepts/stray.md", concept("Stray", []));
  files.set("concepts/priced.md", concept("Priced", ["Stray"]).replace("source: Local\n", "source: Local\ndomain: Pricing\n"));
  return built(files, schemas);
}
```

- [ ] **Step 2: Write the failing tests**

In `test/diagram.test.mjs` add `withNothingToDraw` to the helpers import, and append:

```js
test("a diagram with nothing to draw, or more than it holds, is refused rather than cut", () => {
  const n = withNothingToDraw();
  refused(() => diagram(n, { shape: "concepts", domain: "domains/support" }), "cannot_draw", { shape: "concepts", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(n, { shape: "process", id: "processes/intake" }), "cannot_draw", { shape: "process", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(withHub({ out: 60, into: 5 }), { shape: "concepts" }), "cannot_draw", { shape: "concepts", reason: "too_large", nodes: 74, limit: DIAGRAM_CAP });
});

test("a concept outside the domain that belongs to no domain is drawn by its title alone", () => {
  const d = diagram(withNothingToDraw(), { shape: "concepts", domain: "domains/pricing" });
  const stray = d.nodes.find((n) => n.id === "concepts/stray");
  assert.ok(d.mermaid.split("\n").includes(`  class ${stray.node}["Stray"]`), d.mermaid);
});
```

In `test/errors.test.mjs` line 17, the list gains `"cannot_draw"` at its end:

```js
  assert.deepEqual(CODES, ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot", "cannot_draw"]);
```

In `test/server.test.mjs`, the exact names gain `"diagram"` in sorted place:

```js
  assert.deepEqual(tools.map((t) => t.name).sort(), ["describe_errors", "describe_relations", "describe_rule", "describe_schema", "diagram", "fetch", "find_evidence", "get_entity", "list_checks", "list_entities", "list_references", "list_rules", "list_types", "search"]);
```

and the `calls` list of the structured-content test gains, after `["fetch", { id: "skills/domain-driven-design" }],`:

```js
    ["diagram", { shape: "process", id: "processes/delivery" }],
```

In `test/schemas.test.mjs`, import `import { diagram } from "../lib/diagram.mjs";` and add to `answers`, after `fetch: model.fetchEntity(s, "identity"),`:

```js
      diagram: diagram(s, { shape: "neighborhood", id: s.rootId }),
```

In `test/contract.test.mjs`, import `withNothingToDraw` from `./helpers.mjs`; add to `CASES`, after the `find_evidence` row:

```js
      ["diagram", { shape: "process", id: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["diagram", { shape: "neighborhood" }, "invalid_argument", (d) => d.argument === "id"],
      ["diagram", { shape: "graph" }, "invalid_argument", (d) => d.argument === "shape"],
```

and add, before the test `a snapshot that predates what a tool reads is refused by code`:

```js
test("a diagram with nothing to draw is refused by code, with what it would have drawn", async () => {
  const client = await connect(withNothingToDraw());
  const { error } = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "process", id: "processes/intake" } }));
  assert.deepEqual([error.code, error.details], ["cannot_draw", { shape: "process", reason: "empty", nodes: 0, limit: 50 }]);
  reached.add(error.code);
  await client.close();
});
```

In `test/descriptions.test.mjs`, add to the sibling test `a paged tool says how to continue, and a tool with a sibling names it`:

```js
  assert.match(of("diagram"), /\blist_references\b/);
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test`

Expected: FAIL: `diagram.test.mjs` on `cannot_draw` (`"cannot_draw" is no error code` or no throw), `errors.test.mjs` on the list, `server.test.mjs` on the names, `schemas.test.mjs` on the keys, `contract.test.mjs` on the unknown tool, `descriptions.test.mjs` on the missing tool.

- [ ] **Step 4: The code and its refusal**

In `lib/errors.mjs`, `CODES` gains `"cannot_draw"` at its end, and `WHEN` gains:

```js
  cannot_draw: "a diagram would draw nothing, or more nodes than it holds",
```

In `lib/schemas.mjs`, `DETAILS` gains after `unsupported_snapshot`:

```js
  cannot_draw: z.strictObject({ shape: z.enum(SHAPES), reason: z.enum(["too_large", "empty"]), nodes: count, limit: count }),
```

and `OUTPUTS` gains after `fetch`:

```js
  diagram: answer({
    shape: z.enum(SHAPES), title: z.string().nullable(), mermaid: z.string(),
    nodes: z.array(z.strictObject({ node: z.string(), id: z.string(), title: z.string(), type: z.string() })),
    edges: count, omitted: count,
  }),
```

In `lib/diagram.mjs`, replace the comment above `DIAGRAM_CAP` with:

```js
// How many nodes a picture holds besides the neighborhood's middle. Past it a concepts or a
// process diagram is refused, since a cut one would draw edges that are not all there, and a
// neighborhood leaves out whole groups of edges and says which.
```

add after `names`:

```js
const cannot = (shape, reason, nodes) => new ModelError("cannot_draw",
  reason === "empty"
    ? `the ${shape} diagram would draw nothing`
    : `the ${shape} diagram would draw ${nodes} nodes, more than the ${DIAGRAM_CAP} one holds${shape === "concepts" ? "; name a domain to draw part of it" : ""}`,
  { details: { shape, reason, nodes, limit: DIAGRAM_CAP } });
```

in `concepts`, directly after `const drawn = [...inside, ...outside];`:

```js
  if (drawn.length === 0) throw cannot("concepts", "empty", 0);
  if (drawn.length > DIAGRAM_CAP) throw cannot("concepts", "too_large", drawn.length);
```

and in `process`, directly after the `phases` declaration:

```js
  if (phases.length === 0) throw cannot("process", "empty", 0);
  if (phases.length > DIAGRAM_CAP) throw cannot("process", "too_large", phases.length);
```

- [ ] **Step 5: The tool and its sample call**

In `lib/tools.mjs`, import `import { diagram } from "./diagram.mjs";` and `SHAPES` beside `OUTPUTS` (`import { OUTPUTS, SHAPES } from "./schemas.mjs";`), and append to `TOOLS` after `fetch`:

```js
  { name: "diagram",
    description: "A picture of part of the model as Mermaid source, built from its edges. Use to show how things connect; for the edges as data use list_references. Input: `shape` (concepts, process, neighborhood); `id` for process and neighborhood; optional `domain` for concepts. Returns `mermaid`, `nodes` mapping each node to an entity, `title`, `edges`, `omitted`. At most 50 nodes.",
    input: z.object({ shape: z.enum(SHAPES), id: z.string().optional().describe("The process to draw, or the entity at the middle of a neighborhood"), domain: z.string().optional().describe("A domain's id, to draw its concepts") }),
    call: (s, args) => diagram(s, args),
    output: OUTPUTS.diagram },
```

In `lib/contract.mjs`, the returned object gains after `fetch: { id: s.rootId },`:

```js
    diagram: { shape: "neighborhood", id: s.rootId },
```

- [ ] **Step 6: The interface document**

In `scripts/interface.mjs`, `EXAMPLES` gains after the `fetch` row:

```js
  "`diagram`": { name: "diagram", arguments: { shape: "process", id: "processes/delivery" } },
```

In `docs/INTERFACE.md`, append to the paragraph under `## Which tool`:

```markdown
 `diagram` draws part of the model as Mermaid, for a client that shows a picture rather than lists the edges.
```

(joined to the paragraph's last sentence with a single space, so the paragraph stays one line). Insert before `## Paging`:

````markdown
### `diagram`

A picture of part of the model as Mermaid source, built from its edges and never from prose. `shape` is `concepts`, `process` or `neighborhood`. `concepts` is a class diagram of every concept and the associations their Relations tables draw, each labeled with its Cardinality and its As; `domain`, a domain's id, narrows it to that domain's concepts and any concept outside it they reach, labeled with its own domain's name after its title. `process` takes the `id` of a process and draws its phases in the order of its Phases table, each with who executes it, and an arrow for each `gate-to`, labeled with the gate's approvers. `neighborhood` takes any `id` and draws that entity with everything one hop from it, one arrow for each `via` and far entity, labeled with the `via` and, where several edges stand behind it, how many.

`nodes` says which entity each node of the source is, `n0` and on in the order drawn, so a client links a node without reading the source back; `title` is the name of what is drawn, null for every concept; `edges` counts the edges drawn and `omitted` those left out. A picture holds fifty nodes besides a neighborhood's middle. A neighborhood takes its groups of arrows smallest first, leaves out whole any group that does not fit, and names those on a last node, `more`, which is not in `nodes`. A concepts or process diagram that would hold more is refused as `cannot_draw` with `reason: "too_large"`, and one with nothing to draw with `reason: "empty"`.

```json
{}
```

````

In the table under `## Refusals`, after the `unsupported_snapshot` row:

```markdown
| `cannot_draw` | a diagram would draw nothing, or more nodes than it holds | `shape`, `reason`: `too_large` or `empty`, `nodes`, `limit` |
```

Then run: `npm run interface`

Expected: exit 0, and `docs/INTERFACE.md` now holds the call and its answer under `### \`diagram\``, abbreviated by the document's rule.

In `README.md`, the tools table gains after the `fetch` row:

```markdown
| `diagram` | part of the model as Mermaid: the concepts, a process, or one entity's neighborhood |
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npm test`

Expected: PASS, every file. `test/interface.test.mjs` holds the regenerated examples; `test/contract.test.mjs`'s last test sees `cannot_draw` among the codes reached.

- [ ] **Step 8: Check and commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add lib test scripts docs/INTERFACE.md README.md
git commit -F - <<'EOF'
A diagram tool draws the concepts, a process or a neighborhood

The pictures the model can be drawn as are served as a tool, diagram, under a strict answer schema, in the contract's sample calls, and in the interface document with a real call on the worked example. A concepts or process diagram that would draw nothing, or more than fifty nodes, is refused with a new code, cannot_draw, whose details say which and how many, rather than cut, since a cut diagram draws edges that are not all there.

A deployment's suite calls the tool with the neighborhood of its root, which every instance can answer.

Verified: npm test passes, the interface examples regenerated by npm run interface; conventions-check and conventions-format check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 3: Rendered once in a browser, then the pull request

A test here compares source; only Mermaid can say the source draws. This task renders what the tool answers in Chromium with the Mermaid release the widget will vendor, and fixes the generator if anything fails to parse. Nothing of it is committed.

**Files:** none committed, unless a render fails, in which case the fix goes to `lib/diagram.mjs` with a test in `test/diagram.test.mjs` as a new commit.

- [ ] **Step 1: Fetch Mermaid 12.0.0 into a scratch directory**

```bash
export PATH=/opt/homebrew/bin:$PATH
SCRATCH=$(mktemp -d)
curl -sf -o "$SCRATCH/mermaid.min.js" https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js
ls -l "$SCRATCH/mermaid.min.js"
```

Expected: a file of about 5.5 MB.

- [ ] **Step 2: Dump every shape the tests hold, and the escaping cases**

Write `$SCRATCH/dump.mjs`, run from the worktree root as `node "$SCRATCH/dump.mjs" "$SCRATCH"`:

```js
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const { diagram } = await import(pathToFileURL(path.join(root, "lib/diagram.mjs")).href);
const h = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const s = h.exampleSnapshot();
const out = {
  concepts: diagram(s, { shape: "concepts" }),
  domain: diagram(s, { shape: "concepts", domain: "domains/invoicing" }),
  process: diagram(s, { shape: "process", id: "processes/delivery" }),
  neighborhood: diagram(s, { shape: "neighborhood", id: "concepts/contract" }),
  capped: diagram(h.withHub({ out: 60, into: 5 }), { shape: "neighborhood", id: "concepts/hub" }),
  odd: diagram(h.withLoops(), { shape: "neighborhood", id: "concepts/loop" }),
  oddClass: diagram(h.withLoops(), { shape: "concepts" }),
  busy: diagram(h.instanceSnapshot(), { shape: "neighborhood", id: "profiles/robert-blust" }),
};
fs.writeFileSync(path.join(process.argv[2], "diagrams.json"), JSON.stringify(out));
console.log(Object.keys(out).join(" "));
```

- [ ] **Step 3: Render each in Chromium**

Playwright is installed in the site clone beside this one. Write `$SCRATCH/render.mjs` and run `node "$SCRATCH/render.mjs" "$SCRATCH"`:

```js
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/rob/git/robertblust/robertblust.github.io/node_modules/playwright/index.mjs";
const dir = process.argv[2];
const all = JSON.parse(fs.readFileSync(path.join(dir, "diagrams.json"), "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body><div id=out></div></body></html>");
await page.addScriptTag({ path: path.join(dir, "mermaid.min.js") });
let failed = 0;
for (const [name, d] of Object.entries(all)) {
  const r = await page.evaluate(async ({ name, d }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" });
    try {
      const { svg } = await mermaid.render("d_" + name, d.mermaid);
      const box = document.getElementById("out"); box.innerHTML = svg;
      const missing = d.nodes.filter((n) => ![...box.querySelectorAll("g[id]")].some((g) => new RegExp(`-(classId|flowchart)-${n.node}-\\d+$`).test(g.id)));
      const wrong = d.nodes.filter((n) => { const g = [...box.querySelectorAll("g[id]")].find((x) => new RegExp(`-(classId|flowchart)-${n.node}-\\d+$`).test(x.id)); return g && !g.textContent.includes(n.title.split(" · ")[0]); });
      return { ok: missing.length === 0 && wrong.length === 0, missing: missing.map((n) => n.node), wrong: wrong.map((n) => n.node) };
    } catch (e) { return { ok: false, err: String(e.message || e).slice(0, 300) }; }
  }, { name, d });
  if (!r.ok) failed++;
  console.log(name, JSON.stringify(r));
}
await browser.close();
process.exit(failed ? 1 : 0);
```

Expected: every line `{"ok":true,"missing":[],"wrong":[]}`, exit 0. Each node is found by the id Mermaid gives it, and its text holds the entity's title as written, which is what shows the escaping round-trips.

- [ ] **Step 4: If a render fails**

Write a test in `test/diagram.test.mjs` that pins the source line that failed to its corrected form, fix `lib/diagram.mjs`, run `npm test`, re-run Steps 2 and 3, and commit the fix on its own in the git register. Otherwise go on.

- [ ] **Step 5: Push and open the pull request**

```bash
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-diagram-tool
gh pr list --repo companygraph/mcp-server --state merged --limit 2 --json number
```

Read both of those bodies with `gh pr view <n> --repo companygraph/mcp-server --json body` and write this one in their register: prose, no headings, no bullets, no checkboxes. Open it:

```bash
gh pr create --repo companygraph/mcp-server --base main --head a-diagram-tool --title "A diagram tool draws the concepts, a process or a neighborhood" --body-file <file>
```

The body says: the gap (a reader asking how things relate gets titles, and the chat that will draw the picture needs an edge it can trust); what changed (the three shapes, the answer's `nodes`, the cap and `cannot_draw`); what it costs downstream (a minor release, the three MCP hosts re-pinned to it before the chat's release that asks for the tool, and every deployment's suite calling it through the sample call); the render check of Task 3 by name, with the Mermaid release it used; a line `Release notes to write at tagging: …` in one sentence; `Verified:` naming `npm test`, the conventions checks and the render; then the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line.

- [ ] **Step 6: Stop**

Report the pull request's URL, the test count, and the render lines. Do not merge, tag or re-pin.
