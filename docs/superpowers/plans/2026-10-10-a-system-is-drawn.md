# A system is drawn in its landscape and by what it holds — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `diagram` draws one system two ways, shape `system` for the system in its landscape and shape `holds` for its data among the systems that hold the same, the chat widget draws the six ArchiMate element marks and captions both, and the chat asks for both when a visitor asks to see a system.

**Architecture:** The two shapes are two functions in `mcp-server`'s `lib/diagram.mjs` over one reader of a snapshot's systems, kinds, services, data objects and concepts, each writing a `flowchart LR` whose only words are the model's: names, kind names, interface and access tokens, and the `fak:fa-<element>` token a client draws as a mark. `robertblust/design`'s `chat.js` adds six marks to the icon pack it already registers under `fak`, captions the shapes and writes their reading lines. `chat-server` tells the model when to ask for both. Three repositories, one pull request each, in the order of Task 7.

**Tech Stack:** Node 22+, `node:test`, Zod, the MCP SDK, Mermaid 12.0.0 as `robertblust/design` vendors it, Playwright Chromium in design's suite.

**Spec:** `docs/superpowers/specs/2026-10-10-a-system-is-drawn-design.md` in `companygraph/mcp-server`, committed as `195ef40` on the branch `a-system-is-drawn`.

## Global Constraints

- The shapes' sources hold no word in any language: names from the model, the kind's name as `«Kind»`, a connection's `As`, `Carries` and `Via` joined by ` · `, a held row's `Access` as written, Mermaid syntax, and the token `fak:fa-<element>` where `<element>` is the kind's `element`.
- A box is a node of its own, `n0`, `n1` and on, each entity once; the middle is `n0` with the class `middle`. A service is a rounded box `(["…"])`, held data a cylinder `[("…")]`.
- Arrows: a connection `-->|"label"|` from the system the data comes from to the one that takes it; `-.-` without label from a part to what it runs on; `--o` from the middle to a service; a held row `==>` for `master`, `-->` for `writes`, `-.->` for `reads`, labeled with the token.
- `links` carries the model's word for each line: the connection label, `part-of`, `provided-by`, or the access token.
- At most 50 nodes (`DIAGRAM_CAP`); past it `cannot_draw` / `too_large`. `system` is never empty; `holds` with no row is `cannot_draw` / `empty`.
- `label()` is unchanged: the icon colon is already written with a zero-width space, and the tokens are written outside it.
- The six marks are defined in `lib/marks.mjs` beside the two natures' and carried as a copy in `chat.js`, held equal by the existing test; colored `--c-firm`.
- The captions are "Landscape" and "Data held"; the German is made by the translator from this English, read by the editor and the back-reader, with the owner's decision on the flags deferred to the pull request's review, since the owner is away.
- Every commit is an agent's: `--author "Implementer <implementer@companygraph.io>"` in the companygraph repositories and `--author "Implementer <implementer@blust.ch>"` in `robertblust/design`, with the trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, and `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The German is the Translator's commit with `Track: Prose`.
- `export PATH=/opt/homebrew/bin:$PATH` before any `node`, `npm`, `gh` or `sh conventions/…` command; a push names the helper, `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-system-is-drawn`.
- Nothing is merged, tagged, released or re-pinned without the owner's word. The chat-server's pin of `companygraph-mcp-server` does not move: the release it would take does not exist yet.

## Review Focus

1. A `## Holds` row whose concept resolves to no page and names no data object must be skipped, not drawn as a cylinder with an empty name. Pinned in Task 1.
2. A system reached three ways, as host, as source and as taker, must be one box with every line to it. Pinned in Task 1.
3. A system whose kind resolves to no page must draw with its name alone, no mark and no stereotype, rather than `fak:fa-undefined`. Pinned in Task 1.
4. A `## Connects to` row with every label cell empty must draw an unlabeled arrow, not `|""|`, which Mermaid draws as an empty label box. Pinned in Task 1.
5. A cylinder and a rounded box are flowchart nodes whose group ids still end in `-flowchart-n<k>-<i>`, so `nodeElement` must find and link them. Pinned in Task 3.

---

## Repositories and worktrees

Each task names the worktree it works in. All three exist on the branch `a-system-is-drawn`, cut from `main` at the commits the spec names, with `npm ci` run.

| Repository | Worktree |
| --- | --- |
| companygraph/mcp-server | `~/git/companygraph/mcp-server-a-system-is-drawn` |
| robertblust/design | `~/git/robertblust/design-a-system-is-drawn` |
| companygraph/chat-server | `~/git/companygraph/chat-server-a-system-is-drawn` |

`npm run fixtures` has run in mcp-server, which `pretest` also runs.

---

### Task 1: The `system` and `holds` shapes

**Repository:** companygraph/mcp-server, its worktree.

**Files:**

- Modify: `lib/diagram.mjs` — the reader `landscapeOf()`, `systemDiagram()` and `holdsDiagram()` before the argument table, `TAKES.id`, the `DiagramRequest` typedef, the dispatch in `diagram()`
- Modify: `lib/schemas.mjs:13` — `SHAPES` gains `"system"` and `"holds"`
- Modify: `types/lib/diagram.d.mts`, `types/lib/schemas.d.mts` — written by `npm run build`, never by hand
- Test: `test/diagram.test.mjs` — the list of shapes in the arguments test, and the tests at the end

**Interfaces:**

- Consumes: `requireId`, `requireType` from `lib/model.mjs`; `text`, `byName`, `label`, `notA`, `cannot`, `DIAGRAM_CAP`, `namer` inside `lib/diagram.mjs`.
- Produces: `diagram(s, { shape: "system", id })` and `diagram(s, { shape: "holds", id })` returning the `diagram` answer: `title` the system's name, `nodes` with `type` one of `system`, `service`, `data-object`, `concept`, `links` with the model's word, `edges` the number of `links`, `omitted` 0. Task 2 and the widget read these.

- [ ] **Step 1: Write the failing tests**

In `test/diagram.test.mjs`, the arguments test's first line becomes

```js
  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood, schema, context, aggregate, flow, lifecycle, organization, system, holds" });
```

and these tests are appended at the end of the file:

