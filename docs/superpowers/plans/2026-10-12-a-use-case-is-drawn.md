# A use case is drawn in its scope, as its scenario and by what it is held to — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `diagram` draws a use case three ways, `usecase` in its scope, `scenario` as its steps and extensions, `requirements` as what a feature, a product, a use case or a requirement is held to; the chat widget draws the actor's mark and captions the three; and the chat asks for them.

**Architecture:** Three functions in `mcp-server`'s `lib/diagram.mjs` over one reader of a snapshot's use cases, requirements, seats and profiles, each writing a flowchart whose only words are the model's. `robertblust/design`'s `chat.js` adds one mark, three captions and three reading lines. `chat-server` tells the model when to ask and words each line in its note. Three repositories, one pull request each, in the order of Task 7.

**Tech Stack:** Node 22+, `node:test`, Zod, Mermaid 12.0.0 as design vendors it, Playwright Chromium in design's suite.

**Spec:** `docs/superpowers/specs/2026-10-12-a-use-case-is-drawn-design.md`, committed as `4f410d1` on the branch `a-use-case-is-drawn`.

## Global Constraints

- The sources hold no word in any language: names, level, scope, kind and modality tokens, step labels, actions, conditions and handlings from the model, the field and section names `includes`, `features`, `Applies to` and `follows` as labels, Mermaid syntax, and the tokens `fak:fa-human`, `fak:fa-agent` and `fak:fa-actor`.
- A node is `n0`, `n1` and on, each entity once; a string actor, a trigger and an extension are boxes named `a0`, `t0` and `x0` and on, in no `nodes`. The middle has the class `middle`; a requirement has `must` or `may` by its modality; an extension has `ext`. A source defines each class it uses.
- Shapes: a use case `(["…"])`, a requirement `{{"…"}}`, a feature, product, rule, seat or step `["…"]`, a trigger `(["…"])`.
- At most 50 nodes (`DIAGRAM_CAP`); `usecase` and `requirements` of a requirement are never empty; `scenario` with no step and `requirements` of a thing nothing applies to are `empty`.
- `label()` is unchanged; the tokens are written outside it.
- The actor's mark is defined in `lib/marks.mjs` and carried as a copy in `chat.js`, held equal by the existing test, colored `--c-firm`. The captions are "Use case", "Scenario" and "Requirements"; the German is made by the roles after the English and listed in the pull request for the owner.
- Commits: `--author "Implementer <implementer@companygraph.io>"` in the companygraph repositories and `--author "Implementer <implementer@blust.ch>"` in design, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; the German is the Translator's with `Track: Prose`.
- `export PATH=/opt/homebrew/bin:$PATH` before any command; a push names the helper. The chat-server's pin of `companygraph-mcp-server` does not move until the release exists.
- Nothing is merged, tagged, released or re-pinned without the owner's word.

## Review Focus

1. A `primary-actor` or a step `Actor` that is a string equal to no seat must draw as an `a`-box with the actor's mark and never throw or appear in `nodes`. Pinned in Task 1.
2. A seat held by a human and an agent must take the human's mark; one held by agents only the agent's; one held by nobody the actor's. Pinned in Task 1.
3. An extension whose `Step` names no step of the scenario must be counted in `omitted`, not drawn from nowhere and not refused. Pinned in Task 1.
4. A requirement whose `## Applies to` names the middle twice, by two rows, must be one hexagon with one arrow. Pinned in Task 1.
5. `requirements` given a feature on a model without the pack must refuse with `unknown_type` naming `requirement`, not draw an empty picture. Pinned in Task 1.

---

## Repositories and worktrees

| Repository | Worktree |
| --- | --- |
| companygraph/mcp-server | `~/git/companygraph/mcp-server-a-use-case-is-drawn`, exists, `npm ci` and `npm run fixtures` run |
| robertblust/design | `~/git/robertblust/design-a-use-case-is-drawn`, cut from `main` at the spec's commit, `npm ci` |
| companygraph/chat-server | `~/git/companygraph/chat-server-a-use-case-is-drawn`, cut from `main`, `npm ci` |

---

### Task 1: The three shapes

**Repository:** companygraph/mcp-server.

**Files:**

- Modify: `lib/diagram.mjs` — the reader `requirementsOf()`, `usecaseDiagram()`, `scenarioDiagram()`, `requirementsDiagram()` before the argument table, `TAKES.id`, the dispatch; the head comment's list of shapes
- Modify: `lib/schemas.mjs` — `SHAPES` gains `"usecase"`, `"scenario"`, `"requirements"`; the output gains optional `steps` and `extensions`
- Modify: `types/lib/*.d.mts` — by `npm run build`
- Test: `test/diagram.test.mjs`, `test/consumer-types.test.mjs`

