# A bounded context is drawn as its map and its aggregates implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `diagram` draws a bounded context's map (`context`) and its aggregates (`aggregate`), the widget shows every picture an answer brings, and the chat asks for both when a visitor asks about a context.

**Architecture:** Three repositories, one pull request each, in the order the spec's §7 releases them. In `companygraph/mcp-server`, `lib/diagram.mjs` gains `contextMap()` and `aggregates()`, read from the snapshot's edges as every shape is, and one escaping fix they need. In `robertblust/design`, `assets/chat.js` keeps every `diagram` event of a message, fits each picture when there are several, and writes a reading line under the two new shapes. In `companygraph/chat-server`, the note to the model and `DIAGRAM_RULE` change.

**Tech Stack:** Node 22+, `node:test`, zod 4, `@modelcontextprotocol/client`, `companygraph-meta-model` (the parser, pinned by tag), Mermaid 12.0.0 vendored in design, Playwright's Chromium (design's suite). No dependency is added.

**Spec:** `docs/superpowers/specs/2026-10-04-a-bounded-context-is-drawn-design.md` in `companygraph/mcp-server`, pull request #125. Read it before any task. Where this plan and the spec differ, this plan's rulings below say why.

## Global Constraints

- **One worktree per repository, beside its clone, from `main` once #125 and this plan are merged:** `~/git/companygraph/mcp-server-a-bounded-context-is-drawn-build` (branch `a-bounded-context-is-drawn-build`), `~/git/robertblust/design-every-picture-an-answer-brings` (branch `every-picture-an-answer-brings`), `~/git/companygraph/chat-server-a-bounded-context-is-asked-for` (branch `a-bounded-context-is-asked-for`). Each made with `git -C <clone> worktree add ../<name> -b <branch> origin/main`. A clone stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. In a fresh worktree run `npm ci` once, never a symlinked `node_modules`. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin <branch>`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **Tests:** in mcp-server a single file runs as `node --test test/<name>.test.mjs` after one `npm run fixtures`, the suite as `npm test`; in design and chat-server the suite is `npm test`. `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before every commit, in every repository.
- **Shapes:** `SHAPES` in `lib/schemas.mjs` becomes exactly `["concepts", "process", "neighborhood", "schema", "context", "aggregate"]`, the two new ones appended so no existing index moves.
- **The cap:** `DIAGRAM_CAP = 50` counts every node of both new shapes, the middle included. Over it, `cannot_draw` with `reason: "too_large"` and `nodes` the count.
- **Tags in a source:** `<small>`, `<br/>` and `<b>`, as today. A class annotation holds only one of `aggregate root`, `domain event`, or the concept design's `kind` (`entity` or `value object`), never a title: Mermaid 12 refuses an escaped character inside `<<…>>`.
- **The context map's arrow labels:** `U → D · ` followed by the pattern as the row writes it (the arrow character is U+2192); for `partnership`, `shared kernel` and `separate ways` the pattern alone, on a `<-->` arrow.
- **Cardinality at a member's end:** `one` → `1`, `maybe one` → `0..1`, `many` → `*`, `one to many` → `1..*`; none where the root's Relations names the member nowhere.
- **The tool description stays within sixty words**, contains `Returns ` and `list_references`; `test/descriptions.test.mjs` holds it.
- **Commits are the Implementer's:** `git commit --author "Implementer <implementer@companygraph.io>"` in the two companygraph repositories and `--author "Implementer <implementer@blust.ch>"` in design, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Before the first commit in a fresh worktree, check `git config core.hooksPath` reads `conventions/hooks`; if not, run `sh conventions/conventions-sync sync` once.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs, no headers, no bullets, no plan task numbers, a `Verified:` line naming what ran, then the trailers. Write the message to a file and commit with `-F`; after every commit `git log -1 --format='[%s]'` shows the subject alone. A pull request body is the same register, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; read the repository's last two merged bodies first.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, released, deployed or deleted by an agent.** Each repository's last task pushes, opens the pull request and stops. No `package.json` version moves.
- **No count or version of something that still moves** in prose or comments.
- **Comments in code say why**, in the register of the file around them: a short paragraph above the thing, present tense, no history.
- **lib/ names no entity of a fixture.** `test/portability.test.mjs` fails any file in `lib/` or `bin/` that contains the name of an entity of the worked example or the reference instance, `Context` among them, so a column such as `Relationships.Context` is read from the schemas, never written.

### Rulings the plan makes where the spec is silent

- **The escaping fix.** `unquoted()` in `lib/diagram.mjs` maps `:` and `;` after `label()` has run, so the `;` closing `label()`'s own `#quot;` becomes `#59;` and a role such as `the "glue"; a` draws as `the #quot#59;glue…`. The aggregate's member lines need the same escaping plus the two braces, so Task 2 rewrites `unquoted()` as one pass over every character. Rendered with the vendored Mermaid on 2026-10-04: `Note #quot;a#quot; #35;1#58; #123;x#125; : string` draws as `Note "a" #1: {x} : string`, and an association `one, #quot;x#quot; a#58; b#59; c` as `one, "x" a: b; c`.
- **The deployment test.** The spec's §5 holds every arrow label to "a pattern the pack declares or `U → D · `". The shared deployment test cannot read the pack's enum without a tool it does not import, so it holds that every node is a bounded context and every label is either `U → D · ` followed by text or one of the three symmetric patterns.
- **The chat's pin.** No chat-server test needs the new shapes: its loop tests draw with the worked example, which holds no bounded context. The pin of `companygraph-mcp-server` moves to the release only if it is out when Task 6 starts; the local measurement runs against the mcp-server build regardless.

## Review Focus

- **A context naming itself in its own Relationships** draws no arrow and no second node. Task 1 holds it.
- **A role holding a quote and a semicolon** (`the "glue"; a`) draws as written in every shape that writes associations, `concepts` included. Task 2 holds it.
- **A concept design that is the root of one aggregate and a member of another in the same context** is drawn once, annotated `aggregate root`, joined to both. Task 2 holds it.
- **A language switch while an answer shows two pictures** relabels both captions and both reading lines. Task 4 holds it.
- **An answer whose second picture Mermaid cannot render** keeps the first drawn and shows the source, with the sentence, for the second alone. Task 4 holds it.

---

## Part A — `companygraph/mcp-server`

### Task 1: The context map

**Files:**

- Modify: `test/helpers.mjs` (import `readSchemas`; add `CONTEXT_IDS`, `ODD_ATTRIBUTE`, `withContexts()` after `packInstanceDir`)
- Modify: `lib/diagram.mjs` (add `SYMMETRIC` and `contextMap()` above `TAKES`; widen `TAKES.id`; dispatch)
- Modify: `lib/schemas.mjs:13` (`SHAPES`)
- Test: `test/diagram.test.mjs`

**Interfaces:**

- Consumes: `requireType`, `requireId`, `allEdges`, `relationsOf` from `lib/model.mjs`; `namer`, `label`, `text`, `byName`, `cmp`, `cannot`, `notA` already in `lib/diagram.mjs`.
- Produces: `withContexts({ disagree = false, crowd = 0 } = {}) => snapshot`, `CONTEXT_IDS` (an object of ids by key), `ODD_ATTRIBUTE` from `test/helpers.mjs`, used by Tasks 2 and 3; `diagram(s, { shape: "context", id })` answering `{ shape: "context", title, mermaid, nodes, links, edges, omitted: 0, model }`.

- [ ] **Step 1: Add the fixture to `test/helpers.mjs`**

Change the import on line 5 to `import { readDir, readSchemas } from "../lib/read.mjs";`. After `packInstanceDir`, append:

```js
// Bounded contexts drawn as the software pack draws them: the pack instance with four contexts
// beside Quoting and two aggregates inside it. Quoting conforms to Catalog and shares a kernel
// with Invoicing, which names the kernel back, so the two rows draw one arrow; Ordering is
// Quoting's customer; Archive relates to nothing. `disagree` has Catalog name Quoting as a
// partner as well, which Quoting's own row contradicts. Quote holds a line, Money and a Discount
// its root names no cardinality for, reaches a Customer it does not hold, and emits two events;
// Price list holds Money too, so a context's aggregates share one Money. `crowd` adds that many
// contexts conforming to Quoting and as many value objects Quote holds, to reach the cap.
export const CONTEXT_IDS = {
  catalog: "01a0ffff-0000-7000-8000-000000000101", invoicing: "01a0ffff-0000-7000-8000-000000000102",
  ordering: "01a0ffff-0000-7000-8000-000000000103", archive: "01a0ffff-0000-7000-8000-000000000104",
  quote: "01a0ffff-0000-7000-8000-000000000111", priceList: "01a0ffff-0000-7000-8000-000000000112",
  quoteDesign: "01a0ffff-0000-7000-8000-000000000121", lineDesign: "01a0ffff-0000-7000-8000-000000000122",
  money: "01a0ffff-0000-7000-8000-000000000123", discount: "01a0ffff-0000-7000-8000-000000000124",
  customer: "01a0ffff-0000-7000-8000-000000000125", priceListDesign: "01a0ffff-0000-7000-8000-000000000126",
  sent: "01a0ffff-0000-7000-8000-000000000131", accepted: "01a0ffff-0000-7000-8000-000000000132",
};
export const ODD_ATTRIBUTE = 'Note "a" #1: {x}';
const C = CONTEXT_IDS;
const table = (head, rows) => `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
const context = (id, name, classification, relationships) =>
  `---\nid: ${id}\nsource: Local\nclassification: ${classification}\n---\n\n# ${name}\n\n> A context made for a test. What it leaves to another is not its point.\n\n## Responsibilities\n\n- Stand in a test\n${relationships.length ? `\n## Relationships\n\n${table(["Context", "Pattern"], relationships)}` : ""}`;
const design = (id, name, kind, attributes, relations) =>
  `---\nid: ${id}\nsource: Local\nkind: ${kind}\n---\n\n# ${name}\n\n> A term made for a test.\n${attributes.length ? `\n## Attributes\n\n${table(["Attribute", "Type"], attributes)}` : ""}${relations.length ? `\n## Relations\n\n${table(["Concept", "Cardinality"], relations)}` : ""}`;
const aggregate = (id, name, root, members) =>
  `---\nid: ${id}\nsource: Local\nroot: ${root}\nmembers:\n${members.map((m) => `  - ${m}\n`).join("")}---\n\n# ${name}\n\n> What the test needs kept consistent.\n\n## Invariants\n\n${table(["Label", "Invariant"], [["INV-T1", "It holds after every change."]])}`;
const event = (id, name, by) => `---\nid: ${id}\nsource: Local\nemitted-by: ${by}\n---\n\n# ${name}\n\n> Something happened in a test.\n`;

export function withContexts({ disagree = false, crowd = 0 } = {}) {
  const root = packInstanceDir();
  const dir = (...p) => path.join(root, "model", "bounded-contexts", ...p);
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write(dir("quoting", "quoting.md"), context(CONTEXT_ID, "Quoting", "core", [["Catalog", "conformist"], ["Invoicing", "shared kernel"]]));
  write(dir("catalog", "catalog.md"), context(C.catalog, "Catalog", "supporting", disagree ? [["Quoting", "partnership"]] : []));
  write(dir("invoicing", "invoicing.md"), context(C.invoicing, "Invoicing", "core", [["Quoting", "shared kernel"]]));
  write(dir("ordering", "ordering.md"), context(C.ordering, "Ordering", "generic", [["Quoting", "customer/supplier"]]));
  write(dir("archive", "archive.md"), context(C.archive, "Archive", "generic", []));
  const crowded = Array.from({ length: crowd }, (_, i) => String(i).padStart(2, "0"));
  for (const n of crowded) {
    write(dir(`crowd-${n}`, `crowd-${n}.md`), context(`01a0ffff-0000-7000-8000-0000000002${n}`, `Crowd ${n}`, "generic", [["Quoting", "conformist"]]));
    write(dir("quoting", "concept-designs", `part-${n}.md`), design(`01a0ffff-0000-7000-8000-0000000003${n}`, `Part ${n}`, "value object", [], []));
  }
  write(dir("quoting", "aggregates", "quote.md"), aggregate(C.quote, "Quote", "Quote", ["Quote line", "Money", "Discount", ...crowded.map((n) => `Part ${n}`)]));
  write(dir("quoting", "aggregates", "price-list.md"), aggregate(C.priceList, "Price list", "Price list", ["Money"]));
  write(dir("quoting", "concept-designs", "quote.md"), design(C.quoteDesign, "Quote", "entity",
    [["Number", "string"], ["Total", "Money"], [ODD_ATTRIBUTE, "string"]], [["Quote line", "one to many"], ["Money", "one"], ["Customer", "maybe one"]]));
  write(dir("quoting", "concept-designs", "quote-line.md"), design(C.lineDesign, "Quote line", "entity", [["Quantity", "number"]], [["Money", "one"]]));
  write(dir("quoting", "concept-designs", "money.md"), design(C.money, "Money", "value object", [["Amount", "decimal"], ["Currency", "ISO 4217 code"]], []));
  write(dir("quoting", "concept-designs", "discount.md"), design(C.discount, "Discount", "value object", [], []));
  write(dir("quoting", "concept-designs", "customer.md"), design(C.customer, "Customer", "value object", [], []));
  write(dir("quoting", "concept-designs", "price-list.md"), design(C.priceListDesign, "Price list", "entity", [], [["Money", "many"]]));
  write(dir("quoting", "domain-events", "quote-sent.md"), event(C.sent, "Quote sent", "Quote"));
  write(dir("quoting", "domain-events", "quote-accepted.md"), event(C.accepted, "Quote accepted", "Quote"));
  return buildSnapshot({ files: readDir(path.join(root, "model")), schemas: readSchemas(path.join(root, "meta", "core")),
    sub: "model/", core: "meta/core/", commit: COMMIT, repo: "companygraph/pack-instance", parserTag: PARSER });
}
```

- [ ] **Step 2: Write the failing tests** at the end of `test/diagram.test.mjs`, and add `withContexts, CONTEXT_ID, CONTEXT_IDS` to its import from `./helpers.mjs`:

```js
// The software pack's pictures, over a pack instance built for them. A context map is drawn from
// the Relationships rows on both sides of the context, one hop out.
const B = withContexts();
const K = CONTEXT_IDS;

test("a context map draws its neighbours one hop out, upstream above downstream, each arrow labeled by its pattern", () => {
  const d = diagram(B, { shape: "context", id: CONTEXT_ID });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted], ["context", "Quoting", 4, 0]);
  assert.deepEqual(lines(d), [
    "flowchart TB",
    '  n0["<small>«bounded-context» · core</small><br/><b>Quoting</b>"]',
    '  n1["<small>«bounded-context» · supporting</small><br/>Catalog"]',
    '  n2["<small>«bounded-context» · core</small><br/>Invoicing"]',
    '  n3["<small>«bounded-context» · generic</small><br/>Ordering"]',
    '  n1 -->|"U → D · conformist"| n0',
    '  n0 <-->|"shared kernel"| n2',
    '  n0 -->|"U → D · customer/supplier"| n3',
  ]);
  assert.deepEqual(ids(d), [["n0", CONTEXT_ID], ["n1", K.catalog], ["n2", K.invoicing], ["n3", K.ordering]]);
  assert.deepEqual(d.nodes.map((n) => n.type), ["bounded-context", "bounded-context", "bounded-context", "bounded-context"]);
  assert.deepEqual(d.links, [
    { from: "n1", to: "n0", label: "U → D · conformist" },
    { from: "n0", to: "n2", label: "shared kernel" },
    { from: "n0", to: "n3", label: "U → D · customer/supplier" },
  ]);
});