```js
// The landscape: the example's Billing service runs on the Beacon cluster, feeds the Invoice
// mailer over one interface, provides the Invoice feed and holds six concepts, one of them as a
// data object. Fixtures edit the example's systems in place: the shapes read entities alone.
const S = (name) => s.entities.find((e) => e.type === "system" && e.name === name).id;
const land = (edit = {}, add = []) => {
  const m = structuredClone(s);
  for (const e of m.entities) if (e.type === "system" && edit[e.name]) edit[e.name](e);
  m.entities.push(...add);
  return m;
};
const CONNECTS = ["System", "As", "Service", "Carries", "Via"];
const system = (id, name, fields, sections = []) => ({ id, type: "system", name, fields: { id, source: "Local", ...fields }, sections });
const BILLING = [
  "flowchart LR",
  '  n0["fak:fa-application-component <b>Billing service</b><br/><small>«Service»</small>"]:::middle',
  '  n1["fak:fa-node <b>Beacon cluster</b><br/><small>«Platform»</small>"]',
  "  n0 -.- n1",
  '  n2["fak:fa-application-component <b>Invoice mailer</b><br/><small>«SaaS»</small>"]',
  '  n0 -->|"Feed endpoint · Invoice · REST"| n2',
  '  n3(["Invoice feed"])',
  "  n0 --o n3",
  '  n4[("Invoice record<br/><small>Invoice</small>")]',
  '  n0 ==>|"master"| n4',
  '  n5[("Invoice line")]',
  '  n0 ==>|"master"| n5',
  '  n6[("Credit note")]',
  '  n0 ==>|"master"| n6',
  '  n7[("Pricing rule")]',
  '  n0 ==>|"master"| n7',
  '  n8[("Customer")]',
  '  n0 -.->|"reads"| n8',
  '  n9[("Usage record")]',
  '  n0 -.->|"reads"| n9',
  "  classDef middle stroke-width:2px",
];

test("a system is drawn in its landscape: its host, what takes its data, its service and what it holds", () => {
  const d = diagram(s, { shape: "system", id: S("Billing service") });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["system", "Billing service", 9, 0, COMMIT]);
  assert.deepEqual(lines(d), BILLING);
  assert.deepEqual(d.nodes.map((n) => [n.node, n.title, n.type]), [
    ["n0", "Billing service", "system"], ["n1", "Beacon cluster", "system"], ["n2", "Invoice mailer", "system"], ["n3", "Invoice feed", "service"],
    ["n4", "Invoice record", "data-object"], ["n5", "Invoice line", "concept"], ["n6", "Credit note", "concept"], ["n7", "Pricing rule", "concept"],
    ["n8", "Customer", "concept"], ["n9", "Usage record", "concept"],
  ]);
  assert.deepEqual(d.nodes[0], { node: "n0", id: S("Billing service"), title: "Billing service", type: "system" });
  assert.equal(d.nodes[4].id, I("data-objects/invoice-record"));
  assert.deepEqual(d.links, [
    { from: "n0", to: "n1", label: "part-of" }, { from: "n0", to: "n2", label: "Feed endpoint · Invoice · REST" }, { from: "n0", to: "n3", label: "provided-by" },
    { from: "n0", to: "n4", label: "master" }, { from: "n0", to: "n5", label: "master" }, { from: "n0", to: "n6", label: "master" }, { from: "n0", to: "n7", label: "master" },
    { from: "n0", to: "n8", label: "reads" }, { from: "n0", to: "n9", label: "reads" },
  ]);
});

test("a system whose data arrives draws the arrow in, and one that only hosts draws its part", () => {
  const mailer = diagram(s, { shape: "system", id: S("Invoice mailer") });
  assert.deepEqual(lines(mailer), [
    "flowchart LR",
    '  n0["fak:fa-application-component <b>Invoice mailer</b><br/><small>«SaaS»</small>"]:::middle',
    '  n1["fak:fa-application-component <b>Billing service</b><br/><small>«Service»</small>"]',
    '  n1 -->|"Feed endpoint · Invoice · REST"| n0',
    '  n2[("Invoice record<br/><small>Invoice</small>")]',
    '  n0 -.->|"reads"| n2',
    '  n3[("Customer")]',
    '  n0 -.->|"reads"| n3',
    "  classDef middle stroke-width:2px",
  ]);
  assert.deepEqual(mailer.links[0], { from: "n1", to: "n0", label: "Feed endpoint · Invoice · REST" });
  const cluster = diagram(s, { shape: "system", id: S("Beacon cluster") });
  assert.deepEqual(lines(cluster), [
    "flowchart LR",
    '  n0["fak:fa-node <b>Beacon cluster</b><br/><small>«Platform»</small>"]:::middle',
    '  n1["fak:fa-application-component <b>Billing service</b><br/><small>«Service»</small>"]',
    "  n1 -.- n0",
    "  classDef middle stroke-width:2px",
  ]);
  assert.deepEqual([cluster.edges, cluster.links], [1, [{ from: "n1", to: "n0", label: "part-of" }]]);
});

test("a planned system is dashed, a bare connection row is an unlabeled arrow, and a system reached three ways is one box", () => {
  const ARCHIVE = "01a0ffff-0000-7000-8000-0000000000e1";
  const m = land({
    // The cluster also feeds the service, over an interface alone, and takes a bare row from it.
    "Billing service": (e) => e.sections.push({ heading: "Connects to", tables: [{ columns: CONNECTS, rows: [["Beacon cluster", "Node metrics", "", "", ""]] }] }),
    "Beacon cluster": (e) => { e.sections.push({ heading: "Connects to", tables: [{ columns: CONNECTS, rows: [["Billing service", "", "", "", ""]] }] }); },
  }, [system(ARCHIVE, "Archive", { kind: "SaaS", lifecycle: "planned" }, [{ heading: "Connects to", tables: [{ columns: CONNECTS, rows: [["Billing service", "", "", "Invoice", "SFTP"]] }] }])]);
  const d = diagram(m, { shape: "system", id: S("Billing service") });
  const got = lines(d);
  assert.deepEqual(got.slice(0, 6), [
    "flowchart LR",
    '  n0["fak:fa-application-component <b>Billing service</b><br/><small>«Service»</small>"]:::middle',
    '  n1["fak:fa-node <b>Beacon cluster</b><br/><small>«Platform»</small>"]',
    "  n0 -.- n1",
    '  n1 -->|"Node metrics"| n0',
    "  n0 --> n1",
  ]);
  assert.ok(got.includes('  n3["fak:fa-application-component <b>Archive</b><br/><small>«SaaS»</small>"]:::planned'), d.mermaid);
  assert.ok(got.includes('  n0 -->|"Invoice · SFTP"| n3'), d.mermaid);
  assert.deepEqual(got.slice(-2), ["  classDef middle stroke-width:2px", "  classDef planned stroke-dasharray:5 4"]);
  assert.equal(d.nodes.filter((n) => n.title === "Beacon cluster").length, 1);
  assert.deepEqual(d.links.slice(0, 3), [{ from: "n0", to: "n1", label: "part-of" }, { from: "n1", to: "n0", label: "Node metrics" }, { from: "n0", to: "n1", label: "" }]);
  const retired = diagram(land({ "Invoice mailer": (e) => { e.fields.lifecycle = "retired"; } }), { shape: "system", id: S("Invoice mailer") });
  assert.ok(lines(retired).includes("  classDef retiring stroke-dasharray:2 3") && lines(retired)[1].endsWith(":::middle"), retired.mermaid);
});

test("a kind that resolves to no page draws the name alone, and a held row that resolves to nothing is skipped", () => {
  const m = land({ "Invoice mailer": (e) => { e.fields.kind = "Nowhere"; e.sections.find((x) => x.heading === "Holds").tables[0].rows.push(["Ghost", "", "reads"]); } });
  const d = diagram(m, { shape: "system", id: S("Invoice mailer") });
  assert.equal(lines(d)[1], '  n0["<b>Invoice mailer</b>"]:::middle');
  assert.ok(!d.mermaid.includes("Ghost") && !d.mermaid.includes("undefined"), d.mermaid);
  assert.equal(d.nodes.length, 4);
});

test("what a system holds is drawn among the systems that hold the same, the master heavy", () => {
  const d = diagram(s, { shape: "holds", id: S("Invoice mailer") });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted], ["holds", "Invoice mailer", 4, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["fak:fa-application-component <b>Invoice mailer</b><br/><small>«SaaS»</small>"]:::middle',
    '  n1[("Invoice record<br/><small>Invoice</small>")]',
    '  n0 -.->|"reads"| n1',
    '  n2[("Customer")]',
    '  n0 -.->|"reads"| n2',
    '  n3["fak:fa-application-component <b>Billing service</b><br/><small>«Service»</small>"]',
    '  n3 ==>|"master"| n1',
    '  n3 -.->|"reads"| n2',
    "  classDef middle stroke-width:2px",
  ]);
  assert.deepEqual(d.nodes.map((n) => [n.node, n.type]), [["n0", "system"], ["n1", "data-object"], ["n2", "concept"], ["n3", "system"]]);
  assert.deepEqual(d.links, [{ from: "n0", to: "n1", label: "reads" }, { from: "n0", to: "n2", label: "reads" }, { from: "n3", to: "n1", label: "master" }, { from: "n3", to: "n2", label: "reads" }]);
  const billing = diagram(s, { shape: "holds", id: S("Billing service") });
  assert.deepEqual([billing.title, billing.nodes.length, billing.edges], ["Billing service", 8, 8]);
  assert.ok(lines(billing).includes('  n7 -.->|"reads"| n1'), billing.mermaid);
  refused(() => diagram(s, { shape: "holds", id: S("Beacon cluster") }), "cannot_draw", { shape: "holds", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
});

test("the two shapes refuse what they cannot draw, and a name is never read as a mark", () => {
  const crowd = land({}, Array.from({ length: DIAGRAM_CAP }, (_, i) => system(`01a0ffff-0000-7000-8000-0000000003${String(i).padStart(2, "0")}`, `Taker ${String(i).padStart(2, "0")}`, { kind: "SaaS" },
    [{ heading: "Connects to", tables: [{ columns: CONNECTS, rows: [["Billing service", "", "", "", ""]] }] }])));
  refused(() => diagram(crowd, { shape: "system", id: S("Billing service") }), "cannot_draw", { shape: "system", reason: "too_large", nodes: DIAGRAM_CAP + 10, limit: DIAGRAM_CAP });
  const holders = land({}, Array.from({ length: DIAGRAM_CAP }, (_, i) => system(`01a0ffff-0000-7000-8000-0000000004${String(i).padStart(2, "0")}`, `Reader ${String(i).padStart(2, "0")}`, { kind: "SaaS" },
    [{ heading: "Holds", tables: [{ columns: ["Concept", "Data object", "Access"], rows: [["Customer", "", "reads"]] }] }])));
  refused(() => diagram(holders, { shape: "holds", id: S("Invoice mailer") }), "cannot_draw", { shape: "holds", reason: "too_large", nodes: DIAGRAM_CAP + 4, limit: DIAGRAM_CAP });
  for (const shape of ["system", "holds"]) {
    refused(() => diagram(s, { shape, id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a system" });
    refused(() => diagram(s, { shape }), "invalid_argument", { argument: "id", reason: `needed by ${shape}` });
    refused(() => diagram(instanceSnapshot(), { shape, id: "nothing/here" }), "unknown_type");
  }
  const odd = diagram(land({ "Beacon cluster": (e) => { e.name = "Node fas:fa-x"; } }), { shape: "system", id: S("Billing service") });
  assert.ok(lines(odd).includes('  n1["fak:fa-node <b>Node fas:​fa-x</b><br/><small>«Platform»</small>"]'), odd.mermaid);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/diagram.test.mjs` Expected: FAIL. The new tests refuse with `invalid_argument` on `shape`, and the arguments test fails on the list it now expects.