**Interfaces:**

- Consumes: `requireId`, `requireType` from `lib/model.mjs`; `text`, `names`, `byName`, `label`, `notA`, `cannot`, `namer`, `DIAGRAM_CAP` in `lib/diagram.mjs`.
- Produces: `diagram(s, { shape: "usecase" | "scenario" | "requirements", id })`; `scenario` answers `steps: [{ step, actor, action }]` and `extensions: [{ step, condition, handling }]`.

- [ ] **Step 1: Write the failing tests**

The arguments test's shape list gains `, usecase, scenario, requirements`. Append to `test/diagram.test.mjs`:

```js
// The requirements pack: the example's Download an invoice, a user goal in scope system whose
// Payer is a string actor, includes Find an invoice, asks of Invoice download and is held to one
// requirement. Fixtures edit the example's pages in place: the shapes read entities alone.
const U = (name) => s.entities.find((e) => e.type === "use-case" && e.name === name).id;
const R = (name) => s.entities.find((e) => e.type === "requirement" && e.name === name).id;
const req = (edit = {}, add = []) => {
  const m = structuredClone(s);
  for (const e of m.entities) if (edit[e.type]?.[e.name]) edit[e.type][e.name](e);
  m.entities.push(...add);
  return m;
};
const PAYER = 'a0["fak:fa-actor <b>Payer</b>"]';
const DOWNLOAD = [
  "flowchart LR",
  `  ${PAYER}`,
  '  subgraph scope ["system"]',
  '    n0(["<b>Download an invoice</b><br/><small>«user goal»</small>"]):::middle',
  '    n1(["Find an invoice<br/><small>«subfunction»</small>"])',
  '    n0 -.->|"includes"| n1',
  "  end",
  "  a0 --> n0",
  '  n2["Invoice download<br/><small>«feature»</small>"]',
  '  n0 -->|"features"| n2',
  '  n3{{"<b>A copy is the invoice as issued</b><br/><small>«functional · must»</small>"}}:::must',
  "  n3 -.-> n0",
  "  classDef middle stroke-width:2px",
  "  classDef must stroke-width:2px",
];

test("a use case is drawn in its scope: the actor outside, what it includes and asks of, and what it is held to", () => {
  const d = diagram(s, { shape: "usecase", id: U("Download an invoice") });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["usecase", "Download an invoice", 4, 0, COMMIT]);
  assert.deepEqual(lines(d), DOWNLOAD);
  assert.deepEqual(d.nodes.map((n) => [n.node, n.title, n.type]), [["n0", "Download an invoice", "use-case"], ["n1", "Find an invoice", "use-case"], ["n2", "Invoice download", "feature"], ["n3", "A copy is the invoice as issued", "requirement"]]);
  assert.deepEqual(d.links, [{ from: "a0", to: "n0", label: "" }, { from: "n0", to: "n1", label: "includes" }, { from: "n0", to: "n2", label: "features" }, { from: "n3", to: "n0", label: "Applies to" }]);
  // A subfunction with no scope has no frame, and nothing applies to it.
  assert.deepEqual(lines(diagram(s, { shape: "usecase", id: U("Find an invoice") })), ["flowchart LR", `  ${PAYER}`, '  n0(["<b>Find an invoice</b><br/><small>«subfunction»</small>"]):::middle', "  a0 --> n0", "  classDef middle stroke-width:2px"]);
});

test("an actor that is a seat takes the mark of who holds it: a human's, an agent's, or the actor's where nobody does", () => {
  const seat = (id, name) => ({ id, type: "seat", name, fields: { id, source: "Local" }, sections: [] });
  const profile = (id, name, nature, seats) => ({ id, type: "profile", name, fields: { id, source: "Local", nature, seats }, sections: [] });
  const m = req({ "use-case": { "Download an invoice": (e) => { e.fields["primary-actor"] = "Billing Clerk"; } } }, [
    seat("01a0ffff-0000-7000-8000-0000000000a1", "Billing Clerk"), profile("01a0ffff-0000-7000-8000-0000000000a2", "Ines", "human", ["Billing Clerk"]), profile("01a0ffff-0000-7000-8000-0000000000a3", "Clerk Agent", "agent", ["Billing Clerk"]),
  ]);
  const human = diagram(m, { shape: "usecase", id: U("Download an invoice") });
  assert.equal(lines(human)[1], '  n0["fak:fa-human <b>Billing Clerk</b>"]');
  assert.deepEqual(human.nodes[0], { node: "n0", id: "01a0ffff-0000-7000-8000-0000000000a1", title: "Billing Clerk", type: "seat" });
  const agents = diagram(req({ "use-case": { "Download an invoice": (e) => { e.fields["primary-actor"] = "Billing Clerk"; } } }, [seat("01a0ffff-0000-7000-8000-0000000000a1", "Billing Clerk"), profile("01a0ffff-0000-7000-8000-0000000000a3", "Clerk Agent", "agent", ["Billing Clerk"])]), { shape: "usecase", id: U("Download an invoice") });
  assert.equal(lines(agents)[1], '  n0["fak:fa-agent <b>Billing Clerk</b>"]');
  const nobody = diagram(req({ "use-case": { "Download an invoice": (e) => { e.fields["primary-actor"] = "Billing Clerk"; } } }, [seat("01a0ffff-0000-7000-8000-0000000000a1", "Billing Clerk")]), { shape: "usecase", id: U("Download an invoice") });
  assert.equal(lines(nobody)[1], '  n0["fak:fa-actor <b>Billing Clerk</b>"]');
});

test("a scenario is the trigger, the steps in order with who acts, and each extension dashed from its step", () => {
  const d = diagram(s, { shape: "scenario", id: U("Download an invoice") });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted], ["scenario", "Download an invoice", 5, 0]);
  assert.deepEqual(lines(d), [
    "flowchart TB",
    '  t0(["The payer#39;s bookkeeping asks for the invoice of a closed billing period."])',
    '  s0["fak:fa-actor <b>Payer</b><br/><small>1</small> Finds the invoice on the Invoice Page, as Find an invoice says"]',
    "  t0 --> s0",
    '  s1["fak:fa-actor <b>Payer</b><br/><small>2</small> Asks for a copy"]',
    "  s0 --> s1",
    '  s2["fak:fa-actor <b>System</b><br/><small>3</small> Hands over the invoice as it was issued, every line and its explanation"]',
    "  s1 --> s2",
    '  x0["<small>1a</small> The billing period is still open, so no invoice is issued yet<br/><i>The page says when the period closes, and the payer comes back then, so the use case ends without a copy</i>"]:::ext',
    "  s0 -.-> x0",
    '  x1["<small>3a</small> A credit note has been issued against the invoice since<br/><i>The copy is still the invoice as issued, and the page names the credit note beside it</i>"]:::ext',
    "  s2 -.-> x1",
    "  classDef ext stroke-dasharray:5 4",
  ]);
  assert.deepEqual(d.nodes, [], "a string actor's step is no entity");
  assert.deepEqual(d.steps, [{ step: "1", actor: "Payer", action: "Finds the invoice on the Invoice Page, as Find an invoice says" }, { step: "2", actor: "Payer", action: "Asks for a copy" }, { step: "3", actor: "System", action: "Hands over the invoice as it was issued, every line and its explanation" }]);
  assert.deepEqual(d.extensions.map((x) => x.step), ["1a", "3a"]);
  assert.deepEqual(d.links.map((l) => [l.from, l.to, l.label]), [["t0", "s0", "1"], ["s0", "s1", "2"], ["s1", "s2", "3"], ["s0", "x0", "1a"], ["s2", "x1", "3a"]]);
});
```