test("a symmetric pattern named from both sides is one arrow, from either side's map", () => {
  const d = diagram(B, { shape: "context", id: K.invoicing });
  assert.deepEqual([d.title, d.edges], ["Invoicing", 2]);
  assert.deepEqual(lines(d).slice(1), [
    '  n0["<small>«bounded-context» · core</small><br/><b>Invoicing</b>"]',
    '  n1["<small>«bounded-context» · core</small><br/>Quoting"]',
    '  n1 <-->|"shared kernel"| n0',
  ]);
});

test("two rows that disagree each keep their own arrow", () => {
  const d = diagram(withContexts({ disagree: true }), { shape: "context", id: CONTEXT_ID });
  assert.equal(d.edges, 5);
  assert.deepEqual(lines(d).slice(5), [
    '  n1 -->|"U → D · conformist"| n0',
    '  n0 <-->|"partnership"| n1',
    '  n0 <-->|"shared kernel"| n2',
    '  n0 -->|"U → D · customer/supplier"| n3',
  ]);
});

test("a context with no relationship is a map of one node", () => {
  const d = diagram(B, { shape: "context", id: K.archive });
  assert.deepEqual([lines(d), d.links, d.edges], [["flowchart TB", '  n0["<small>«bounded-context» · generic</small><br/><b>Archive</b>"]'], [], 0]);
});

test("a context naming itself draws no arrow to itself", () => {
  const self = structuredClone(B);
  self.edges.push({ from: CONTEXT_ID, via: "Relationships.Context", to: CONTEXT_ID, attrs: { Pattern: "conformist" } });
  assert.equal(diagram(self, { shape: "context", id: CONTEXT_ID }).mermaid, diagram(B, { shape: "context", id: CONTEXT_ID }).mermaid);
});

test("a context map holds fifty nodes, its middle among them, and refuses one more", () => {
  assert.equal(diagram(withContexts({ crowd: 46 }), { shape: "context", id: CONTEXT_ID }).nodes.length, 50);
  refused(() => diagram(withContexts({ crowd: 47 }), { shape: "context", id: CONTEXT_ID }), "cannot_draw", { shape: "context", reason: "too_large", nodes: 51, limit: DIAGRAM_CAP });
});

test("a context map is refused for an id of another type, and where the pack is not taken", () => {
  refused(() => diagram(B, { shape: "context", id: K.quote }), "invalid_argument", { argument: "id", reason: "not a bounded-context" });
  refused(() => diagram(B, { shape: "context" }), "invalid_argument", { argument: "id", reason: "needed by context" });
  refused(() => diagram(s, { shape: "context", id: "nothing/here" }), "unknown_type");
});
```

The self-naming test pushes the edge under its literal `via`: a test may name a column, and `lib/` may not.

In the existing test "the arguments each shape does not take, needs or cannot use are refused by name", change the first line's expected reason to `"one of concepts, process, neighborhood, schema, context, aggregate"`.

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test test/diagram.test.mjs`

Expected: FAIL. The new tests fail with `invalid_argument` "shape is one of concepts, process, neighborhood, schema", and the edited reason fails too.

- [ ] **Step 4: Implement**

In `lib/schemas.mjs` line 13:

```js
export const SHAPES = ["concepts", "process", "neighborhood", "schema", "context", "aggregate"];
```

In `lib/diagram.mjs`, where `relationsOf` is already imported, insert above the comment `// Which shape takes which argument`:

```js
// A bounded context's map: the context, every context its Relationships names and every context
// whose Relationships names it, one hop and contexts only. A row is written on the downstream
// side and names its upstream, so its arrow runs from the context it names to the one that wrote
// it, and a top-to-bottom flow puts upstream above downstream, as a context map is read. Three
// patterns have no upstream side and are drawn with a head at each end; two rows naming each
// other with one of them are one arrow, and two rows that disagree each keep their own.
const SYMMETRIC = new Set(["partnership", "shared kernel", "separate ways"]);
function contextMap(s, id) {
  requireType(s, "bounded-context");
  const c = requireId(s, id);
  if (c.type !== "bounded-context") throw notA("id", c, "bounded-context");
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  // The column a row names its upstream in is read from the schema, the one reference a bounded
  // context declares to another, so no column's name is written here.
  const vias = new Set(relationsOf(s).relations.filter((r) => r.from === "bounded-context" && r.to === "bounded-context").map((r) => r.via));
  const rows = allEdges(s).filter((x) => vias.has(x.via) && x.from.id !== x.to.id && (x.from.id === c.id || x.to.id === c.id));
  const arrows = [], merged = new Set();
  for (const x of rows) {
    const pattern = text(x.attrs?.Pattern), both = SYMMETRIC.has(pattern);
    if (both) {
      const key = `${[x.from.id, x.to.id].sort().join("\u0000")}\u0000${pattern}`;
      if (merged.has(key)) continue;
      merged.add(key);
    }
    arrows.push({ up: byId.get(x.to.id), down: byId.get(x.from.id), pattern, both });
  }
  const others = [...new Map(arrows.flatMap((a) => [a.up, a.down]).filter((e) => e.id !== c.id).map((e) => [e.id, e])).values()].sort(byName);
  if (others.length + 1 > DIAGRAM_CAP) throw cannot("context", "too_large", others.length + 1);
  const { nodes, of } = namer();
  // Each node opens with its type and its classification, as a neighborhood's opens with its
  // type, set in `<small>`, and the middle's name is bold, as the neighborhood's is.
  const head = (e) => `<small>«bounded-context»${e.fields?.classification ? ` · ${label(text(e.fields.classification))}` : ""}</small>`;
  const lines = ["flowchart TB", `  ${of(c)}["${head(c)}<br/><b>${label(c.name)}</b>"]`];
  for (const e of others) lines.push(`  ${of(e)}["${head(e)}<br/>${label(e.name)}"]`);
  const links = [];
  const sorted = arrows.sort((a, b) => byName(a.up, b.up) || byName(a.down, b.down) || cmp(a.pattern, b.pattern));
  for (const a of sorted) {
    const raw = a.both ? a.pattern : `U → D · ${a.pattern}`;
    lines.push(`  ${of(a.up)} ${a.both ? "<-->" : "-->"}|"${label(raw)}"| ${of(a.down)}`);
    links.push({ from: of(a.up), to: of(a.down), label: raw });
  }
  return { title: c.name, mermaid: lines.join("\n"), nodes, links, edges: rows.length, omitted: 0 };
}
```

Change `TAKES` to `const TAKES = { id: ["process", "neighborhood", "context", "aggregate"], domain: ["concepts"], type: ["schema"] };` and update the comment above it to say that `id` names what a process, a neighborhood, a context map or an aggregate is of. Change the dispatch line in `diagram()`:

```js
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? processDiagram(s, id) : shape === "neighborhood" ? neighborhood(s, id)
    : shape === "context" ? contextMap(s, id) : shape === "aggregate" ? aggregates(s, id) : schemas(s, type);
```

Until Task 2, add a one-line stand-in above `TAKES` so the module loads: `function aggregates() { throw new ModelError("invalid_argument", "the aggregate diagram is not drawn yet", { details: { argument: "shape", reason: "not drawn yet" } }); }`. Task 2 replaces it.