- [ ] **Step 3: Write the shapes**

In `lib/schemas.mjs:13`:

```js
export const SHAPES = /** @type {const} */ (["concepts", "process", "neighborhood", "schema", "context", "aggregate", "flow", "lifecycle", "organization", "system", "holds"]);
```

In `lib/diagram.mjs`, after `organization()` and before the comment `// Which shape takes which argument`, add:

```js
// The landscape pack, read once for both of a system's pictures: its kinds, which carry the
// ArchiMate element a client draws as a mark before the name and whose name is the stereotype
// under it, and the services, data objects and concepts its tables reach. Nothing here is a word:
// a box's second line is the kind's own name, an arrow's label the interface or the access token
// as the row writes it, and what a dotted line or a heavy arrow means is the client's reading line.
const ACCESS_ARROW = { master: "==>", writes: "-->", reads: "-.->" };
/**
 * @param {Snapshot} s
 */
function landscapeOf(s) {
  requireType(s, "system");
  /** @param {string} type */
  const named = (type) => new Map(s.entities.filter((e) => e.type === type).map((e) => [e.name, e]));
  const kinds = named("system-kind"), objects = named("data-object"), concepts = named("concept");
  const systems = s.entities.filter((e) => e.type === "system"), services = s.entities.filter((e) => e.type === "service");
  // A table's rows by column, each cell its text, so a missing column reads as empty.
  /** @param {Entity} e @param {string} heading @returns {Record<string, string>[]} */
  const rows = (e, heading) => {
    const t = e.sections.find((x) => x.heading === heading)?.tables?.[0];
    return t ? t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, text(r[i]).trim()]))) : [];
  };
  // A kind that resolves to no page gives the name alone: no mark of an element nobody named.
  /** @param {Entity} sys */
  const box = (sys) => {
    const kind = kinds.get(text(sys.fields?.kind)), element = text(kind?.fields?.element);
    return `${kind && element ? `fak:fa-${element} ` : ""}<b>${label(sys.name)}</b>${kind ? `<br/><small>«${label(kind.name)}»</small>` : ""}`;
  };
  /** @param {Entity} sys */
  const lifecycle = (sys) => { const l = text(sys.fields?.lifecycle); return l === "planned" ? "planned" : l === "retiring" || l === "retired" ? "retiring" : ""; };
  /** @param {Record<string, string>} r */
  const connection = (r) => [r.As, r.Carries, r.Via].filter(Boolean).join(" · ");
  // A held row's cylinder: the data object over its concept, or the concept alone where the
  // system keeps it in no modeled form; a row that resolves to neither draws nothing.
  /** @param {Record<string, string>} r @returns {{ e: Entity; text: string } | null} */
  const cylinder = (r) => {
    const obj = objects.get(r["Data object"] ?? ""), con = concepts.get(r.Concept ?? "");
    if (obj) return { e: obj, text: `${label(obj.name)}<br/><small>${label(r.Concept)}</small>` };
    return con ? { e: con, text: label(con.name) } : null;
  };
  /** @param {Snapshot} s @param {string} id */
  const middleOf = (s, id) => { const e = requireId(s, id); if (e.type !== "system") throw notA("id", e, "system"); return e; };
  return { kinds, systems, services, rows, box, lifecycle, connection, cylinder, middleOf };
}

// The drawing both shapes share: a box per system, declared once with its lifecycle's class,
// a cylinder per held row, and the classes the source used, the middle's always.
/** @param {ReturnType<typeof landscapeOf>} L @param {Entity} middle */
function landscapeDrawing(L, middle) {
  const { nodes, of } = namer();
  const lines = ["flowchart LR"];
  const /** @type {DiagramLink[]} */ links = [];
  const /** @type {Set<string>} */ declared = new Set(), /** @type {Set<string>} */ used = new Set();
  /** @param {Entity} sys */
  const system = (sys) => {
    const n = of(sys);
    if (declared.has(n)) return n;
    declared.add(n);
    const cls = sys.id === middle.id ? "middle" : L.lifecycle(sys);
    if (cls) used.add(cls);
    lines.push(`  ${n}["${L.box(sys)}"]${cls ? `:::${cls}` : ""}`);
    return n;
  };
  /** @param {string} from @param {Record<string, string>} r */
  const held = (from, r) => {
    const c = L.cylinder(r);
    if (!c) return;
    const n = of(c.e);
    if (!declared.has(n)) { declared.add(n); lines.push(`  ${n}[("${c.text}")]`); }
    const access = r.Access ?? "";
    lines.push(`  ${from} ${ACCESS_ARROW[/** @type {keyof typeof ACCESS_ARROW} */ (access)] ?? "-->"}|"${label(access)}"| ${n}`);
    links.push({ from, to: n, label: access });
  };
  /** @param {DiagramKind} shape */
  const finish = (shape) => {
    if (nodes.length > DIAGRAM_CAP) throw cannot(shape, "too_large", nodes.length, middle);
    lines.push("  classDef middle stroke-width:2px");
    if (used.has("planned")) lines.push("  classDef planned stroke-dasharray:5 4");
    if (used.has("retiring")) lines.push("  classDef retiring stroke-dasharray:2 3");
    return { title: middle.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0 };
  };
  return { nodes, of, lines, links, system, held, finish };
}

/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function systemDiagram(s, id) {
  const L = landscapeOf(s), middle = L.middleOf(s, id);
  const D = landscapeDrawing(L, middle);
  const me = D.system(middle);
  const byNameOf = new Map(L.systems.map((x) => [x.name, x]));
  const host = byNameOf.get(text(middle.fields?.["part-of"]));
  if (host && host.id !== middle.id) { const n = D.system(host); D.lines.push(`  ${me} -.- ${n}`); D.links.push({ from: me, to: n, label: "part-of" }); }
  for (const part of [...L.systems].sort(byName)) {
    if (part.id === middle.id || text(part.fields?.["part-of"]) !== middle.name) continue;
    const n = D.system(part); D.lines.push(`  ${n} -.- ${me}`); D.links.push({ from: n, to: me, label: "part-of" });
  }
  /** @param {string} from @param {string} to @param {Record<string, string>} r */
  const flow = (from, to, r) => { const l = L.connection(r); D.lines.push(`  ${from} -->${l ? `|"${label(l)}"|` : ""} ${to}`); D.links.push({ from, to, label: l }); };
  for (const r of L.rows(middle, "Connects to")) { const src = byNameOf.get(r.System ?? ""); if (src) flow(D.system(src), me, r); }
  for (const taker of [...L.systems].sort(byName)) {
    if (taker.id === middle.id) continue;
    for (const r of L.rows(taker, "Connects to")) if (r.System === middle.name) flow(me, D.system(taker), r);
  }
  for (const svc of [...L.services].sort(byName)) {
    if (!names(svc.fields?.["provided-by"]).includes(middle.name)) continue;
    const n = D.of(svc); D.lines.push(`  ${n}(["${label(svc.name)}"])`, `  ${me} --o ${n}`); D.links.push({ from: me, to: n, label: "provided-by" });
  }
  for (const r of L.rows(middle, "Holds")) D.held(me, r);
  return D.finish("system");
}

/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function holdsDiagram(s, id) {
  const L = landscapeOf(s), middle = L.middleOf(s, id);
  const mine = new Set(L.rows(middle, "Holds").map((r) => r.Concept).filter(Boolean));
  const others = L.systems.filter((x) => x.id !== middle.id).sort(byName);
  const held = [middle, ...others].flatMap((sys) => L.rows(sys, "Holds").filter((r) => mine.has(r.Concept) && L.cylinder(r)).map((r) => ({ sys, r })));
  if (!held.length) throw cannot("holds", "empty", 0);
  const D = landscapeDrawing(L, middle);
  for (const { sys, r } of held) D.held(D.system(sys), r);
  return D.finish("holds");
}
```