Then:

```js
test("a step whose actor is a seat links to it, an extension naming no step is left out and counted, and a scenario with no step is refused", () => {
  const m = req({ "use-case": { "Download an invoice": (e) => {
    const t = e.sections.find((x) => x.heading === "Main success scenario").tables[0];
    t.rows[1] = ["2", "Backend Engineer", "Asks for a copy"];
    e.sections.find((x) => x.heading === "Extensions").tables[0].rows.push(["9a", "Nothing", "Nothing happens"]);
  } } });
  const d = diagram(m, { shape: "scenario", id: U("Download an invoice") });
  assert.deepEqual(d.nodes.map((n) => [n.node, n.title, n.type]), [["s1", "Backend Engineer", "seat"]]);
  assert.ok(lines(d).some((l) => l.startsWith('  s1["fak:fa-human <b>Backend Engineer</b>')), d.mermaid);
  assert.equal(d.omitted, 1);
  assert.ok(!d.mermaid.includes("9a"), d.mermaid);
  const none = req({ "use-case": { "Find an invoice": (e) => { e.sections.find((x) => x.heading === "Main success scenario").tables[0].rows = []; } } });
  refused(() => diagram(none, { shape: "scenario", id: U("Find an invoice") }), "cannot_draw", { shape: "scenario", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
});

test("the requirements of a use case, a feature and a requirement are drawn by the id's type", () => {
  const uc = diagram(s, { shape: "requirements", id: U("Download an invoice") });
  assert.deepEqual(lines(uc), [
    "flowchart LR",
    '  n0(["<b>Download an invoice</b><br/><small>«use-case»</small>"]):::middle',
    '  subgraph functional ["functional"]',
    '    n1{{"<b>A copy is the invoice as issued</b><br/><small>«must»</small>"}}:::must',
    "  end",
    "  n1 --> n0",
    "  classDef middle stroke-width:2px",
    "  classDef must stroke-width:2px",
  ]);
  assert.deepEqual(uc.links, [{ from: "n1", to: "n0", label: "Applies to" }]);
  refused(() => diagram(s, { shape: "requirements", id: I("features/invoice-download") }), "cannot_draw", { shape: "requirements", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  const one = diagram(s, { shape: "requirements", id: R("A copy is the invoice as issued") });
  assert.deepEqual(lines(one), [
    "flowchart LR",
    '  n0{{"<b>A copy is the invoice as issued</b><br/><small>«functional · must»</small>"}}:::middle',
    '  n1(["Download an invoice<br/><small>«use-case»</small>"])',
    '  n0 -->|"Applies to"| n1',
    "  classDef middle stroke-width:2px",
  ]);
});

test("a should is plain, a may dashed, a rule followed is dotted, two rows to one thing are one arrow, and the kinds stand in their order", () => {
  const rule = { id: "01a0ffff-0000-7000-8000-0000000000b1", type: "rule", name: "A copy is kept", fields: { id: "01a0ffff-0000-7000-8000-0000000000b1", source: "Local" }, sections: [] };
  const requirement = (id, name, kind, modality, rows, follows = []) => ({ id, type: "requirement", name, fields: { id, source: "Local", kind, modality, ...(follows.length ? { follows } : {}) }, sections: [{ heading: "Applies to", tables: [{ columns: ["Type", "Entity"], rows }] }] });
  const m = req({ requirement: { "A copy is the invoice as issued": (e) => { e.sections.find((x) => x.heading === "Applies to").tables[0].rows.push(["use-case", "Download an invoice"]); } } }, [
    rule,
    requirement("01a0ffff-0000-7000-8000-0000000000b2", "A copy arrives within a minute", "quality", "should", [["use-case", "Download an invoice"]]),
    requirement("01a0ffff-0000-7000-8000-0000000000b3", "A copy may be a PDF", "constraint", "may", [["use-case", "Download an invoice"], ["feature", "Invoice download"]], ["A copy is kept"]),
  ]);
  const d = diagram(m, { shape: "requirements", id: U("Download an invoice") });
  const got = lines(d);
  assert.equal(got.filter((l) => l.includes("A copy is the invoice as issued")).length, 1, "two rows naming the middle are one hexagon");
  assert.equal(d.links.filter((l) => l.to === "n0").length, 3);
  assert.ok(got.indexOf('  subgraph functional ["functional"]') < got.indexOf('  subgraph quality ["quality"]') && got.indexOf('  subgraph quality ["quality"]') < got.indexOf('  subgraph constraint ["constraint"]'), d.mermaid);
  assert.ok(got.some((l) => l.includes("A copy arrives within a minute") && !l.includes(":::")), "a should has no class");
  assert.ok(got.some((l) => l.includes("A copy may be a PDF") && l.endsWith(":::may")), "a may is dashed");
  assert.ok(got.includes('  n4["A copy is kept<br/><small>«rule»</small>"]') && got.some((l) => /n\d+ -\.->\|"follows"\| n4/.test(l)), d.mermaid);
  assert.deepEqual(got.slice(-3), ["  classDef middle stroke-width:2px", "  classDef must stroke-width:2px", "  classDef may stroke-dasharray:5 4"]);
  const feature = diagram(m, { shape: "requirements", id: I("features/invoice-download") });
  assert.equal(feature.nodes.filter((n) => n.type === "requirement").length, 1);
});

test("the three shapes refuse what they cannot draw, and a name is never read as a mark", () => {
  const crowd = req({}, Array.from({ length: DIAGRAM_CAP }, (_, i) => ({ id: `01a0ffff-0000-7000-8000-0000000005${String(i).padStart(2, "0")}`, type: "requirement", name: `Requirement ${i}`, fields: { id: `01a0ffff-0000-7000-8000-0000000005${String(i).padStart(2, "0")}`, source: "Local", kind: "functional", modality: "must" }, sections: [{ heading: "Applies to", tables: [{ columns: ["Type", "Entity"], rows: [["use-case", "Download an invoice"]] }] }] })));
  refused(() => diagram(crowd, { shape: "requirements", id: U("Download an invoice") }), "cannot_draw", { shape: "requirements", reason: "too_large", nodes: DIAGRAM_CAP + 2, limit: DIAGRAM_CAP });
  for (const shape of ["usecase", "scenario"]) {
    refused(() => diagram(s, { shape, id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a use-case" });
    refused(() => diagram(s, { shape }), "invalid_argument", { argument: "id", reason: `needed by ${shape}` });
    refused(() => diagram(instanceSnapshot(), { shape, id: "nothing/here" }), "unknown_type", { type: "requirement" });
  }
  refused(() => diagram(s, { shape: "requirements", id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a feature, product, use-case or requirement" });
  refused(() => diagram(instanceSnapshot(), { shape: "requirements", id: idAt(instanceSnapshot(), "surfaces/blust-ch-website") }), "unknown_type", { type: "requirement" });
  const odd = diagram(req({ "use-case": { "Find an invoice": (e) => { e.name = "Find fas:fa-x"; } } }), { shape: "usecase", id: U("Find an invoice") });
  assert.ok(lines(odd)[2].includes("Find fas:#8203;fa-x"), odd.mermaid);
});
```