Update the file's opening comment: "Four shapes" becomes six, naming a bounded context's map and its aggregates.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/diagram.test.mjs` then `node --test test/portability.test.mjs`

Expected: PASS, both.

- [ ] **Step 6: Commit**

```bash
git add lib/diagram.mjs lib/schemas.mjs test/helpers.mjs test/diagram.test.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F <message file>
```

Subject: `A bounded context is drawn as its context map`. Body: why (the neighborhood labels field names, the map labels patterns), what (one hop of contexts, upstream above downstream, symmetric patterns merged, column read from the schema), `Verified: node --test test/diagram.test.mjs and test/portability.test.mjs pass; conventions-check and conventions-format pass.`

---

### Task 2: The aggregate, and the escaping it needs

**Files:**

- Modify: `lib/diagram.mjs` (`unquoted`, near line 50; replace the stand-in `aggregates`)
- Modify: `test/helpers.mjs` (`withPunctuation` gains one concept)
- Test: `test/diagram.test.mjs`

**Interfaces:**

- Consumes: `withContexts`, `CONTEXT_IDS`, `ODD_ATTRIBUTE` from Task 1; `requireType`, `requireId`, `allEdges`; `namer`, `label`, `text`, `names`, `byName`, `cannot`.
- Produces: `diagram(s, { shape: "aggregate", id })` for an aggregate's id or a bounded context's, answering `{ shape: "aggregate", title, mermaid, nodes, links, edges, omitted: 0, model }`; `unquoted(v)` mapping every one of `#"<>`:;{}` in one pass.

- [ ] **Step 1: Write the failing tests**

In `test/helpers.mjs`, `withPunctuation` gains, after its Glue line:

```js
  files.set("concepts/quoted.md", concept("Quoted", [["Glue", 'the "glue"; a']]));
```

and its comment gains: "Quoted names Glue with an As holding a quote and a semicolon, which must be mapped in one pass, since mapping after `label()` would break its `#quot;`."

Add `ODD_ATTRIBUTE` to the test file's import, extend the existing punctuation test with:

```js
  const quoted = d.nodes.find((n) => n.title === "Quoted").node;
  assert.ok(lines(d).includes(`  ${quoted} --> ${glue} : one, the #quot;glue#quot;#59; a`), d.mermaid);
```

and append:

```js
// An aggregate is drawn from its root, its members and the events that name it: what it holds,
// never what its root merely reaches.
test("an aggregate draws its root and members with their kinds and attributes, the cardinalities, and its events", () => {
  const d = diagram(B, { shape: "aggregate", id: K.quote });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted], ["aggregate", "Quote", 6, 0]);
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["Quote"] {', "    <<aggregate root>>", "    Number : string", "    Total : Money",
    "    Note #quot;a#quot; #35;1#58; #123;x#125; : string", "  }",
    '  class n1["Quote line"] {', "    <<entity>>", "    Quantity : number", "  }",
    '  class n2["Money"] {', "    <<value object>>", "    Amount : decimal", "    Currency : ISO 4217 code", "  }",
    '  class n3["Discount"] {', "    <<value object>>", "  }",
    '  class n4["Quote accepted"] {', "    <<domain event>>", "  }",
    '  class n5["Quote sent"] {', "    <<domain event>>", "  }",
    '  n0 *-- "1..*" n1', '  n0 *-- "1" n2', "  n0 *-- n3", "  n1 --> n2 : one",
    "  n0 ..> n4 : emits", "  n0 ..> n5 : emits",
  ]);
  assert.deepEqual(ids(d), [["n0", K.quoteDesign], ["n1", K.lineDesign], ["n2", K.money], ["n3", K.discount], ["n4", K.accepted], ["n5", K.sent]]);
  assert.ok(!d.nodes.some((n) => n.id === K.customer), "Customer is reached by the root, never held");
  assert.deepEqual(d.links, [
    { from: "n0", to: "n1", label: "1..*" }, { from: "n0", to: "n2", label: "1" }, { from: "n0", to: "n3", label: "" },
    { from: "n1", to: "n2", label: "one" }, { from: "n0", to: "n4", label: "emits" }, { from: "n0", to: "n5", label: "emits" },
  ]);
  assert.ok(lines(d).some((l) => l.includes(ODD_ATTRIBUTE.slice(0, 4))), "the odd attribute is drawn");
});

test("a context's id draws every aggregate it holds in one picture, a term two of them hold drawn once", () => {
  const d = diagram(B, { shape: "aggregate", id: CONTEXT_ID });
  assert.deepEqual([d.title, d.edges], ["Quoting", 7]);
  assert.deepEqual(d.nodes.map((n) => n.title), ["Price list", "Money", "Quote", "Quote line", "Discount", "Quote accepted", "Quote sent"]);
  assert.deepEqual(lines(d).filter((l) => /\*--|-->|\.\.>/.test(l)), [
    '  n0 *-- "*" n1', '  n2 *-- "1..*" n3', '  n2 *-- "1" n1', "  n2 *-- n4", "  n3 --> n1 : one",
    "  n2 ..> n5 : emits", "  n2 ..> n6 : emits",
  ]);
});

test("a root that another aggregate of the context holds is drawn once, as a root, joined to both", () => {
  const both = structuredClone(B);
  const list = both.entities.find((e) => e.id === K.priceList);
  list.fields.members = ["Money", "Quote"];
  both.edges.push({ from: K.priceList, via: "members", to: K.quoteDesign, attrs: {} });
  const d = diagram(both, { shape: "aggregate", id: CONTEXT_ID });
  const quote = d.nodes.filter((n) => n.id === K.quoteDesign);
  assert.equal(quote.length, 1);
  const at = lines(d).indexOf(`  class ${quote[0].node}["Quote"] {`);
  assert.equal(lines(d)[at + 1], "    <<aggregate root>>");
  assert.ok(lines(d).includes(`  n0 *-- ${quote[0].node}`), d.mermaid);
});