`names` is already defined near the top of the file, as is `byName`. Then the argument table and the dispatch:

```js
const TAKES = { id: ["process", "neighborhood", "context", "aggregate", "flow", "lifecycle", "organization", "system", "holds"], domain: ["concepts"], type: ["schema"] };
```

In the `DiagramRequest` typedef, `Exclude<DiagramKind, "concepts" | "schema" | "organization">` already covers the two new shapes, which take a required `id`; no change. In `diagram()`'s dispatch, before `: shape === "organization" ? organization(s, id) : schemas(s, type);`:

```js
    : shape === "system" ? systemDiagram(s, /** @type {string} */ (id)) : shape === "holds" ? holdsDiagram(s, /** @type {string} */ (id))
```

The file's head comment says "Six shapes"; make it "The shapes" and add one clause: ", a system in its landscape and what it holds among the systems that hold the same".

- [ ] **Step 4: Run the shape's tests, then the suite**

Run: `npm run build && node --test test/diagram.test.mjs` Expected: PASS. Then `npm test && npm run build:check` Expected: PASS, every test; `✓ types/ is what the JSDoc in lib/, bin/ and deploy/ declares`. Then `sh conventions/conventions-check && sh conventions/conventions-format check`.

- [ ] **Step 5: Commit**

```bash
git add lib/diagram.mjs lib/schemas.mjs types/lib/diagram.d.mts types/lib/schemas.d.mts test/diagram.test.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
A system is drawn in its landscape and by what it holds

diagram gains two shapes of one system named by its id. system draws it with a heavier border among what it runs on, what runs on it, the systems it exchanges data with, the services it provides as rounded boxes and the data it holds as cylinders; holds draws those cylinders among every other system that masters, writes or reads the same concepts. A box carries the ArchiMate element of its kind as a fak token a client draws as a mark, and the kind's name as its stereotype; a connection's arrow is labeled with the interface, what is carried and how, a held row's with its access, heavy for the master's copy. links carries the model's word for every line.

Verified: npm test passes; build:check, conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The shapes in the interface

**Repository:** companygraph/mcp-server, its worktree.

**Files:**

- Modify: `lib/tools.mjs:170-174` — the description names both shapes; `id`'s description names the system
- Modify: `README.md:23` — the row for `diagram`
- Modify: `scripts/interface.mjs:44` — two examples, the Billing service
- Modify: `docs/INTERFACE.md` — two headings for the examples, then regenerated by `npm run interface`
- Test: `test/contract.test.mjs`, `test/consumer-types.test.mjs`, `deploy/test/tools.mjs`

**Interfaces:**

- Consumes: the answers of Task 1.
- Produces: the published interface a client reads: `docs/INTERFACE.md`'s sections "`diagram` of a system" and "`diagram` of what a system holds".

- [ ] **Step 1: Write the failing tests**

In `test/contract.test.mjs`, after the organization test:

```js
test("a system and what it holds answer in the schema over the example, and are refused where no system is written", async () => {
  const s = exampleSnapshot();
  const client = await connect(s);
  const id = idAt(s, "systems/billing-service");
  const sys = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "system", id } }));
  assert.deepEqual([sys.shape, sys.title, sys.nodes.length, sys.links.length], ["system", "Billing service", 10, 9]);
  const held = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "holds", id } }));
  assert.deepEqual([held.shape, held.title, held.nodes.map((/** @type {{ type: string }} */ n) => n.type).filter((t) => t === "system").length], ["holds", "Billing service", 2]);
  const { error } = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "holds", id: idAt(s, "systems/beacon-cluster") } }));
  assert.deepEqual([error.code, error.details], ["cannot_draw", { shape: "holds", reason: "empty", nodes: 0, limit: 50 }]);
  await client.close();
  const without = await connect(instanceSnapshot());
  for (const shape of ["system", "holds"]) {
    const r = checkAnswer("diagram", await without.callTool({ name: "diagram", arguments: { shape, id: "nothing/here" } }));
    assert.deepEqual([r.error.code, r.error.details.type], ["unknown_type", "system"]);
  }
  await without.close();
});
```

In `test/consumer-types.test.mjs`, the `shape` union gains `| "system" | "holds"`. In `deploy/test/tools.mjs`, after the organization test:

```js
  // A system's two pictures reach a deployment with a re-pin, so each draws its own. An instance
  // without the landscape pack holds no system and skips; one that only hosts holds nothing.
  test("every system draws its landscape, and what it holds or says it holds nothing", async (t) => {
    const systems = s.entities.filter((e) => e.type === "system");
    if (!systems.length) return t.skip("this instance holds no system");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    for (const sys of systems) {
      const d = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "system", id: sys.id } }));
      if (d.error) assert.deepEqual([d.error.code, d.error.details.reason], ["cannot_draw", "too_large"], sys.name);
      else assert.ok(d.nodes.every((/** @type {{ type: string }} */ n) => ["system", "service", "data-object", "concept"].includes(n.type)), d.mermaid);
      const h = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "holds", id: sys.id } }));
      if (h.error) assert.ok(["empty", "too_large"].includes(h.error.details.reason), `${sys.name}: ${h.error.code}`);
      else assert.ok(h.nodes.every((/** @type {{ type: string }} */ n) => ["system", "data-object", "concept"].includes(n.type)), h.mermaid);
    }
    await client.close();
  });