The reference instance holds no pack type, so the pack is required before the id is read: every shape refuses with `unknown_type` naming `requirement` there, whatever the id. `refused()`'s third argument is matched as the existing tests match it; where it compares the whole `details`, the `unknown_type` details also carry `declared`, so compare `e.details.type` alone in that case.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/diagram.test.mjs` Expected: FAIL, the new shapes refused as `invalid_argument` on `shape`.

- [ ] **Step 3: Write the shapes**

`lib/schemas.mjs`: `SHAPES` gains the three; in `OUTPUTS.diagram` after `transitions`:

```js
    steps: z.array(z.strictObject({ step: z.string(), actor: z.string(), action: z.string() })).optional(),
    extensions: z.array(z.strictObject({ step: z.string(), condition: z.string(), handling: z.string() })).optional(),
```

`lib/diagram.mjs`, after `holdsDiagram()` and before the argument table:

```js
// The requirements pack, read once for a use case's three pictures: the seats and who holds
// them, for the mark an actor carries; the requirements and what each applies to. Nothing here
// is a word: a box's second line is the model's token or type, an arrow's label the field or
// section that drew it, and what a dashed box or a hexagon means is the client's reading line.
const KINDS = ["functional", "quality", "constraint"];
/** @param {Snapshot} s */
function requirementsOf(s) {
  requireType(s, "requirement");
  requireType(s, "use-case");
  /** @param {string} type */
  const named = (type) => new Map(s.entities.filter((e) => e.type === type).map((e) => [e.name, e]));
  const seats = named("seat"), useCases = named("use-case"), features = named("feature"), products = named("product"), rules = named("rule");
  const profiles = s.entities.filter((e) => e.type === "profile");
  // The mark a seat carries: the human's where a human holds it, the agent's where only agents do,
  // the actor's where nobody does. A name that is no seat is an actor outside, a box and no node.
  /** @param {string} name */
  const markOf = (name) => {
    const seat = seats.get(name);
    if (!seat) return "actor";
    const holders = profiles.filter((p) => names(p.fields?.seats).includes(name)).map((p) => text(p.fields?.nature));
    return holders.includes("human") ? "human" : holders.length ? "agent" : "actor";
  };
  /** @param {Entity} e @param {string} heading @returns {Record<string, string>[]} */
  const rows = (e, heading) => {
    const t = e.sections.find((x) => x.heading === heading)?.tables?.[0];
    return t ? t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, text(r[i]).trim()]))) : [];
  };
  const requirements = s.entities.filter((e) => e.type === "requirement").sort(byName);
  /** @param {string} type @param {Entity} e */
  const appliedTo = (type, e) => requirements.filter((r) => rows(r, "Applies to").some((row) => row.Type === type && row.Entity === e.name));
  /** @param {Entity} r */
  const modality = (r) => { const m = text(r.fields?.modality); return m === "must" ? "must" : m === "may" ? "may" : ""; };
  /** @param {Entity} r @param {boolean} kindToo */
  const hexagon = (r, kindToo) => `<b>${label(r.name)}</b><br/><small>«${kindToo ? `${label(text(r.fields?.kind))} · ` : ""}${label(text(r.fields?.modality))}»</small>`;
  const byType = { feature: features, product: products, "use-case": useCases };
  return { seats, useCases, rules, byType, markOf, rows, requirements, appliedTo, modality, hexagon };
}

// What the three pictures share: a box per entity, declared once, and the classes the source used.
/** @param {Entity} middle @param {string} first */
function requirementsDrawing(middle, first) {
  const { nodes, of } = namer();
  const lines = [first];
  const /** @type {DiagramLink[]} */ links = [];
  const /** @type {Set<string>} */ declared = new Set(), /** @type {Set<string>} */ used = new Set();
  /** @param {Entity} e @param {string} body @param {string} [cls] */
  const declare = (e, body, cls = "") => {
    const n = of(e);
    if (declared.has(n)) return n;
    declared.add(n);
    const c = e.id === middle.id ? "middle" : cls;
    if (c) used.add(c);
    lines.push(`  ${body.replace("{n}", n)}${c ? `:::${c}` : ""}`);
    return n;
  };
  /** @param {DiagramKind} shape @param {Record<string, unknown>} [extra] */
  const finish = (shape, extra = {}) => {
    if (nodes.length > DIAGRAM_CAP) throw cannot(shape, "too_large", nodes.length, middle);
    lines.push("  classDef middle stroke-width:2px");
    if (used.has("must")) lines.push("  classDef must stroke-width:2px");
    if (used.has("may")) lines.push("  classDef may stroke-dasharray:5 4");
    return { title: middle.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0, ...extra };
  };
  return { nodes, of, lines, links, declare, finish };
}

/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function usecaseDiagram(s, id) {
  const Q = requirementsOf(s);
  const uc = requireId(s, id);
  if (uc.type !== "use-case") throw notA("id", uc, "use-case");
  const D = requirementsDrawing(uc, "flowchart LR");
  // The actor stands first, outside any frame: a seat is a node with the mark of who holds it,
  // any other name a box with the actor's mark and no node.
  const actorName = text(uc.fields?.["primary-actor"]), seat = Q.seats.get(actorName);
  let actor = "a0";
  if (seat) actor = D.declare(seat, `{n}["fak:fa-${Q.markOf(actorName)} <b>${label(seat.name)}</b>"]`);
  else D.lines.push(`  a0["fak:fa-actor <b>${label(actorName)}</b>"]`);
  // The frame is the scope, written only where one is; inside it the lines take two more spaces.
  const scope = text(uc.fields?.scope);
  const indent = scope ? "  " : "";
  if (scope) D.lines.push(`  subgraph scope ["${label(scope)}"]`);
  /** @param {Entity} u */
  const ucBox = (u) => `${indent}{n}(["${u.id === uc.id ? "<b>" : ""}${label(u.name)}${u.id === uc.id ? "</b>" : ""}<br/><small>«${label(text(u.fields?.level))}»</small>"])`;
  const me = D.declare(uc, ucBox(uc));
  for (const inc of names(uc.fields?.includes)) {
    const sub = Q.useCases.get(inc); if (!sub) continue;
    const n = D.declare(sub, ucBox(sub));
    D.lines.push(`  ${indent}${me} -.->|"includes"| ${n}`); D.links.push({ from: me, to: n, label: "includes" });
  }
  if (scope) D.lines.push("  end");
  D.lines.push(`  ${actor} --> ${me}`); D.links.push({ from: actor, to: me, label: "" });
  for (const f of names(uc.fields?.features)) {
    const fe = Q.byType.feature.get(f); if (!fe) continue;
    const n = D.declare(fe, `{n}["${label(fe.name)}<br/><small>«feature»</small>"]`);
    D.lines.push(`  ${me} -->|"features"| ${n}`); D.links.push({ from: me, to: n, label: "features" });
  }
  for (const r of Q.appliedTo("use-case", uc)) {
    const n = D.declare(r, `{n}{{"${Q.hexagon(r, true)}"}}`, Q.modality(r));
    D.lines.push(`  ${n} -.-> ${me}`); D.links.push({ from: n, to: me, label: "Applies to" });
  }
  return D.finish("usecase");
}
```