test("an aggregate holds fifty nodes and refuses one more; a context with none, or another type, is refused", () => {
  assert.equal(diagram(withContexts({ crowd: 44 }), { shape: "aggregate", id: K.quote }).nodes.length, 50);
  refused(() => diagram(withContexts({ crowd: 45 }), { shape: "aggregate", id: K.quote }), "cannot_draw", { shape: "aggregate", reason: "too_large", nodes: 51, limit: DIAGRAM_CAP });
  refused(() => diagram(B, { shape: "aggregate", id: K.archive }), "cannot_draw", { shape: "aggregate", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(B, { shape: "aggregate", id: K.money }), "invalid_argument", { argument: "id", reason: "not an aggregate or a bounded-context" });
  refused(() => diagram(s, { shape: "aggregate", id: "nothing/here" }), "unknown_type");
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test test/diagram.test.mjs`

Expected: FAIL. The punctuation test fails on `the #quot#59;glue#quot#59;#59; a`, and the aggregate tests on the stand-in's `invalid_argument`.

- [ ] **Step 3: Implement**

Replace `unquoted` and its comment:

```js
// An association's own text, and a class's member line, sit outside quotes, where Mermaid also
// ends a label at a `:` or a `;` and a member at a brace. Every character is mapped in one pass:
// mapping after `label()` would turn the `;` that closes its own `#quot;` into `#59;`.
const CODES = { "#": "35", '"': "quot", "<": "lt", ">": "gt", "`": "96", ":": "58", ";": "59", "{": "123", "}": "125" };
const unquoted = (v) => plain(String(v)).replace(/[#"<>`:;{}]/g, (c) => `#${CODES[c]};`);
```

Replace the stand-in `aggregates` with:

```js
// An aggregate's picture, or every aggregate of one context in one: each root and member a class
// annotated with its kind, the root `aggregate root`, holding its Attributes as members; the root
// joined to each member by a composition with the cardinality the root's Relations gives it; any
// other Relations row between two drawn terms an association, as the concepts picture draws one;
// and every event the aggregate emits a class of its own, reached by a dashed `emits`. A term the
// root reaches but the aggregate does not hold is not drawn: the picture is of what it holds.
const CARDINALITY = { one: "1", "maybe one": "0..1", many: "*", "one to many": "1..*" };
function aggregates(s, id) {
  requireType(s, "aggregate");
  const e = requireId(s, id);
  if (e.type !== "aggregate" && e.type !== "bounded-context")
    throw new ModelError("invalid_argument", `id names ${e.id}, which is a ${e.type} and not an aggregate or a bounded-context`, { details: { argument: "id", reason: "not an aggregate or a bounded-context" } });
  const drawnAggs = e.type === "aggregate" ? [e] : s.entities.filter((x) => x.type === "aggregate" && x.owner === e.id).sort(byName);
  if (drawnAggs.length === 0) throw cannot("aggregate", "empty", 0);
  const byId = new Map(s.entities.map((x) => [x.id, x]));
  const edges = allEdges(s);
  const roots = new Set(), held = [], compositions = [];
  for (const a of drawnAggs) {
    const root = edges.find((x) => x.via === "root" && x.from.id === a.id)?.to;
    if (!root) continue;
    roots.add(root.id);
    held.push(root);
    const mine = edges.filter((x) => x.via === "members" && x.from.id === a.id);
    for (const name of names(a.fields.members)) {
      const m = mine.find((x) => x.to.name === name)?.to;
      if (!m) continue;
      held.push(m);
      const rel = edges.find((x) => x.via === "Relations.Concept" && x.from.id === root.id && x.to.id === m.id);
      compositions.push({ root, m, card: CARDINALITY[text(rel?.attrs?.Cardinality)] ?? "" });
    }
  }
  const terms = [...new Map(held.map((x) => [x.id, byId.get(x.id)])).values()];
  const aggIds = new Set(drawnAggs.map((a) => a.id));
  const events = edges.filter((x) => x.via === "emitted-by" && aggIds.has(x.to.id))
    .map((x) => ({ event: byId.get(x.from.id), root: edges.find((y) => y.via === "root" && y.from.id === x.to.id)?.to })).filter((x) => x.root)
    .sort((a, b) => byName(a.event, b.event));
  const count = terms.length + new Set(events.map((x) => x.event.id)).size;
  if (count > DIAGRAM_CAP) throw cannot("aggregate", "too_large", count);
  const { nodes, of } = namer();
  const lines = ["classDiagram"];
  for (const t of terms) {
    const table = t.sections.find((x) => x.heading === "Attributes")?.tables?.[0];
    const at = table ? table.columns.indexOf("Attribute") : -1, ty = table ? table.columns.indexOf("Type") : -1;
    const attrs = at < 0 ? [] : table.rows.filter((r) => text(r[at]).trim()).map((r) => {
      const type = ty < 0 ? "" : text(r[ty]).trim();
      return `    ${unquoted(text(r[at]).trim())}${type ? ` : ${unquoted(type)}` : ""}`;
    });
    lines.push(`  class ${of(t)}["${label(t.name)}"] {`, `    <<${roots.has(t.id) ? "aggregate root" : label(text(t.fields.kind))}>>`, ...attrs, "  }");
  }
  for (const { event } of events) lines.push(`  class ${of(event)}["${label(event.name)}"] {`, "    <<domain event>>", "  }");
  const links = [];
  for (const { root, m, card } of compositions) {
    lines.push(`  ${of(root)} *--${card ? ` "${card}"` : ""} ${of(m)}`);
    links.push({ from: of(root), to: of(m), label: card });
  }
  const drawnIds = new Set(terms.map((t) => t.id));
  const composed = new Set(compositions.map(({ root, m }) => `${root.id}\u0000${m.id}`));
  for (const x of edges.filter((x) => x.via === "Relations.Concept" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id) && !composed.has(`${x.from.id}\u0000${x.to.id}`))) {
    const said = [text(x.attrs.Cardinality), text(x.attrs.As)].filter((v) => v.trim());
    lines.push(`  ${of(x.from)} --> ${of(x.to)}${said.length ? ` : ${said.map(unquoted).join(", ")}` : ""}`);
    links.push({ from: of(x.from), to: of(x.to), label: said.join(", ") });
  }
  for (const { event, root } of events) {
    lines.push(`  ${of(root)} ..> ${of(event)} : emits`);
    links.push({ from: of(root), to: of(event), label: "emits" });
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0 };
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/diagram.test.mjs`, then `npm test`

Expected: PASS. The whole suite passes; no other test reads `unquoted`'s output for a quoted role.

- [ ] **Step 5: Commit**

Subject: `An aggregate is drawn as a class diagram of what it holds`. Body names the aggregate shape, the context id drawing all aggregates, and the escaping fix with the role it broke. `Verified:` names `npm test` and the two conventions scripts.

---

### Task 3: The tool, its contract and its interface, then the pull request

**Files:**

- Modify: `lib/tools.mjs:136-140` (the `diagram` description and `id`'s description)
- Modify: `scripts/interface.mjs` (two examples on the contexts fixture)
- Modify: `docs/INTERFACE.md` (`### \`diagram\`` prose; two new headings; regenerated)
- Modify: `README.md:23` (the `diagram` row)
- Modify: `deploy/test/tools.mjs` (one test)
- Test: `test/contract.test.mjs`, `test/descriptions.test.mjs` (unchanged, must still pass), `test/interface.test.mjs` (unchanged, must still pass)

**Interfaces:**

- Consumes: Tasks 1 and 2; `withContexts`, `CONTEXT_ID`, `CONTEXT_IDS`.
- Produces: the released interface the hosts and the chat call; nothing further in code.

- [ ] **Step 1: Write the failing contract tests** in `test/contract.test.mjs`. Add `withContexts, CONTEXT_ID, CONTEXT_IDS` to the helpers import. In the per-fixture refusal `CASES`, add:

```js
      ["diagram", { shape: "context", id: "nothing/here" }, "unknown_type", (d) => d.type === "bounded-context"],
      ["diagram", { shape: "aggregate", id: "nothing/here" }, "unknown_type", (d) => d.type === "aggregate"],
```

After the test "a diagram with nothing to draw is refused by code…", add:

```js
test("a context map and an aggregate answer in the schema over an instance that takes the pack", async () => {
  const b = withContexts();
  const client = await connect(b);
  const map = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "context", id: CONTEXT_ID } }));
  assert.deepEqual([map.shape, map.title, map.nodes.length], ["context", "Quoting", 4]);
  const agg = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "aggregate", id: CONTEXT_ID } }));
  assert.deepEqual([agg.shape, agg.title, agg.nodes.length], ["aggregate", "Quoting", 7]);
  const { error } = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "aggregate", id: CONTEXT_IDS.archive } }));
  assert.deepEqual([error.code, error.details], ["cannot_draw", { shape: "aggregate", reason: "empty", nodes: 0, limit: 50 }]);
  reached.add(error.code);
  await client.close();
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/contract.test.mjs`

Expected: PASS already, since Tasks 1 and 2 built the shapes and `SHAPES` feeds the schema. This step proves the answers parse; if one fails, the schema in `lib/schemas.mjs` is what to fix.

- [ ] **Step 3: The description.** In `lib/tools.mjs`, the `diagram` entry:

```js
    description: "A picture of the model as Mermaid, from its edges or its schemas. Use to show connections; for edges as data use list_references. Input: `shape`; `id`, `domain` or `type` narrow it; `aggregate` takes a context's id for all its aggregates. Returns `mermaid`, `nodes`, `links`, `title`, `edges`, `omitted`, schema's `everyType`. A process draws gate failures dashed. At most 50 nodes.",
```

and `id`'s `.describe("The process, the entity at a neighborhood's middle, the bounded context of a context map, or the aggregate or bounded context of an aggregate picture")`.

Run: `node --test test/descriptions.test.mjs`

Expected: PASS, the description within sixty words.

- [ ] **Step 4: The interface examples.** In `scripts/interface.mjs`, import `withContexts, CONTEXT_ID` beside the other helpers, add to `EXAMPLES` after `` "`diagram`" ``:

```js
  "`diagram` of a context": { name: "diagram", contexts: true, arguments: { shape: "context", id: CONTEXT_ID } },
  "`diagram` of its aggregates": { name: "diagram", contexts: true, arguments: { shape: "aggregate", id: CONTEXT_ID } },
```

and in `render`, connect a third client, `const contexts = await connect(withContexts());`, pick it with `call.contexts ? contexts : call.ambiguous ? ambiguous : plain`, and close it beside the others. The comment above `EXAMPLES` gains: "the two pictures of a context run on the pack instance built for them, since the worked example takes no pack."

In `docs/INTERFACE.md` under `### \`diagram\``, change "`shape` is `concepts`, `process`, `neighborhood` or `schema`" to name all six, and add after the `schema` sentence: "`context` takes the `id` of a bounded context and draws its context map: that context, every context its Relationships names and every context naming it, one hop out, as a flowchart from top to bottom, each node's first line `«bounded-context»` and its classification. Each Relationships row is one arrow from the upstream context it names to the downstream context that wrote it, labeled `U → D · ` and the pattern; `partnership`, `shared kernel` and `separate ways` have no upstream side and are one arrow with a head at each end, labeled with the pattern, however many rows name it. `aggregate` takes the `id` of an aggregate, or of a bounded context to draw all its aggregates in one picture: a class per root and member, annotated with its kind and the root `aggregate root`, its Attributes as members, a composition from the root to each member with the cardinality the root's Relations gives it, `1`, `0..1`, `*` or `1..*`, other Relations rows between drawn terms as associations, and each event whose `emitted-by` names the aggregate as a class annotated `domain event`, reached by a dashed arrow labeled `emits`." Change "A concepts, process or schema diagram that would hold more" to "A concepts, process, schema, context or aggregate diagram that would hold more", and add that a context's `aggregate` with no aggregate is `cannot_draw` with `reason: "empty"`. Then add two headings after the `diagram` example, each followed by an empty fence for the script to fill:

````markdown
### `diagram` of a context

```json
```

### `diagram` of its aggregates

```json
```
````

Run: `npm run interface`, then `node --test test/interface.test.mjs`

Expected: PASS, the two examples written from the fixture.

- [ ] **Step 5: The README row.** `README.md` line 23 becomes: `| \`diagram\` | part of the model as Mermaid: the concepts, a process, one entity's neighborhood, the schemas, a bounded context's map, or its aggregates |`.

- [ ] **Step 6: The deployment test.** Append inside `registerToolsTests()` in `deploy/test/tools.mjs`, importing nothing new:

```js
  // A context map reaches a deployment with a re-pin, so each holds it against the model it
  // serves. An instance without the software pack is told so, and skips rather than fails.
  test("every bounded context draws its map, contexts only, each arrow labeled by a pattern", async (t) => {
    const contexts = s.entities.filter((e) => e.type === "bounded-context");
    if (!contexts.length) return t.skip("this instance holds no bounded context");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    for (const c of contexts) {
      const d = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "context", id: c.id } }));
      assert.ok(d.nodes.every((n) => n.type === "bounded-context"), c.name);
      for (const l of d.links) assert.match(l.label, /^(U → D · .+|partnership|shared kernel|separate ways)$/, `${c.name}: ${l.label}`);
    }
    await client.close();
  });
```

Run: `node --test test/deploy-tools.test.mjs`

Expected: PASS (it runs the shared tests over the suite's own fixture, which skips).

- [ ] **Step 7: Run everything**

Run: `npm test`, `sh conventions/conventions-check`, `sh conventions/conventions-format check`

Expected: all exit 0.

- [ ] **Step 8: Render once against the real model.** Build a snapshot of `companygraph/mental-model` at `origin/main` with this branch's `bin/`, call `diagram` for `{ shape: "context", id: "01a10042-5ce7-7756-9ce4-1cf2a4435aa2" }` (Checking) and `{ shape: "aggregate", id: "01a10042-5ce7-7756-9ce4-1cf2a4435aa2" }`, and render both sources with `~/git/robertblust/design/assets/mermaid.min.js` in Playwright's Chromium (design's `node_modules` has it) with the widget's configuration from `rbChat.mermaidConfig`. Expected: the map shows Resolution above Checking with `U → D · conformist`, Vendoring beside it with `shared kernel` and a head at each end, Procedures below; the aggregate shows Check run as `aggregate root` with four members and two `emits` arrows. Save both screenshots in the scratchpad and name them in the pull request body.

- [ ] **Step 9: Commit, push, open the pull request, stop.**

Commit subject: `The diagram tool answers for a context map and its aggregates`. Pull request title: `A bounded context is drawn as its map and its aggregates`. The body in the git register says the gap, the two shapes, the escaping fix, that the release is the owner's and the hosts re-pin after it, the screenshots, and `Verified:` with what ran.

---

## Part B — `robertblust/design`

### Task 4: Every picture an answer brings

**Files:**

- Modify: `assets/chat.js` (header comment lines 24-30; strings at lines 127 and 174; `figure()` near line 1201; `labelFigure()` near line 979; `send()` near lines 2075, 2106, 2130 and 2156; `restore` near lines 2216-2227)
- Modify: `assets/chat.css` (one rule after `.rbchat-diagram-failed`, line 193)
- Modify: `test/fixtures/diagrams.json` (two pictures)
- Test: `test/chat-diagram.test.mjs`, `test/chat.test.mjs`

**Interfaces:**

- Consumes: the `diagram` event as mcp-server's Task 2 produces it, `{ shape, title, mermaid, nodes, omitted }` with `shape` one of six.
- Produces: `figure(d, fit)`; `placeFigures(ans, after, list)`; strings `diagram.context`, `diagram.aggregate`, `diagram.reading.context`, `diagram.reading.aggregate` in both languages; a stored turn's `diagrams` (an array), read back from `diagram` too.

- [ ] **Step 1: The fixtures.** Add to `test/fixtures/diagrams.json`, as the keys `context` and `aggregate`, exactly these two objects (written by mcp-server's Task 2 over its pack fixture):

```json
{"context": {"shape": "context", "title": "Quoting", "mermaid": "flowchart TB\n  n0[\"<small>«bounded-context» · core</small><br/><b>Quoting</b>\"]\n  n1[\"<small>«bounded-context» · supporting</small><br/>Catalog\"]\n  n2[\"<small>«bounded-context» · core</small><br/>Invoicing\"]\n  n3[\"<small>«bounded-context» · generic</small><br/>Ordering\"]\n  n1 -->|\"U → D · conformist\"| n0\n  n0 <-->|\"shared kernel\"| n2\n  n0 -->|\"U → D · customer/supplier\"| n3", "nodes": [{"node": "n0", "id": "01a0ffff-0000-7000-8000-0000000000bc", "title": "Quoting", "type": "bounded-context"}, {"node": "n1", "id": "01a0ffff-0000-7000-8000-000000000101", "title": "Catalog", "type": "bounded-context"}, {"node": "n2", "id": "01a0ffff-0000-7000-8000-000000000102", "title": "Invoicing", "type": "bounded-context"}, {"node": "n3", "id": "01a0ffff-0000-7000-8000-000000000103", "title": "Ordering", "type": "bounded-context"}], "omitted": 0},
 "aggregate": {"shape": "aggregate", "title": "Quote", "mermaid": "classDiagram\n  class n0[\"Quote\"] {\n    <<aggregate root>>\n    Number : string\n    Total : Money\n    Note #quot;a#quot; #35;1#58; #123;x#125; : string\n  }\n  class n1[\"Quote line\"] {\n    <<entity>>\n    Quantity : number\n  }\n  class n2[\"Money\"] {\n    <<value object>>\n    Amount : decimal\n    Currency : ISO 4217 code\n  }\n  class n3[\"Discount\"] {\n    <<value object>>\n  }\n  class n4[\"Quote accepted\"] {\n    <<domain event>>\n  }\n  class n5[\"Quote sent\"] {\n    <<domain event>>\n  }\n  n0 *-- \"1..*\" n1\n  n0 *-- \"1\" n2\n  n0 *-- n3\n  n1 --> n2 : one\n  n0 ..> n4 : emits\n  n0 ..> n5 : emits", "nodes": [{"node": "n0", "id": "01a0ffff-0000-7000-8000-000000000121", "title": "Quote", "type": "concept-design"}, {"node": "n1", "id": "01a0ffff-0000-7000-8000-000000000122", "title": "Quote line", "type": "concept-design"}, {"node": "n2", "id": "01a0ffff-0000-7000-8000-000000000123", "title": "Money", "type": "concept-design"}, {"node": "n3", "id": "01a0ffff-0000-7000-8000-000000000124", "title": "Discount", "type": "concept-design"}, {"node": "n4", "id": "01a0ffff-0000-7000-8000-000000000132", "title": "Quote accepted", "type": "domain-event"}, {"node": "n5", "id": "01a0ffff-0000-7000-8000-000000000131", "title": "Quote sent", "type": "domain-event"}], "omitted": 0}}
```

- [ ] **Step 2: Write the failing tests.** In `test/chat.test.mjs`, beside the caption test near line 669:

```js
test("the two pictures of a bounded context are captioned, and each has a reading line, in both languages", () => {
  assert.equal(diagramCaption({ shape: "context", title: "Quoting" }, "en"), "Context map · Quoting");
  assert.equal(diagramCaption({ shape: "aggregate", title: "Quote" }, "en"), "Aggregate · Quote");
  assert.equal(diagramCaption({ shape: "context", title: "Quoting" }, "de"), "Context Map · Quoting");
  assert.equal(diagramCaption({ shape: "aggregate", title: "Quote" }, "de"), "Aggregat · Quote");
  for (const lang of ["en", "de"]) for (const shape of ["context", "aggregate"]) assert.ok(strings(lang).diagram.reading[shape].length > 20, `${lang} ${shape}`);
  assert.equal(strings("en").diagram.reading.process, undefined, "the older shapes keep no reading line");
});
```

In `test/chat-diagram.test.mjs`, after "a picture is drawn under its answer…":

```js
test("an answer bringing two pictures draws both, in order, each fitted and each opening full screen on a click", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting conforms to Catalog." }]], { viewport: { width: 1280, height: 900 } });
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  assert.deepEqual(await page.$$eval(".rbchat-diagram figcaption span", (els) => els.map((e) => e.textContent)), ["Context map · Quoting", "Aggregate · Quote"]);
  assert.deepEqual(await page.$$eval(".rbchat-diagram", (els) => els.map((f) => f.classList.contains("rbchat-diagram-fit"))), [true, true]);
  for (const f of await page.$$(".rbchat-diagram")) {
    const size = await f.$eval(".rbchat-diagram-box", (box) => ({ svg: box.querySelector("svg").getBoundingClientRect().width, box: box.clientWidth }));
    assert.ok(size.svg <= size.box + 0.5, JSON.stringify(size));
  }
  assert.match(await page.textContent(".rbchat-diagram:nth-of-type(1) .rbchat-diagram-reading"), /upstream/);
  const r = await page.$eval(".rbchat-diagram:nth-of-type(2) .rbchat-diagram-box svg", (svg) => { const b = svg.getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForSelector("dialog.rbmodal[open] svg");
  assert.match(await page.textContent("dialog.rbmodal[open]"), /Aggregate · Quote/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram .rbchat-diagram-box svg").length === 2 && !document.querySelector("dialog.rbmodal[open]"));
  await page.close();
});

test("an answer bringing one picture draws it as before, at its own size, with no reading line for an older shape", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.$$eval(".rbchat-diagram-fit", (els) => els.length), 0);
  assert.equal(await page.$$eval(".rbchat-diagram-reading", (els) => els.length), 0);
  await page.close();
});

test("a language switch relabels every picture's caption and reading line", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  await page.evaluate(() => document.documentElement.setAttribute("lang", "de"));
  await page.waitForFunction(() => [...document.querySelectorAll(".rbchat-diagram figcaption span")].map((e) => e.textContent).join("|") === "Context Map · Quoting|Aggregat · Quote");
  assert.doesNotMatch(await page.textContent(".rbchat-diagram:nth-of-type(1) .rbchat-diagram-reading"), /upstream to/);
  await page.close();
});

test("a second picture Mermaid cannot render falls back alone, and the first stays drawn", async () => {
  const broken = { ...PICTURES.aggregate, mermaid: "classDiagram\n  class n0[\"Quote\"] {\n    <<aggregate root>>\n" };
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", broken], ["text", { text: "Quoting." }]]);
  await page.waitForSelector(".rbchat-diagram-failed");
  assert.equal(await page.$$eval(".rbchat-diagram:nth-of-type(1) svg", (els) => els.length), 1);
  assert.equal(await page.$$eval(".rbchat-diagram:nth-of-type(2) .rbchat-diagram-failed", (els) => els.length), 1);
  await page.close();
});

test("a conversation read back draws every picture again, and a turn kept with one picture under the old key too", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg a").length > 0 && document.querySelectorAll(".rbchat-diagram").length === 2);
  await page.evaluate(() => {
    const kept = JSON.parse(sessionStorage.getItem("chat"));
    const t = kept.turns.find((x) => x.role === "assistant");
    t.diagram = t.diagrams[0]; delete t.diagrams;
    sessionStorage.setItem("chat", JSON.stringify(kept));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram").length === 1 && document.querySelector(".rbchat-diagram svg"));
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Context map · Quoting");
  await page.close();
});
```

If `sessionStorage`'s key is not `"chat"`, read `STORE_KEY` in `assets/chat.js` and use it.

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test test/chat.test.mjs test/chat-diagram.test.mjs`

Expected: FAIL. The captions read the bare title, only the last picture is drawn, and there is no reading line.

- [ ] **Step 4: Implement in `assets/chat.js`.**

The strings, English (line 127): add after `schema: "Meta-model",`:

```js
context: "Context map", aggregate: "Aggregate",
reading: { context: "Arrows run from upstream to downstream, each naming the pattern between the two contexts.", aggregate: "The root holds what the diamonds join; the dashed arrows are the events it emits." },
```

German (line 174), after `schema: "Meta-Modell",`:

```js
context: "Context Map", aggregate: "Aggregat",
reading: { context: "Die Pfeile laufen von upstream nach downstream und nennen je das Muster zwischen den beiden Kontexten.", aggregate: "Das Aggregate Root hält, was die Rauten verbinden; die gestrichelten Pfeile sind die Ereignisse, die es auslöst." },
```

The German lines go to the owner for the Translator's review in the pull request body, under `conventions/GERMAN.md`.

`figure(d)` becomes `figure(d, fit)`. After `fig.appendChild(cap); fig.appendChild(fig.rbBox);` add:

```js
    // Under a picture whose shape needs reading, one line says how; it is the widget's sentence,
    // in the page's language, never the host's or the model's.
    if (strings(langNow()).diagram.reading[d.shape]) fig.appendChild(el("p", "rbchat-diagram-reading"));
    // Several pictures under one answer are each fitted to the log, so the whole answer is seen
    // at once, and a click anywhere but a node's link opens one to be read, as a page's does.
    if (fit) {
      fig.classList.add("rbchat-diagram-fit");
      fig.rbBox.addEventListener("click", function(ev){
        if (modalFig === fig || (ev.target.closest && ev.target.closest("a"))) return;
        expandFigure(fig);
      });
    }
```

Below `figure`, add:

```js
  // An answer's pictures, in the order the host drew them, each after the one before.
  function placeFigures(ans, after, list){
    var at = after, fit = list.length > 1;
    list.forEach(function(d){ var f = figure(d, fit); ans.insertBefore(f, at.nextSibling); at = f; });
    return at;
  }
```

In `labelFigure`, after the caption line:

```js
    var reading = fig.querySelector(".rbchat-diagram-reading");
    if (reading) reading.textContent = s.reading[fig.rbDiagram && fig.rbDiagram.shape] || "";
```

In `send()`: the declaration gains `pictures = []` and loses `picture = null`; the event handler becomes

```js
          else if (name === "diagram" && data && typeof data.mermaid === "string") {
            // Every picture a message brings is drawn, in the order it came, in finish().
            pictures.push(data);
          }
```

`finish()`'s `if (picture) { … }` becomes `placeFigures(ans, body, pictures);`, and its `turns.push` writes `diagrams: pictures` in place of `diagram: picture`. Any other read of `picture` or `fig` in `send()` is replaced the same way; `grep -n 'picture\b' assets/chat.js` finds none left in `send()`.

In the restore, replace the `var diagram = …` line and the `if (diagram) ans.appendChild(figure(diagram));` line with:

```js
      // A turn keeps its pictures as `diagrams`; one kept by an earlier release carries a single
      // `diagram`, read as a list of one. The same gate as a live picture: one that is not a
      // picture is dropped rather than thrown on.
      var diagrams = (Array.isArray(t.diagrams) ? t.diagrams : t.diagram ? [t.diagram] : []).filter(function(d){ return d && typeof d.mermaid === "string"; });
```

then, after `linkQuestions(body);`, `placeFigures(ans, body, diagrams);`, and in that turn's `turns.push` write `diagrams: diagrams`.

Update the header comment (lines 24-27): a message's pictures each arrive as their own event and are all drawn under the answer in order, fitted to the log when there are several.

In `assets/chat.css`, after line 193:

```css
.rbchat-diagram-reading{margin:.35rem .1rem 0;font-size:.8rem;line-height:1.4;color:var(--dim)}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`

Expected: PASS, every existing diagram test included: one picture is still drawn as it was.

- [ ] **Step 6: Commit**

Subject: `An answer shows every picture the chat drew`. `Verified:` names `npm test` and the conventions scripts.

### Task 5: Seen in a browser, then the pull request

- [ ] **Step 1:** Serve a page carrying the built `assets/` (as `test/chat-diagram.test.mjs` does) answering with the two fixtures, and screenshot it in Chromium at 1280×900 and 390×844, dark and light. Expected: two fitted pictures under the answer, each with its caption and reading line, nothing wider than the log, the aggregate's member `Note "a" #1: {x} : string` drawn as written.
- [ ] **Step 2:** `npm test`, `sh conventions/conventions-check`, `sh conventions/conventions-format check`, all exit 0.
- [ ] **Step 3:** Push and open the pull request, titled `An answer shows every picture the chat drew`. The body says no site sees a change until a chat sends two pictures, asks for the Translator's review of the two German lines, names the screenshots, ends with `Verified:` and the 🤖 line. Stop.

---

## Part C — `companygraph/chat-server`

### Task 6: The note, the clause and the measurement

**Files:**

- Modify: `lib/loop.mjs` (`diagramNote`'s `drawn`, near line 131)
- Modify: `lib/prompt.mjs` (`DIAGRAM_RULE`, line 68, and the comment above it)
- Test: `test/loop.test.mjs`, `test/prompt.test.mjs`

**Interfaces:**

- Consumes: the host's `diagram` with the two new shapes (mcp-server Part A, released or run locally).
- Produces: nothing other repositories read.

- [ ] **Step 1: Write the failing tests.** In `test/loop.test.mjs`, at the end of "two diagrams in one message are two events, in the order they were drawn", add:

```js
  const notes = model.requests.at(-1).messages.flatMap((m) => Array.isArray(m.content) ? m.content : []).filter((c) => c.type === "tool_result").map((c) => typeof c.content === "string" ? c.content : JSON.stringify(c.content));
  assert.ok(notes.length >= 2 && notes.every((n) => !/the last one if you drew several/.test(n)), "the model is no longer told only the last picture shows");
  assert.ok(notes.some((n) => /every diagram you draw is shown/.test(n)));
```

If the fake model in that file records tool results under another key, read how the test "a diagram answer is the widget's to draw" reads what the model was shown, and read the notes the same way.

In `test/prompt.test.mjs`, beside the `DIAGRAM_RULE` assertions:

```js
  assert.match(DIAGRAM_RULE, /bounded context/);
  assert.match(DIAGRAM_RULE, /shape context and then shape aggregate, both with the context's id/);
  assert.match(DIAGRAM_RULE, /holds no aggregate/);
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test test/loop.test.mjs test/prompt.test.mjs`

Expected: FAIL on the three new prompt assertions and the note.

- [ ] **Step 3: Implement.** In `diagramNote`, `drawn` becomes:

```js
    drawn: "The widget draws every diagram you draw under your answer, in the order drawn: every diagram you draw is shown. Write one or two sentences naming what it shows, by the titles in nodes, calling each by its type as given, and state only the relations listed in relations, as they are labeled, never another, and never write the diagram itself.",
```

In `DIAGRAM_RULE`, after the clause about shape `schema` and before "Then write a sentence or two", insert:

```text
One who asks to see a bounded context, or the diagram of one, is shown shape context and then shape aggregate, both with the context's id, and the answer names what each drew; where aggregate refuses as empty, the map stands alone and the answer says the context holds no aggregate.
```

and in the opening, "with shape concepts, process or neighborhood" becomes "with shape concepts, process, neighborhood, context or aggregate". The comment above the rule gains one sentence: the two pictures of a context are asked for together because the widget now draws every picture a message brings.

- [ ] **Step 4: Run the suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Measure.** Per the owner's local measurement (`~/.config/chat-local.env` holds the key; never print it): serve a snapshot of `companygraph/mental-model` at `origin/main` with mcp-server Part A's build (`companygraph-mcp-snapshot --github companygraph/mental-model@<sha> --out snap.json`, then `PORT=<free> companygraph-mcp-http --snapshot snap.json` from that worktree), and run this branch's `node bin/http.mjs` against it, and a control worktree at `origin/main` against the same host, with `set -a; . ~/.config/chat-local.env`, `CHAT_METER=memory`, `CHAT_MONTH_TOKENS`, `CHAT_PROJECT`, `CHAT_REGION` set to any value, `CHAT_ORIGINS` matching the request's Origin, and `CHAT_MCP_URL` the local host. POST `/chat` with `X-Chat: 1` three questions to each: "can you show me the diagram of checking", "zeig mir den Bounded Context Answering", "how does Serving relate to the other contexts?". Read the answers, not a score: the change sends two `diagram` events for the first two, `context` then `aggregate`, and names only relations the note listed; the control sends one. Stop each server by its PID.
- [ ] **Step 6: Commit, push, open the pull request, stop.** Subject: `The chat asks for a context's map and its aggregates together`. The body names the measurement's six answers in a sentence each and says the deployments re-pin only after their site has taken design's release. `Verified:` names `npm test`, the conventions scripts and the measurement.

---

## After the plan: the owner's steps, in order

mcp-server's pull request merged, released as the next minor, and the three MCP hosts re-pinned. design's pull request merged and released, and blust.ch, companygraph.io and guestgraph.io take it in their next content re-pin. chat-server's pull request merged and released, and each chat deployment re-pinned after its own site. Every one of these waits for the owner's word; no agent merges, tags or deploys.