```

- [ ] **Step 2: Run them**

Run: `node --test test/contract.test.mjs test/consumer-types.test.mjs` Expected: PASS; Task 1 already answers in the schema. `deploy/test/tools.mjs` runs through `test/deploy-tools.test.mjs` in Step 4.

- [ ] **Step 3: Write the description, the README row and the examples**

In `lib/tools.mjs`, the `diagram` tool's `description` becomes

```text
A picture of the model as Mermaid, from edges or schemas. Use to show connections; for edge data use list_references. Input: `shape`; `id`, `domain` or `type` narrow it; aggregate, flow or lifecycle takes a context's `id` for its aggregates; organization without `id` draws the company; system and holds take a system's `id`. Returns `mermaid`, `nodes`, `links`, `title`, `edges`, `omitted`, schema's `everyType`, lifecycle's `transitions`. At most 50 nodes.
```

and `id`'s `describe` becomes "The process, the entity at a neighborhood's middle, the bounded context of a context map, or the aggregate or bounded context of an aggregate, flow or lifecycle picture, the group an organization is narrowed to, or the system of a system or holds picture". In `README.md:23` the row's cell ends ", or the organization: its people and open positions by group, or one system: in its landscape, and by the data it holds". In `scripts/interface.mjs`, after the organization example:

```js
  "`diagram` of a system": { name: "diagram", arguments: { shape: "system", id: idAt(example, "systems/billing-service") } },
  "`diagram` of what a system holds": { name: "diagram", arguments: { shape: "holds", id: idAt(example, "systems/invoice-mailer") } },