`declare` pushes `  ` before the body it is given, so a body that starts with the frame's two spaces lands at four, as the expected sources have it.

```js
/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function scenarioDiagram(s, id) {
  const Q = requirementsOf(s);
  const uc = requireId(s, id);
  if (uc.type !== "use-case") throw notA("id", uc, "use-case");
  const steps = Q.rows(uc, "Main success scenario").filter((r) => r.Step);
  if (!steps.length) throw cannot("scenario", "empty", 0);
  const /** @type {DiagramNode[]} */ nodes = [];
  const lines = ["flowchart TB"];
  const /** @type {DiagramLink[]} */ links = [];
  const trigger = uc.sections.find((x) => x.heading === "Trigger")?.text ?? "";
  if (trigger.trim()) lines.push(`  t0(["${label(trigger.trim())}"])`);
  /** @type {Map<string, string>} */
  const at = new Map();
  steps.forEach((r, i) => {
    const n = `s${i}`, seat = Q.seats.get(r.Actor);
    if (seat) { nodes.push({ node: n, id: seat.id, title: seat.name, type: "seat" }); }
    at.set(r.Step, n);
    lines.push(`  ${n}["fak:fa-${Q.markOf(r.Actor)} <b>${label(r.Actor)}</b><br/><small>${label(r.Step)}</small> ${label(r.Action)}"]`);
    const prev = i === 0 ? (trigger.trim() ? "t0" : null) : `s${i - 1}`;
    if (prev) { lines.push(`  ${prev} --> ${n}`); links.push({ from: prev, to: n, label: r.Step }); }
  });
  let omitted = 0;
  Q.rows(uc, "Extensions").forEach((x, i) => {
    const from = at.get(x.Step.replace(/[a-z]+$/, ""));
    if (!from) { omitted++; return; }
    lines.push(`  x${i}["<small>${label(x.Step)}</small> ${label(x.Condition)}<br/><i>${label(x.Handling)}</i>"]:::ext`);
    lines.push(`  ${from} -.-> x${i}`); links.push({ from, to: `x${i}`, label: x.Step });
  });
  lines.push("  classDef ext stroke-dasharray:5 4");
  if (steps.length > DIAGRAM_CAP) throw cannot("scenario", "too_large", steps.length);
  return { title: uc.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted,
    steps: steps.map((r) => ({ step: r.Step, actor: r.Actor, action: r.Action })),
    extensions: Q.rows(uc, "Extensions").map((x) => ({ step: x.Step, condition: x.Condition, handling: x.Handling })) };
}
```

A section's prose is `sections[].text` (the example's trigger reads "The payer's bookkeeping asks for the invoice of a closed billing period."), and a table's cells are `sections[].tables[0].rows` under `columns`. The `namer()` call is dropped: a step is a box named `s0` and on, not an `n` node, because two steps may name one seat and a node is an entity once; a step whose actor is a seat is pushed into `nodes` by hand with the step's box name, so the widget links it. The widget's `nodeElement` therefore takes `[ns]\d+` in Task 3.

```js
const REQ_TAKES = ["feature", "product", "use-case", "requirement"];
/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function requirementsDiagram(s, id) {
  const Q = requirementsOf(s);
  const e = requireId(s, id);
  if (!REQ_TAKES.includes(e.type)) throw notA("id", e, "feature, product, use-case or requirement");
  const D = requirementsDrawing(e, "flowchart LR");
  /** @param {Entity} x @param {string} type */
  const thing = (x, type) => type === "use-case" ? `{n}(["${x.id === e.id ? "<b>" : ""}${label(x.name)}${x.id === e.id ? "</b>" : ""}<br/><small>«use-case»</small>"])` : `{n}["${x.id === e.id ? "<b>" : ""}${label(x.name)}${x.id === e.id ? "</b>" : ""}<br/><small>«${type}»</small>"]`;
  /** @param {Entity} r @param {string} from */
  const follows = (r, from) => { for (const ru of names(r.fields?.follows)) { const rule = Q.rules.get(ru); if (!rule) continue; const n = D.declare(rule, `{n}["${label(rule.name)}<br/><small>«rule»</small>"]`); D.lines.push(`  ${from} -.->|"follows"| ${n}`); D.links.push({ from, to: n, label: "follows" }); } };
  if (e.type === "requirement") {
    const me = D.declare(e, `{n}{{"${Q.hexagon(e, true)}"}}`);
    const seen = new Set();
    for (const row of Q.rows(e, "Applies to")) {
      const target = Q.byType[/** @type {keyof typeof Q.byType} */ (row.Type)]?.get(row.Entity); if (!target || seen.has(target.id)) continue;
      seen.add(target.id);
      const n = D.declare(target, thing(target, row.Type));
      D.lines.push(`  ${me} -->|"Applies to"| ${n}`); D.links.push({ from: me, to: n, label: "Applies to" });
    }
    follows(e, me);
    return D.finish("requirements");
  }
  const mine = Q.appliedTo(e.type, e);
  if (!mine.length) throw cannot("requirements", "empty", 0);
  const me = D.declare(e, thing(e, e.type));
  for (const kind of KINDS) {
    const of_kind = mine.filter((r) => text(r.fields?.kind) === kind);
    if (!of_kind.length) continue;
    D.lines.push(`  subgraph ${kind} ["${kind}"]`);
    for (const r of of_kind) D.declare(r, `  {n}{{"${Q.hexagon(r, false)}"}}`, Q.modality(r));
    D.lines.push("  end");
    for (const r of of_kind) { D.lines.push(`  ${D.of(r)} --> ${me}`); D.links.push({ from: D.of(r), to: me, label: "Applies to" }); }
  }
  for (const r of mine) follows(r, D.of(r));
  return D.finish("requirements");
}
```