```

In `docs/INTERFACE.md`, after the section "### `diagram` of the organization" and before "## Paging", insert two sections in the same form, "### `diagram` of a system" and "### `diagram` of what a system holds", each a sentence and the fences the script fills; then in the paragraph that describes `diagram`, after the organization's sentences, add: "`system` takes the `id` of a system and draws it in its landscape, a flowchart from left to right: the system with the class `middle`, the system its `part-of` names and each system whose `part-of` names it joined by an unlabeled dotted line, every system a row of its `## Connects to` names with a solid arrow to it and every system whose `## Connects to` names it with a solid arrow from it, each labeled with the row's `As`, `Carries` and `Via` that are present joined by ` · `, every service whose `provided-by` names it as a rounded box reached by a line ending in a circle, and each row of its `## Holds` as a cylinder, the data object's name over its concept or the concept's name alone, reached by an arrow labeled with the row's access, `==>` for `master`, `-->` for `writes` and `-.->` for `reads`. A box's label begins with `fak:fa-` and the `element` of the system's kind, a token for a client to draw as a mark, and ends with the kind's name in `«…»` as a stereotype; a system whose `lifecycle` is `planned` has the class `planned`, `retiring` or `retired` the class `retiring`. `holds` takes the same `id` and draws the concepts that system holds as cylinders, one per data object and one per concept kept in no modeled form, with that system and every other whose `## Holds` names one of those concepts, each row an arrow as above; it is refused as `empty` where the system holds nothing. `links` of both carry the model's word for each line: the connection's label, `part-of`, `provided-by` or the access token; `nodes` type each as `system`, `service`, `data-object` or `concept`. Both are refused with `unknown_type` on an instance without the landscape pack and with `invalid_argument` on `id` for an id of another type." Then run `npm run interface`.

- [ ] **Step 4: Run the suite**

Run: `npm test && npm run build:check && sh conventions/conventions-check && sh conventions/conventions-format check` Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tools.mjs README.md scripts/interface.mjs docs/INTERFACE.md test/contract.test.mjs test/consumer-types.test.mjs deploy/test/tools.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The interface names a system's two pictures

The tool's description, the README's row and INTERFACE.md say what system and holds draw and that both take a system's id, with an example of each over the example company. The contract test holds both answers to the schema and their refusals on an instance without the landscape pack, and every deployment's suite draws both over its own systems.

Verified: npm test passes; build:check, conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Push and open the pull request**

```bash
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-system-is-drawn
gh pr create --title "A system is drawn in its landscape and by what it holds" --body "…"
```

The body in the git register: what the two shapes draw, that the spec and this plan ride on the branch, the verification line, and the Claude Code line. Nothing is merged.

---

### Task 3: The marks, the captions and the reading lines in the widget, English

**Repository:** robertblust/design, its worktree.

**Files:**

- Modify: `lib/marks.mjs` — six marks beside the two
- Modify: `assets/chat.js` — `MARKS` and `withMarks()`'s class; the strings `diagram.system`, `diagram.holds`, `diagram.reading.system`, `diagram.reading.holds` in English and, as a placeholder the test refuses, German
- Modify: `assets/chat.css` — the element marks' color after the agent's
- Test: `test/chat.test.mjs`, `test/chat-diagram.test.mjs`, `test/fixtures/diagrams.json`

**Interfaces:**

- Consumes: the `diagram` events carrying Task 1's answers: `shape: "system"` and `"holds"`, `mermaid` with `fak:fa-<element>` tokens, the class `middle`, cylinders and rounded boxes.
- Produces: `MARKS` from `lib/marks.mjs` with eight keys, each an SVG body on a 16-unit square in `currentColor`.

- [ ] **Step 1: Write the failing tests**

In `test/fixtures/diagrams.json`, add two pictures, the answers Task 1 gives for the Billing service's `system` and the Invoice mailer's `holds`, byte for byte as `node -e` prints them from the mcp-server worktree, plus the planned fixture of Task 1's third test as `planned`; `nodes` with their ids from the fixture snapshot. In `test/chat.test.mjs`, the caption test's key list gains `"holds"` and `"system"` (sorted), the organization test's `assert.deepEqual(Object.keys(MARKS), ["human", "agent"])` becomes `["human", "agent", "application-component", "node", "system-software", "device", "equipment", "communication-network"]`, and after it:

```js
test("a system's two pictures are captioned and have reading lines in both languages", () => {
  assert.equal(diagramCaption({ shape: "system", title: "Chat server" }, "en"), "Landscape · Chat server");
  assert.equal(diagramCaption({ shape: "holds", title: "Chat server" }, "en"), "Data held · Chat server");
  for (const lang of ["en", "de"]) for (const shape of ["system", "holds"]) assert.ok(strings(lang).diagram.reading[shape].length > 20, `${lang} ${shape}`);
  assert.match(strings("en").diagram.reading.system, /a dotted line joins a system to what it runs on/);
  assert.match(strings("en").diagram.reading.holds, /a heavy arrow marks the system whose copy leads/);
});

test("the German is the translator's: a system's reading lines are no placeholder", () => {
  for (const shape of ["system", "holds"]) assert.doesNotMatch(strings("de").diagram.reading[shape], /PROVISIONAL/, `${shape}: the German is the translator's, made from the reviewed English`);
});
```

In `test/chat-diagram.test.mjs`, at the end:

```js
test("a system draws the element's mark in each box at the firm brightness, links its cylinders and its service, and sets the middle apart", async () => {
  const { page } = await asked([["diagram", PICTURES.system], ["text", { text: "The Billing service." }]]);
  await page.waitForSelector(".rbchat-diagram svg .label-icon");
  const marks = await page.$$eval(".rbchat-diagram svg .rbchat-mark", (ms) => ms.map((m) => [m.getAttribute("class"), getComputedStyle(m).color]));
  assert.deepEqual(marks.map((m) => m[0]), ["rbchat-mark element application-component", "rbchat-mark element node", "rbchat-mark element application-component"]);
  const firm = await page.$eval(".rbchat-diagram-box", (b) => { const t = document.createElement("i"); t.style.color = "var(--c-firm)"; b.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; });
  for (const [, color] of marks) assert.equal(color, firm);
  for (const n of PICTURES.system.nodes) {
    const href = await page.$eval(`.rbchat-diagram svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`, n.title);
  }
  const widths = await page.$$eval(".rbchat-diagram svg g.node", (gs) => gs.map((g) => [g.classList.contains("middle"), getComputedStyle(g.querySelector("rect, path, polygon")).strokeWidth]));
  const [middle, other] = [widths.find((w) => w[0])[1], widths.find((w) => !w[0])[1]];
  assert.ok(parseFloat(middle) > parseFloat(other), `the middle's border is heavier: ${middle} over ${other}`);
  assert.equal(await page.$eval(".rbchat-diagram figcaption span", (s) => s.textContent), "Landscape · Billing service");
  assert.match(await page.$eval(".rbchat-diagram-reading", (p) => p.textContent), /what it runs on/);
  assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
  await page.close();
});