`requirementsOf` requires `requirement` first, so a model without the pack refuses naming it, as the tests expect. `TAKES.id` gains the three; the dispatch gains the three branches, `usecaseDiagram(s, id)`, `scenarioDiagram(s, id)` and `requirementsDiagram(s, id)`, in the form of the system's. The head comment's list gains ", a use case in its scope, its scenario, and what a feature, a product, a use case or a requirement is held to". `test/consumer-types.test.mjs`'s union gains the three.

- [ ] **Step 4: Run the shape's tests, then the suite**

`npm run build && node --test test/diagram.test.mjs` PASS; `npm test && npm run build:check`; `sh conventions/conventions-check && sh conventions/conventions-format check`.

- [ ] **Step 5: Commit**

```text
A use case is drawn in its scope, as its scenario and by what it is held to
```

with a body in the register, `Verified:` and the trailers.

---

### Task 2: The shapes in the interface

**Files:** `lib/tools.mjs` (description within sixty words, naming the three and the id each takes), `README.md:23`, `scripts/interface.mjs` (three examples over the example: `usecase` and `scenario` of `use-cases/download-an-invoice`, `requirements` of `requirements/a-copy-is-the-invoice-as-issued`), `docs/INTERFACE.md` (three headings before `## Paging`, the `diagram` paragraph's shape sentence, the refusal sentences, and a paragraph on the three in the form of the system's), `test/contract.test.mjs` (the three answers in the schema over the example, `empty` for the feature, `unknown_type` on the reference instance), `test/interface.test.mjs` (the refusal sentences hold), `deploy/test/tools.mjs` (every use case draws its three pictures or says it has nothing to draw; every node of the six types).

Steps as Task 2 of the system's plan: tests, run, write, `npm run interface`, suite, checks, commit, push, `gh pr create`, stop.

---

### Task 3: The actor's mark, the captions and the reading lines, English

**Repository:** robertblust/design, worktree cut from `main`.

**Files:** `lib/marks.mjs` (the `actor` mark after `agent`: `'<circle cx="8" cy="4.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.2 15.2a5.8 5.8 0 0 1 11.6 0" fill="none" stroke="currentColor" stroke-width="1.4"/>'`), `assets/chat.js` (`MARKS` copy; `withMarks` classes `actor` as it classes `human`, not as an element; `nodeElement`'s regex takes `-(?:classId|flowchart)-[ns]\d+-\d+$` and the function's own test for `^[ns]\d+$`; strings `usecase: "Use case", scenario: "Scenario", requirements: "Requirements"` and the three reading lines of the spec's §3, German placeholders `"PROVISIONAL: waits for the translator"`), `assets/chat.css` (`.rbchat-mark.actor{color:var(--c-firm,var(--ink))!important}` and `.rbchat-diagram-box svg .node.ext rect{fill:none!important}`), tests: `test/chat.test.mjs` (key list, nine marks, captions and reading lines, the placeholder test), `test/chat-diagram.test.mjs` with fixtures `usecase`, `scenario`, `requirements` taken byte for byte from Task 1's answers over the example (`node -e` in the mcp-server worktree, as the system's fixtures were taken), and a `req-actor` fixture from the human-seat case: a use case picture draws the actor's mark outlined, a hexagon and a rounded box linked by `nodeElement`, a `must` heavier than a `should`; a scenario's `s` boxes linked to the seat where the fixture names one and its extension box unfilled.

Steps as Task 3 of the system's plan; the commit leaves the placeholder test red.

---

### Task 4: The German

Translator, editor, back-reader, as before, on the three captions and three reading lines; the Translator's commit; push; `gh pr create` listing the flags.

---

### Task 5: The chat asks for the shapes and words their lines

**Repository:** companygraph/chat-server, worktree cut from `main`.

**Files:** `lib/prompt.mjs` (`DIAGRAM_RULE`: the shape list gains `usecase, scenario or requirements`; the clauses of the spec's §4, after the system's clause), `lib/loop.mjs` (a `REQ` map beside `SYSTEM`: `includes` → `${a} includes ${b}`, `features` → `${a} asks something of ${b}`, `Applies to` → `${a} applies to ${b}` where the from is the requirement, read from `nodeOf` types, `follows` → `${a} follows the rule ${b}`; a scenario's link, whose label is a step, → `step ${label} follows` with from and to named by their boxes' text where they are no entity, which the note gets from `steps` and `extensions`: say `${label}: ${action}` for a step and `${label}: ${condition}; ${handling}` for an extension, and a `requirements` note sentence as the `system` one), tests in `test/prompt.test.mjs` and `test/loop.test.mjs`.

Steps as Task 5 of the system's plan; the pin and the measurement wait for the release.

---

### Task 6: The plan rides with the spec

Commit this plan as the Planner before Task 1.

### Task 7: Order and hand-off

1. Task 6, Tasks 1 and 2 in mcp-server; its pull request.
2. Tasks 3 and 4 in design; its pull request, with the flags.
3. Task 5 in chat-server; its pull request.
4. The hand-off names the three pull requests, the measurement left for the release, the German flags, and that the talk on the pack resumes once the shapes are live.