test("what a system holds is captioned and read, and a planned system is dashed", async () => {
  const { page } = await asked([["diagram", PICTURES.holds], ["diagram", PICTURES.planned], ["text", { text: "The Invoice mailer." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  const captions = await page.$$eval(".rbchat-diagram figcaption span", (ss) => ss.map((s) => s.textContent));
  assert.deepEqual(captions, ["Data held · Invoice mailer", "Landscape · Billing service"]);
  assert.match(await page.$eval(".rbchat-diagram-reading", (p) => p.textContent), /whose copy leads/);
  const dash = await page.$eval(".rbchat-diagram svg g.node.planned rect", (r) => getComputedStyle(r).strokeDasharray);
  assert.notEqual(dash, "none");
  assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
  await page.close();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/chat.test.mjs` Expected: FAIL on the marks' keys and the captions.

- [ ] **Step 3: Write the marks, the strings and the style**

In `lib/marks.mjs`, the comment gains a sentence and `MARKS` six entries:

```js
// The two natures' marks, as the Processes page draws them: a filled figure for a person and an
// outlined machine for an agent, on a 16-unit square, each in currentColor. After them the six
// ArchiMate elements a system's kind may name, drawn as the standard's own icons: a component
// with its two tabs, a node as a cube, system software as a disc with a circle on its rim, a
// device as a screen on a stand, equipment as a gear and a network as joined nodes. The chat
// widget carries the same bodies, since it is a script a page loads and imports nothing, and a
// test holds its copy to this one.
export const MARKS = {
  human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
  agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>',
  "application-component": '<rect x="4.5" y="2" width="9.5" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="4.6" width="5" height="2.4" fill="currentColor"/><rect x="2" y="9" width="5" height="2.4" fill="currentColor"/>',
  node: '<path d="M2.5 5.5L5.5 2.5H13.5V10.5L10.5 13.5H2.5ZM2.5 5.5H10.5V13.5M10.5 5.5L13.5 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  "system-software": '<circle cx="7" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10.5" cy="5.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  device: '<rect x="2" y="2.5" width="12" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 14h6M8 11v3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  equipment: '<circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2.3M8 12.2v2.3M1.5 8h2.3M12.2 8h2.3M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6l1.6-1.6M11 5l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  "communication-network": '<circle cx="3.2" cy="11.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="4.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="11.5" r="2.1" fill="currentColor"/><path d="M5 10.2L11 5.8M5.3 11.5h5.4" stroke="currentColor" stroke-width="1.3"/>',
};
```

In `assets/chat.js`, `MARKS` carries the same eight bodies, each on a line of its own; a key holding a hyphen is quoted in both files, `"application-component": '…'`, so the existing test's check becomes `src.includes(`${/^[a-z]+$/.test(k) ? k : JSON.stringify(k)}: '${body}'`)`. `withMarks` builds the class: `'<g class="rbchat-mark ' + (k === "human" || k === "agent" ? k : "element " + k) + '">'`. The comment above `MARKS` gains: "and the six ArchiMate elements a system's kind names, at the firm brightness".

The strings, English: in `diagram`, after `organization: "Organization"`, `system: "Landscape", holds: "Data held"`; in `reading`, after the organization's line: `system: "Solid arrows run from the system the data comes from to the one that takes it, labeled with the interface, what is carried and how; a dotted line joins a system to what it runs on; a rounded box is a service the system provides; a cylinder is data it holds, by a heavy arrow where its copy leads, a solid one where it writes and a dotted one where it only reads.", holds: "Each cylinder is data kept of the concept named under it; a heavy arrow marks the system whose copy leads, a solid one a system that writes a copy of its own, a dotted one a system that only reads."`. German: `system: "Landschaft", holds: "Datenbestand"` as placeholders for the captions and `system: "PROVISIONAL", holds: "PROVISIONAL"` for the reading lines, which Task 4 replaces.

In `assets/chat.css`, after `.rbchat-diagram-box svg .rbchat-mark.agent{…}`:

```css
.rbchat-diagram-box svg .rbchat-mark.element{color:var(--c-firm,var(--ink))!important}
```

and the comment above gains "a system's element mark is the firm brightness too, since a system is a thing and not an agent".

- [ ] **Step 4: Run the tests, then the suite**

Run: `node --test test/chat.test.mjs test/chat-diagram.test.mjs` Expected: PASS but the German placeholder test, which fails until Task 4. Then `npm test` Expected: every other test passes; `sh conventions/conventions-check && sh conventions/conventions-format check` pass.

- [ ] **Step 5: Commit**

```bash
git add lib/marks.mjs assets/chat.js assets/chat.css test/chat.test.mjs test/chat-diagram.test.mjs test/fixtures/diagrams.json
git commit --author "Implementer <implementer@blust.ch>" -F- <<'EOF'
The chat marks a system with its ArchiMate element and captions its two pictures

The diagram tool's system and holds shapes write fak:fa-<element> before each system's name, the element its kind names. The widget registers the six elements' marks beside the two natures', drawn as the standard's own icons at the firm brightness, and defines them once in lib/marks.mjs with the others. The captions are Landscape and Data held, each with a reading line in English; the German reading lines wait for the translator, and their test fails until it does.

Verified: npm test passes but the German placeholder's own test; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: The widget's German

**Repository:** robertblust/design, its worktree.

**Files:**

- Modify: `assets/chat.js` — the German `diagram.system`, `diagram.holds`, `diagram.reading.system`, `diagram.reading.holds`
- Test: `test/chat.test.mjs`, `test/spelling.test.mjs` where a German word trips the British scan

- [ ] **Step 1: Run the roles**

The translator of `conventions/TRANSLATOR.md`, with `GLOSSARY.md` and `GERMAN.md` open, makes the German of the two captions and the two reading lines from the English of Task 3. The editor of `EDITOR.md` reads it without the English and reports corrections and flags. The back-reader of `BACKREADER.md` renders the corrected German into literal English. The session sets the English against that rendering. Each is a subagent given its file and the strings, as `WRITING.md` describes.

- [ ] **Step 2: Write the German**

Replace the four placeholders with the translator's text, the editor's corrections in and each flag's first option taken; the flags themselves are listed in the pull request for the owner to settle.

- [ ] **Step 3: Run the suite**

Run: `npm test && sh conventions/conventions-check && sh conventions/conventions-format check` Expected: PASS, every test.

- [ ] **Step 4: Commit, push and open the pull request**

```bash
git add assets/chat.js test/spelling.test.mjs
git commit --author "Translator <translator@blust.ch>" -F- <<'EOF'
A system's captions and reading lines in German

Made from the reviewed English by the translator, read by the editor without the English and rendered back by the back-reader, whose literal English matched the original. The editor's flags are listed in the pull request for the owner to settle.

Verified: npm test passes; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Prose
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-system-is-drawn
gh pr create --title "The chat marks a system with its ArchiMate element and captions its two pictures" --body "…"
```

---

### Task 5: The chat asks for both shapes

**Repository:** companygraph/chat-server, its worktree.

**Files:**

- Modify: `lib/prompt.mjs:98` — `DIAGRAM_RULE`
- Modify: `types/lib/prompt.d.mts` — written by `npm run build`
- Test: `test/prompt.test.mjs`

- [ ] **Step 1: Write the failing test**

In `test/prompt.test.mjs`, the shape list assertion becomes `/shape concepts, process, neighborhood, context, aggregate, flow, lifecycle, organization, system or holds/` and after it:

```js
  assert.match(DIAGRAM_RULE, /One who asks to see a system, or the diagram of one, what it connects to, what runs on it or what it runs on, or what data it holds, is shown shape system and then shape holds, both with the system's id, and the answer names what each drew; where holds refuses as empty, the landscape stands alone and the answer says in one sentence that the model names no data the system holds/);
  assert.match(DIAGRAM_RULE, /One who asks which system masters a concept is answered in words from the pages through get_entity, and shown no picture unless they ask to see one/);
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/prompt.test.mjs` Expected: FAIL on the shape list.

- [ ] **Step 3: Write the clause**

In `DIAGRAM_RULE`, the shape list becomes "with shape concepts, process, neighborhood, context, aggregate, flow, lifecycle, organization, system or holds", and after the sentence ending "shown no picture unless they ask to see one." insert: "One who asks to see a system, or the diagram of one, what it connects to, what runs on it or what it runs on, or what data it holds, is shown shape system and then shape holds, both with the system's id, and the answer names what each drew; where holds refuses as empty, the landscape stands alone and the answer says in one sentence that the model names no data the system holds. One who asks which system masters a concept is answered in words from the pages through get_entity, and shown no picture unless they ask to see one." The comment above the rule gains one sentence on the system's two pictures.

- [ ] **Step 4: Run the suite**

Run: `npm run build && npm test && npm run build:check && sh conventions/conventions-check && sh conventions/conventions-format check` Expected: PASS.

- [ ] **Step 5: Commit, push and open the pull request**

```bash
git add lib/prompt.mjs types/lib/prompt.d.mts test/prompt.test.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The chat draws a system's two pictures when asked to see one

DIAGRAM_RULE gains the two shapes and one clause: a visitor who asks to see a system, what it connects to, what runs on what or what data it holds is shown shape system and then shape holds, both with the system's id; where holds refuses as empty the landscape stands alone and the answer says the model names no data the system holds. Which system masters a concept stays a question answered in words.

Verified: npm test passes; build:check passes. The pin of companygraph-mcp-server and the measurement wait for the mcp-server and design releases.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin a-system-is-drawn
gh pr create --title "The chat draws a system's two pictures when asked to see one" --body "…"
```

---

### Task 6: The plan rides with the spec

**Repository:** companygraph/mcp-server, its worktree.

- [ ] **Step 1: Commit this plan** before Task 1's commit, as the Specifier:

```bash
git add docs/superpowers/plans/2026-10-10-a-system-is-drawn.md
git commit --author "Specifier <specifier@companygraph.io>" -F- <<'EOF'
The plan for a system's two pictures

Five tasks across three repositories: the two shapes and their interface in mcp-server, the marks, captions and reading lines in design with the German made by the roles, and the chat's clause. Each repository's pull request opens for the owner's review; nothing merges, releases or re-pins.

Verified: conventions-check and conventions-format pass on the plan.

Process: Delivery
Phase: Spec
Track: Code
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: Order and hand-off

1. Task 6, then Tasks 1 and 2 in mcp-server; its pull request opens.
2. Tasks 3 and 4 in design; its pull request opens, listing the editor's flags.
3. Task 5 in chat-server; its pull request opens, saying its pin waits for the mcp-server release.
4. The hand-off to the owner names the three pull requests, what each waits for, the measurement left undone because the release does not exist, and the German flags to settle. Nothing is merged.
