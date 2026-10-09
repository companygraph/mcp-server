# An organization is drawn as its people — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `diagram` draws an org chart, shape `organization`, the chat widget marks its people as humans or agents and asks for it, and CompanyGraph's own model holds the one group that is true of it.

**Architecture:** The shape is one function in `mcp-server`'s `lib/diagram.mjs` that reads a snapshot's groups, group kinds, profiles and jobs and writes a `flowchart TB` with no word of its own. `robertblust/design`'s `chat.js` registers the processes page's two marks as a Mermaid icon pack named `fak`, so the host's `fak:fa-human` and `fak:fa-agent` tokens become marks, and captions the shape. `chat-server` tells the model when to ask for it. `companygraph/mental-model` takes the organization pack and writes a team. Five repositories, one pull request each, in the order of Task 8.

**Tech Stack:** Node 22+, `node:test`, Zod, the MCP SDK, Mermaid 12.0.0 as `robertblust/design` vendors it, Playwright Chromium in design's suite, the `companygraph` CLI at meta-model v0.88.0.

**Spec:** `docs/superpowers/specs/2026-10-09-an-organization-is-drawn-design.md` in `companygraph/mcp-server`, committed as `837efc1` on the branch `an-organization-is-drawn`.

## Global Constraints

- The shape's source holds no word in any language: names, job titles and group names from the model, Mermaid syntax, and the tokens `fak:fa-human` and `fak:fa-agent`. An opening's count is `× n`, nothing else.
- Frames stand side by side, never nested, ordered by `rank` then name, a group without a usable rank after the ranked ones.
- A box is a node of its own: `n0`, `n1` and on; a frame is `g0`, `g1` and on, and its agents' frame `g0a`. Classes: `lead`, `open`, `agents`.
- At most 50 boxes (`DIAGRAM_CAP`), frames not counted; past it `cannot_draw` / `too_large`, and without `id` the message adds "name a group to draw part of it".
- `label()` escapes only the colon Mermaid reads as an icon, in `fa:fa-`, `fab:fa-`, `fak:fa-`, `far:fa-` and `fas:fa-`, so every other shape's source is unchanged. This narrows the spec's §2 "Escaping", which said every colon: escaping every colon changes the source of the gate and neighborhood labels the shapes write themselves, "Reviewer: reshaped", "+60: Relations.Concept", and five existing tests, for no picture that differs.
- The marks are `lib/marks.mjs`'s in design, and `chat.js` carries the same two bodies, held equal by a test. The three sites' Processes pages keep their own hand-written copies of the symbols, outside any fence design writes; moving them into the fence is a change that asks each site to delete its copy, a major, and is left out. This narrows the spec's §3 "defined once in the design system and read by both the processes renderer and the widget".
- German is made only after the owner has reviewed the English, by the translator of `TRANSLATOR.md`, read by the editor and the back-reader, and settled by the owner (`conventions/WRITING.md`).
- Every commit is an agent's: authored by its seat at `companygraph.io` for the companygraph repositories and at `blust.ch` for `robertblust/design` — `git commit --author "Implementer <implementer@companygraph.io>"` — with the trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The English of `mental-model`'s pages is the Writer's commit, the German string the Translator's, with `Track: Prose`.
- Nothing is merged, tagged, released or re-pinned without the owner's word.

## Review Focus

1. A model whose only groups are teams draws a person who sits in two of them twice, one box in each, and must not collapse them into one node that Mermaid would move into the last frame. Pinned in Task 1.
2. A `part-of` loop the checks refuse, served anyway because a deployment serves what its commit holds, must not hang the tool when an id walks up it. Pinned in Task 1.
3. A `rank` that is no number, `first`, must order the group after the ranked ones and not as `NaN` anywhere. Pinned in Task 1.
4. A widget released before the host sends the tokens, or a client without the pack, must show the name and no stray text: Mermaid writes an empty `<i>` for an unknown icon. The design suite draws only with the pack; the measurement in Task 4 Step 9 reads an answer on the old widget.
5. A label that holds only a mark and a name, an agent with no job, must keep the mark outside the underlined name, since `wrapNodeName` otherwise wraps the whole label. Pinned in Task 4 by the AI Agent's box.

---

## Repositories and worktrees

Each task names the worktree it works in. Three exist already on the branch `an-organization-is-drawn`, cut from `main` at the commits the spec names; the others are made the same way.

| Repository | Worktree |
| --- | --- |
| companygraph/mcp-server | `~/git/companygraph/mcp-server-an-organization-is-drawn` |
| robertblust/design | `~/git/robertblust/design-an-organization-is-drawn` |
| companygraph/chat-server | `~/git/companygraph/chat-server-an-organization-is-drawn` |
| companygraph/mental-model | `~/git/companygraph/mental-model-an-organization-is-drawn` |
| companygraph/meta-model | `~/git/companygraph/meta-model-organization-chart` (Task 7 makes it) |

Each worktree runs `npm ci` once before its first test, and `npm run fixtures` in mcp-server, which `pretest` also runs.

---

### Task 1: The `organization` shape

**Repository:** companygraph/mcp-server, its worktree.

**Files:**

- Modify: `lib/diagram.mjs` — the import of `lastDayOf`, `label()`'s icon escape, `NARROW.organization`, the function `organization()` before the argument table, `TAKES.id`, `NARROWS_BY_ID`, the `DiagramRequest` typedef, the dispatch in `diagram()`
- Modify: `lib/schemas.mjs:13` — `SHAPES` gains `"organization"`
- Modify: `types/lib/diagram.d.mts`, `types/lib/schemas.d.mts` — written by `npm run build`, never by hand
- Test: `test/diagram.test.mjs` — the list of shapes in the arguments test, and eight tests at the end

**Interfaces:**

- Consumes: `lastDayOf(date: string): string` from `companygraph-meta-model/checks` (v0.88.0), `requireId`, `requireType` from `lib/model.mjs`; `text`, `byName`, `label`, `notA`, `cannot`, `DIAGRAM_CAP` inside `lib/diagram.mjs`.
- Produces: `diagram(s, { shape: "organization", id?: string })` returning the `diagram` answer: `title` the group's name or `null`, `nodes` with `g`-named frames (`type: "group"`) and `n`-named boxes (`type: "profile"` or `"job"`), `links` with `label: ""`, `edges` the number of `links`, `omitted` the groups outside the line left out. Task 2 and the widget read these names.

- [ ] **Step 1: Write the failing tests**

Apply this patch to `test/diagram.test.mjs` with `git apply`: the shape list in the arguments test, then the organization's tests over the example's Beacon Systems and fixtures edited from it.

```diff
diff --git a/test/diagram.test.mjs b/test/diagram.test.mjs
index d8335b8..448cc32 100644
--- a/test/diagram.test.mjs
+++ b/test/diagram.test.mjs
@@ -246,7 +246,7 @@ test("every link's ends are drawn nodes, and the link count matches the arrow li
 });
 
 test("the arguments each shape does not take, needs or cannot use are refused by name", () => {
-  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood, schema, context, aggregate, flow, lifecycle" });
+  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood, schema, context, aggregate, flow, lifecycle, organization" });
   refused(() => diagram(s, { shape: "schema", id: "core/phase" }), "invalid_argument", { argument: "id", reason: "not taken by schema" });
   refused(() => diagram(s, { shape: "concepts", type: "phase" }), "invalid_argument", { argument: "type", reason: "not taken by concepts" });
   refused(() => diagram(s, { shape: "schema", domain: I("domains/pricing") }), "invalid_argument", { argument: "domain", reason: "not taken by schema" });
@@ -620,3 +620,165 @@ test("a When, a command and a state holding a quote, a colon and a semicolon are
   assert.ok(life.includes(`state "a #quot;q#quot;: b; c" as s0`) && life.includes(`s0 --> s0 : ${esc}`), life);
   assert.ok(!/[^#]"q"|: b;/.test(flow), flow);
 });
+
+// The organization: the example's Beacon Systems holds four units in the line, a team outside it,
+// a staff person, a staff unit with only an opening, an opening for two and an open Lead beside a
+// lead who stays. Fixtures edit the example's groups in place: the shape reads entities alone.
+const today = new Date().toISOString().slice(0, 10);
+const G = (name) => s.entities.find((e) => e.type === "group" && e.name === name).id;
+// The example with its groups changed: `edit` takes each group by name and may change it in place,
+// and `add` brings new entities, a group or a profile, in the shape the parser gives one.
+const org = (edit = {}, add = []) => {
+  const m = structuredClone(s);
+  for (const e of m.entities) if (e.type === "group" && edit[e.name]) edit[e.name](e);
+  m.entities.push(...add);
+  return m;
+};
+// A section table as the parser gives one, under both names a section carries it by.
+const table = (heading, columns, rows) => { const t = { columns, rows }; return { heading, tables: [t], table: t }; };
+const group = (id, name, fields, sections = []) => ({ id, type: "group", name, fields: { id, source: "Local", ...fields }, sections });
+const setRows = (e, heading, rows) => { const sec = e.sections.find((x) => x.heading === heading); sec.tables[0].rows = rows; sec.table = sec.tables[0]; };
+const BEACON = [
+  "flowchart TB",
+  '  subgraph g0 ["Management"]',
+  '    n0["fak:fa-human <b>Ines Marchetti</b><br/><small>Managing Director</small>"]:::lead',
+  '    n1["fak:fa-human <b>Jonas Whitcombe</b><br/><small>Executive Assistant</small>"]',
+  "    n0 -.- n1",
+  "  end",
+  '  subgraph g1 ["Legal"]',
+  '    n2["<b>Legal Counsel</b>"]:::open',
+  "  end",
+  '  subgraph g2 ["Engineering"]',
+  '    n3["fak:fa-human <b>Mira Halvorsen</b><br/><small>Engineering Lead</small>"]:::lead',
+  '    n4["<b>Backend Engineer</b><br/><small>× 2</small>"]:::open',
+  "    n3 ~~~ n4",
+  "  end",
+  '  subgraph g3 ["Product"]',
+  '    n5["fak:fa-human <b>Tomas Reyes</b><br/><small>Head of Product</small>"]:::lead',
+  '    n6["<b>Head of Product</b>"]:::open',
+  "  end",
+  "  n0 -.- n2",
+  "  n0 --> n3",
+  "  n0 --> n5",
+  "  classDef lead stroke-width:2px",
+  "  classDef open stroke-dasharray:5 4",
+];
+
+test("the company is its units in the line, in rank order, a box per person and per opening, the leads joined", () => {
+  const d = diagram(s, { shape: "organization" });
+  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["organization", null, 4, 1, COMMIT]);
+  assert.deepEqual(lines(d), BEACON);
+  assert.deepEqual(d.nodes.map((n) => [n.node, n.title, n.type]), [
+    ["g0", "Management", "group"], ["n0", "Ines Marchetti", "profile"], ["n1", "Jonas Whitcombe", "profile"],
+    ["g1", "Legal", "group"], ["n2", "Legal Counsel", "job"],
+    ["g2", "Engineering", "group"], ["n3", "Mira Halvorsen", "profile"], ["n4", "Backend Engineer", "job"],
+    ["g3", "Product", "group"], ["n5", "Tomas Reyes", "profile"], ["n6", "Head of Product", "job"],
+  ]);
+  assert.deepEqual(d.nodes[0], { node: "g0", id: G("Management"), title: "Management", type: "group" });
+  assert.deepEqual(d.links, [["n0", "n1"], ["n0", "n2"], ["n0", "n3"], ["n0", "n5"]].map(([from, to]) => ({ from, to, label: "" })));
+});
+
+test("a team named by its id draws its people, its agents in a frame of their own below them", () => {
+  const d = diagram(s, { shape: "organization", id: G("Billing Run Team") });
+  assert.deepEqual([d.title, d.edges, d.omitted, d.links], ["Billing Run Team", 0, 0, []]);
+  assert.deepEqual(lines(d), [
+    "flowchart TB",
+    '  subgraph g0 ["Billing Run Team"]',
+    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Backend Engineer</small>"]:::lead',
+    '    subgraph g0a [" "]',
+    '      n1["fak:fa-agent <b>AI Agent</b>"]',
+    "    end",
+    "    n0 ~~~ g0a",
+    "  end",
+    "  class g0a agents",
+    "  classDef lead stroke-width:2px",
+    "  classDef agents stroke-dasharray:2 3",
+  ]);
+});
+
+test("a unit named by its id draws every unit under it, however deep, and not the one above", () => {
+  const PLATFORM = "01a0ffff-0000-7000-8000-0000000000d1";
+  const m = org({}, [group(PLATFORM, "Platform", { kind: "Department", rank: "25", "part-of": "Engineering" },
+    [table("Openings", ["Job", "Place", "Count", "Since"], [["Backend Engineer", "Lead", "", ""]])])]);
+  const d = diagram(m, { shape: "organization", id: G("Engineering") });
+  assert.deepEqual([d.title, d.edges, d.omitted], ["Engineering", 1, 0]);
+  assert.deepEqual(lines(d), [
+    "flowchart TB",
+    '  subgraph g0 ["Engineering"]',
+    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Engineering Lead</small>"]:::lead',
+    '    n1["<b>Backend Engineer</b><br/><small>× 2</small>"]:::open',
+    "    n0 ~~~ n1",
+    "  end",
+    '  subgraph g1 ["Platform"]',
+    '    n2["<b>Backend Engineer</b>"]:::open',
+    "  end",
+    "  n0 --> n2",
+    "  classDef lead stroke-width:2px",
+    "  classDef open stroke-dasharray:5 4",
+  ]);
+  // One job open in two units is two boxes, each naming the job.
+  assert.deepEqual([d.nodes[2].id, d.nodes[4].id], [d.nodes[2].id, d.nodes[2].id]);
+  // The whole company draws Platform too, under Engineering's lead, after it in rank order.
+  assert.ok(lines(diagram(m, { shape: "organization" })).includes("  n3 --> n5"));
+});
+
+test("people stand Lead, Deputy, Member, Staff; agents side by side; a unit with no lead is reached at its frame", () => {
+  const AGENT = "01a0ffff-0000-7000-8000-0000000000d2", OPS = "01a0ffff-0000-7000-8000-0000000000d3";
+  const agent = { id: AGENT, type: "profile", name: "Review Agent", fields: { id: AGENT, source: "Local", nature: "agent" }, sections: [] };
+  const m = org({
+    "Billing Run Team": (e) => setRows(e, "People", [["AI Agent", "", "Member"], ["Jonas Whitcombe", "", "Member"], ["Review Agent", "", "Member"], ["Tomas Reyes", "Head of Product", "Deputy"], ["Mira Halvorsen", "Backend Engineer", "Lead"]]),
+  }, [agent, group(OPS, "Operations", { kind: "Department", rank: "40", "part-of": "Management" })]);
+  const team = lines(diagram(m, { shape: "organization", id: G("Billing Run Team") }));
+  assert.deepEqual(team.slice(1, 13), [
+    '  subgraph g0 ["Billing Run Team"]',
+    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Backend Engineer</small>"]:::lead',
+    '    n1["fak:fa-human <b>Tomas Reyes</b><br/><small>Head of Product</small>"]',
+    '    n2["fak:fa-human <b>Jonas Whitcombe</b>"]',
+    '    subgraph g0a [" "]',
+    "      direction LR",
+    '      n3["fak:fa-agent <b>AI Agent</b>"]',
+    '      n4["fak:fa-agent <b>Review Agent</b>"]',
+    "    end",
+    "    n0 ~~~ n1",
+    "    n0 ~~~ n2",
+    "    n2 ~~~ g0a",
+  ]);
+  // Operations has no one in it and nothing open: it draws no box, and the arrow ends at its frame.
+  assert.ok(lines(diagram(m, { shape: "organization" })).includes("  n0 --> g4"));
+});
+
+test("a model whose only groups are teams draws them for the company, and a group that has ended is left out", () => {
+  const teams = org({ Management: (e) => { e.fields.kind = "Team"; }, Legal: (e) => { e.fields.kind = "Team"; }, Engineering: (e) => { e.fields.kind = "Team"; }, Product: (e) => { e.fields.kind = "Team"; } });
+  const d = diagram(teams, { shape: "organization" });
+  assert.deepEqual([d.omitted, d.nodes.filter((n) => n.type === "group").map((n) => n.title)], [0, ["Management", "Legal", "Engineering", "Product", "Billing Run Team"]]);
+  // A person in two teams is a box in each, since every box is a node of its own.
+  assert.equal(d.nodes.filter((n) => n.title === "Mira Halvorsen").length, 2);
+  const ended = org({ Product: (e) => { e.fields.end = "2020-01"; }, Legal: (e) => { e.fields.end = today; } });
+  const titles = diagram(ended, { shape: "organization" }).nodes.filter((n) => n.type === "group").map((n) => n.title);
+  assert.deepEqual(titles, ["Management", "Legal", "Engineering"]);
+  refused(() => diagram(ended, { shape: "organization", id: G("Product") }), "cannot_draw", { shape: "organization", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
+});
+
+test("the organization refuses what it cannot draw, and a title is never read as a mark", () => {
+  const crowd = org({ Engineering: (e) => setRows(e, "Openings", Array.from({ length: DIAGRAM_CAP }, () => ["Backend Engineer", "Member", "", ""])) });
+  refused(() => diagram(crowd, { shape: "organization" }), "cannot_draw", { shape: "organization", reason: "too_large", nodes: DIAGRAM_CAP + 6, limit: DIAGRAM_CAP });
+  let whole;
+  try { diagram(crowd, { shape: "organization" }); } catch (e) { whole = e; }
+  assert.match(whole.message, /name a group to draw part of it/);
+  refused(() => diagram(s, { shape: "organization", id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a group" });
+  refused(() => diagram(instanceSnapshot(), { shape: "organization" }), "unknown_type");
+  const odd = diagram(org({ Legal: (e) => { e.name = "Ops fas:fa-x"; } }), { shape: "organization" });
+  assert.ok(lines(odd).includes('  subgraph g1 ["Ops fas#58;fa-x"]'), odd.mermaid);
+  assert.equal(label("sofa:fa-bed and a: colon"), "sofa#58;fa-bed and a: colon");
+});
+
+test("a part-of loop the checks refuse, or a rank that is no number, still draws and never hangs", () => {
+  const m = org({ Management: (e) => { e.fields["part-of"] = "Product"; e.fields.rank = "first"; } });
+  const d = diagram(m, { shape: "organization", id: G("Engineering") });
+  assert.deepEqual(d.nodes.filter((n) => n.type === "group").map((n) => n.title), ["Engineering"]);
+  const whole = diagram(m, { shape: "organization" });
+  // Management has no rank it can be ordered by, so it comes after the ranked units.
+  assert.deepEqual(whole.nodes.filter((n) => n.type === "group").map((n) => n.title), ["Legal", "Engineering", "Product", "Management"]);
+  const top = diagram(m, { shape: "organization", id: G("Management") });
+  assert.deepEqual(top.nodes.filter((n) => n.type === "group").map((n) => n.title).sort(), ["Engineering", "Legal", "Management", "Product"]);
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/diagram.test.mjs` Expected: FAIL. The new tests refuse with `invalid_argument` on `shape`, "shape is one of concepts, process, neighborhood, schema, context, aggregate, flow, lifecycle", and the arguments test fails on the list it now expects.

- [ ] **Step 3: Write the shape**

Apply this patch to `lib/diagram.mjs` and `lib/schemas.mjs`.

```diff
diff --git a/lib/diagram.mjs b/lib/diagram.mjs
index 8c582d1..5840847 100644
--- a/lib/diagram.mjs
+++ b/lib/diagram.mjs
@@ -10,6 +10,7 @@
 // Mermaid; nothing here is worded in any one language, so a client captions the picture in its
 // reader's.
 import { typeOfAddress } from "companygraph-meta-model/instance";
+import { lastDayOf } from "companygraph-meta-model/checks";
 import { ModelError } from "./errors.mjs";
 import { SHAPES } from "./schemas.mjs";
 import { provenance, allEdges, requireId, requireType, relationsOf, schemaOf, schemaUrl, place } from "./model.mjs";
@@ -56,7 +57,7 @@ export const plain = (v) => String(v).replace(/\s*[\r\n]+\s*/g, " ");
 // arrow or turn the label into Markdown, which a flowchart node reads a backtick-quoted title as.
 /** @param {unknown} text */
 export const label = (text) => plain(String(text)
-  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;"));
+  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;").replace(/(fa[bklrs]?):(?=fa-)/g, "$1#58;"));
 
 /**
  * @param {string} a
@@ -90,7 +91,7 @@ const notA = (argument, e, type) => new ModelError("invalid_argument", `${argume
 // is only worth saying when none was named; a narrowed picture that is still too large has no
 // such fix.
 /** @type {Partial<Record<DiagramKind, string>>} */
-const NARROW = { concepts: "domain", schema: "type" };
+const NARROW = { concepts: "domain", schema: "type", organization: "group" };
 /**
  * @param {DiagramKind} shape
  * @param {"empty" | "too_large"} reason
@@ -642,15 +643,161 @@ function lifecycle(s, id) {
   return { title: e.name, mermaid: lines.join("\n"), nodes, links: [], transitions, edges: transitions.length, omitted: 0 };
 }
 
+// An org chart: one box per person and per open position, framed by the group they sit in. The
+// frames stand side by side in the company's order and the line between their leads carries the
+// hierarchy, since Mermaid lays out frames nested deep poorly. A person's name is bold, their job
+// the `<small>` line under it, and before the name a token Mermaid swaps for the mark a client
+// registers under `fak`, a person's or an agent's, as the processes page marks them; a client
+// without the pack shows the name alone. Nothing here is a word: what a dashed box or the shaded
+// frame means is the client's reading line.
+const PLACES = ["Lead", "Deputy", "Member", "Staff"];
+/** @param {string | undefined} place */
+const placeAt = (place) => { const i = PLACES.indexOf(String(place)); return i < 0 ? PLACES.length : i; };
+const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
+const todayUtc = () => new Date().toISOString().slice(0, 10);
+/**
+ * @param {Snapshot} s
+ * @param {string | undefined} id
+ * @param {string} [today]
+ * @returns {Drawing}
+ */
+function organization(s, id, today = todayUtc()) {
+  requireType(s, "group");
+  /** @param {string} type */
+  const named = (type) => new Map(s.entities.filter((e) => e.type === type).map((e) => [e.name, e]));
+  const kinds = named("group-kind"), profiles = named("profile"), jobs = named("job");
+  /** @param {Entity} g @param {string} field */
+  const kindSays = (g, field) => text(kinds.get(text(g.fields?.kind))?.fields?.[field]) === "yes";
+  /** @param {Entity} g */
+  const inLine = (g) => kindSays(g, "in-line");
+  // A group exists until the last day its `end` covers has passed, as R9 reads an end.
+  /** @param {Entity} g */
+  const exists = (g) => { const end = text(g.fields?.end).trim(); return !DATE.test(end) || lastDayOf(end) >= today; };
+  const groups = s.entities.filter((e) => e.type === "group");
+  const byGroupName = new Map(groups.map((g) => [g.name, g]));
+  const current = groups.filter(exists);
+  /** @param {Entity} g */
+  const rank = (g) => { const r = Number(text(g.fields?.rank)); return text(g.fields?.rank).trim() && Number.isFinite(r) ? r : Infinity; };
+  /** @param {Entity} a @param {Entity} b */
+  const order = (a, b) => (rank(a) === rank(b) ? byName(a, b) : rank(a) < rank(b) ? -1 : 1);
+  /** @param {Entity} g */
+  const parentOf = (g) => byGroupName.get(text(g.fields?.["part-of"]));
+  /** @type {Entity | null} */
+  let middle = null;
+  let set, omitted = 0;
+  if (id !== undefined) {
+    middle = requireId(s, id);
+    if (middle.type !== "group") throw notA("id", middle, "group");
+    const top = middle;
+    // Every unit whose `part-of` reaches the one named, however many steps up; a loop the checks
+    // refuse stops the walk instead of the tool.
+    /** @param {Entity} g */
+    const under = (g) => { const seen = new Set(); for (let p = parentOf(g); p && !seen.has(p.id); p = parentOf(p)) { if (p.id === top.id) return true; seen.add(p.id); } return false; };
+    set = !exists(middle) ? [] : inLine(middle) ? current.filter((g) => g.id === top.id || (inLine(g) && under(g))) : [middle];
+  } else {
+    const line = current.filter(inLine);
+    set = line.length ? line : current;
+    omitted = line.length ? current.length - line.length : 0;
+  }
+  set = [...set].sort(order);
+  // A table's rows by column, each cell its text, so a missing column reads as empty.
+  /** @param {Entity} g @param {string} heading @returns {Record<string, string>[]} */
+  const rows = (g, heading) => {
+    const t = g.sections.find((x) => x.heading === heading)?.tables?.[0];
+    return t ? t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, text(r[i]).trim()]))) : [];
+  };
+  /** @typedef {{ who: Entity; job: string; place: string }} Seated */
+  /** @typedef {{ job: Entity; place: string; count: number }} Open */
+  const frames = set.map((g) => {
+    /** @type {Seated[]} */
+    const people = rows(g, "People").flatMap((r) => { const who = profiles.get(r.Profile ?? ""); return who ? [{ who, job: r.Job ?? "", place: r.Place ?? "" }] : []; });
+    const human = people.filter((p) => text(p.who.fields?.nature) === "human")
+      .map((p, i) => ({ p, i })).sort((a, b) => placeAt(a.p.place) - placeAt(b.p.place) || a.i - b.i).map((x) => x.p);
+    const agents = people.filter((p) => text(p.who.fields?.nature) !== "human");
+    /** @type {Open[]} */
+    const openings = rows(g, "Openings").flatMap((r) => { const job = jobs.get(r.Job ?? ""); return job ? [{ job, place: r.Place ?? "", count: Number(r.Count) }] : []; });
+    return { g, human, agents, openings };
+  });
+  const boxes = frames.reduce((n, f) => n + f.human.length + f.agents.length + f.openings.length, 0);
+  if (boxes === 0) throw cannot("organization", "empty", 0);
+  if (boxes > DIAGRAM_CAP) throw cannot("organization", "too_large", boxes, middle);
+  // Every box is a node of its own, so one job open in two units is two boxes naming it; a frame
+  // is a node too, named `g` and its place, so a client can tell which group it draws.
+  const /** @type {DiagramNode[]} */ nodes = [];
+  let count = 0;
+  /** @param {Entity} e */
+  const box = (e) => { const n = `n${count++}`; nodes.push({ node: n, id: e.id, title: e.name, type: e.type }); return n; };
+  /** @param {Seated} p @param {"human" | "agent"} mark */
+  const person = (p, mark) => `fak:fa-${mark} <b>${label(p.who.name)}</b>${p.job ? `<br/><small>${label(p.job)}</small>` : ""}`;
+  const lines = ["flowchart TB"];
+  const /** @type {DiagramLink[]} */ links = [];
+  // Where an arrow between frames ends: the unit's lead, else its open Lead, else the frame.
+  const /** @type {Map<string, string>} */ head = new Map();
+  const /** @type {Set<string>} */ used = new Set();
+  frames.forEach(({ g, human, agents, openings }, i) => {
+    const frame = `g${i}`;
+    nodes.push({ node: frame, id: g.id, title: g.name, type: g.type });
+    lines.push(`  subgraph ${frame} ["${label(g.name)}"]`);
+    /** @type {string | null} */
+    let lead = null, last = null, openLead = null;
+    const /** @type {string[]} */ below = [], /** @type {string[]} */ beside = [];
+    for (const p of human) {
+      const n = box(p.who), leads = p.place === "Lead" && !lead;
+      if (leads) used.add("lead");
+      lines.push(`    ${n}["${person(p, "human")}"]${leads ? ":::lead" : ""}`);
+      if (leads) lead = n;
+      else (p.place === "Staff" ? beside : below).push(n);
+      last = n;
+    }
+    // An open Lead stands beside the lead who stays, the search for a successor; every other
+    // opening stands below the lead.
+    for (const o of openings) {
+      const n = box(o.job);
+      used.add("open");
+      lines.push(`    ${n}["<b>${label(o.job.name)}</b>${Number.isInteger(o.count) && o.count > 1 ? `<br/><small>× ${o.count}</small>` : ""}"]:::open`);
+      if (o.place !== "Lead") below.push(n);
+      else if (!openLead) openLead = n;
+      last = n;
+    }
+    if (agents.length) {
+      used.add("agents");
+      lines.push(`    subgraph ${frame}a [" "]`);
+      if (agents.length > 1) lines.push("      direction LR");
+      for (const p of agents) lines.push(`      ${box(p.who)}["${person(p, "agent")}"]`);
+      lines.push("    end");
+    }
+    if (lead) for (const n of below) lines.push(`    ${lead} ~~~ ${n}`);
+    if (lead) for (const n of beside) { lines.push(`    ${lead} -.- ${n}`); links.push({ from: lead, to: n, label: "" }); }
+    if (agents.length && last) lines.push(`    ${last} ~~~ ${frame}a`);
+    lines.push("  end");
+    head.set(g.id, lead ?? openLead ?? frame);
+  });
+  for (const { g } of frames) {
+    const p = parentOf(g);
+    if (!p || !head.has(p.id)) continue;
+    const from = /** @type {string} */ (head.get(p.id)), to = /** @type {string} */ (head.get(g.id));
+    lines.push(`  ${from} ${kindSays(g, "staff") ? "-.-" : "-->"} ${to}`);
+    links.push({ from, to, label: "" });
+  }
+  frames.forEach(({ agents }, i) => { if (agents.length) lines.push(`  class g${i}a agents`); });
+  if (used.has("lead")) lines.push("  classDef lead stroke-width:2px");
+  if (used.has("open")) lines.push("  classDef open stroke-dasharray:5 4");
+  if (used.has("agents")) lines.push("  classDef agents stroke-dasharray:2 3");
+  return { title: middle ? middle.name : null, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted };
+}
+
 // Which shape takes which argument: `id` names what a process, a neighborhood, a context map or an
 // aggregate is of, `domain` narrows the concepts and `type` the schemas.
 /** @type {Record<string, DiagramKind[]>} */
-const TAKES = { id: ["process", "neighborhood", "context", "aggregate", "flow", "lifecycle"], domain: ["concepts"], type: ["schema"] };
+const TAKES = { id: ["process", "neighborhood", "context", "aggregate", "flow", "lifecycle", "organization"], domain: ["concepts"], type: ["schema"] };
+// The shapes whose `id` only narrows, as `domain` narrows the concepts: without one they draw the whole.
+const NARROWS_BY_ID = ["organization"];
 
 // What a caller may ask for, by the same table: the shapes that take an id need one, and the two
 // that narrow by something else take that alone. The checks below hold an untyped caller to it.
 /**
- * @typedef {{ shape: Exclude<DiagramKind, "concepts" | "schema">; id: string }
+ * @typedef {{ shape: Exclude<DiagramKind, "concepts" | "schema" | "organization">; id: string }
+ *   | { shape: "organization"; id?: string | undefined }
  *   | { shape: "concepts"; domain?: string | undefined }
  *   | { shape: "schema"; type?: string | undefined }} DiagramRequest
  */
@@ -666,10 +813,11 @@ export function diagram(s, request) {
   for (const [argument, value] of Object.entries({ id, domain, type }))
     if (value !== undefined && !TAKES[argument].includes(/** @type {DiagramKind} */ (shape)))
       throw new ModelError("invalid_argument", `the ${shape} diagram takes no ${argument}${argument === "id" && NARROW[/** @type {DiagramKind} */ (shape)] ? `; name a ${NARROW[/** @type {DiagramKind} */ (shape)]} to draw part of it` : ""}`, { details: { argument, reason: `not taken by ${shape}` } });
-  if (TAKES.id.includes(/** @type {DiagramKind} */ (shape)) && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
+  if (TAKES.id.includes(/** @type {DiagramKind} */ (shape)) && !NARROWS_BY_ID.includes(/** @type {DiagramKind} */ (shape)) && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
   if (shape === "process") requireType(s, "phase");
   const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? processDiagram(s, /** @type {string} */ (id)) : shape === "neighborhood" ? neighborhood(s, /** @type {string} */ (id))
     : shape === "context" ? contextMap(s, /** @type {string} */ (id)) : shape === "aggregate" ? aggregates(s, /** @type {string} */ (id))
-    : shape === "flow" ? flow(s, /** @type {string} */ (id)) : shape === "lifecycle" ? lifecycle(s, /** @type {string} */ (id)) : schemas(s, type);
+    : shape === "flow" ? flow(s, /** @type {string} */ (id)) : shape === "lifecycle" ? lifecycle(s, /** @type {string} */ (id))
+    : shape === "organization" ? organization(s, id) : schemas(s, type);
   return { shape: /** @type {DiagramKind} */ (shape), ...drawn, model: provenance(s) };
 }
diff --git a/lib/schemas.mjs b/lib/schemas.mjs
index df2c25f..5f6ce4a 100644
--- a/lib/schemas.mjs
+++ b/lib/schemas.mjs
@@ -10,7 +10,7 @@ import { CODES } from "./errors.mjs";
 const count = z.number().int().nonnegative();
 
 // The diagrams the `diagram` tool draws, named once for its input, its answer and its refusal.
-export const SHAPES = /** @type {const} */ (["concepts", "process", "neighborhood", "schema", "context", "aggregate", "flow", "lifecycle"]);
+export const SHAPES = /** @type {const} */ (["concepts", "process", "neighborhood", "schema", "context", "aggregate", "flow", "lifecycle", "organization"]);
 
 export const Model = z.strictObject({ commit: z.string().nullable(), repo: z.string().nullable(), core: z.string(), parser: z.string() });
 export const EntityRef = z.strictObject({ id: z.string(), type: z.string(), name: z.string() });
```

- [ ] **Step 4: Run the shape's tests, then the suite**

Run: `node --test test/diagram.test.mjs` Expected: PASS, 57 tests.

Run: `npm run build && npm test` Expected: every test passes but one, "a strict TypeScript consumer of the packed package types every subpath and refuses a wrong call", whose consumer does not yet list `organization` as a shape; Task 2 makes it pass. Read the output; a failure elsewhere is a fault of this task.

Run: `npm run build:check` Expected: `✓ types/ is what the JSDoc in lib/, bin/ and deploy/ declares`.

- [ ] **Step 5: Commit**

```bash
git add lib/diagram.mjs lib/schemas.mjs types/lib/diagram.d.mts types/lib/schemas.d.mts test/diagram.test.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The diagram tool draws an organization

The organization pack holds who sits in which unit, in which job and place, what is open and who serves a head from beside them, and no shape read it. The shape organization draws a box per person and per opening, framed by group, the frames side by side in rank order, solid arrows between the leads, dashed lines to staff, and agents in a frame of their own; a token before each name lets a client mark the person as a human or an agent.

label() now escapes the colon Mermaid reads as an icon, so a title holding fas:fa-x is never drawn as a mark; every other colon is left as it was, and no other shape's source changes.

Verified: node --test test/diagram.test.mjs passes 57 tests; npm run build:check passes.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 2: The shape in the interface

**Repository:** companygraph/mcp-server, its worktree.

**Files:**

- Modify: `lib/tools.mjs:171-173` — the description names the shape, within sixty words; `id`'s description names the group
- Modify: `README.md:23` — the row for `diagram`
- Modify: `scripts/interface.mjs:44` — an example, the organization of Billing Run Team
- Modify: `docs/INTERFACE.md` — a heading for the example, then regenerated by `npm run interface`
- Test: `test/contract.test.mjs`, `test/consumer-types.test.mjs:34`, `deploy/test/tools.mjs`

**Interfaces:**

- Consumes: the answer of Task 1.
- Produces: the published interface a client reads: `docs/INTERFACE.md`'s section "`diagram` of the organization".

- [ ] **Step 1: Write the failing tests**

Apply this patch: a contract test over the example and over the reference instance, which holds no group; the consumer's shape type; a deployment check that every node of a deployment's own organization is a profile, a job or a group.

```diff
diff --git a/deploy/test/tools.mjs b/deploy/test/tools.mjs
index 72c6a41..a112655 100644
--- a/deploy/test/tools.mjs
+++ b/deploy/test/tools.mjs
@@ -144,6 +144,20 @@ export function registerToolsTests() {
     await client.close();
   });
 
+  // An org chart reaches a deployment with a re-pin, so each draws its own company. An instance
+  // without the organization pack is told so, and skips rather than fails.
+  test("the organization draws people, openings and groups only", async (t) => {
+    if (!s.entities.some((e) => e.type === "group")) return t.skip("this instance holds no group");
+    const [a, b] = InMemoryTransport.createLinkedPair();
+    await createServer(s).connect(a);
+    const client = new Client({ name: "test", version: "0" });
+    await client.connect(b);
+    const d = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "organization" } }));
+    if (d.error) assert.deepEqual([d.error.code, d.error.details.reason], ["cannot_draw", "empty"]);
+    else assert.ok(d.nodes.every((/** @type {{ type: string }} */ n) => ["profile", "job", "group"].includes(n.type)), d.mermaid);
+    await client.close();
+  });
+
   // A flow and a lifecycle read tables an instance may not yet write, so a context whose aggregates
   // hold none is refused as empty and every other answers in its shape.
   test("every bounded context answers its flow and its lifecycle, or says it has nothing to draw", async (t) => {
diff --git a/test/consumer-types.test.mjs b/test/consumer-types.test.mjs
index 077371d..5d572b2 100644
--- a/test/consumer-types.test.mjs
+++ b/test/consumer-types.test.mjs
@@ -31,7 +31,7 @@ schema.name;
 const name: string | undefined = schema?.name;
 
 const drawn = diagram(s, { shape: "schema", type: "x" });
-const shape: "schema" | "process" | "concepts" | "neighborhood" | "context" | "aggregate" | "flow" | "lifecycle" = drawn.shape;
+const shape: "schema" | "process" | "concepts" | "neighborhood" | "context" | "aggregate" | "flow" | "lifecycle" | "organization" = drawn.shape;
 const everyType: { via: string; to: string; multiplicity: string }[] | undefined = drawn.everyType;
 // @ts-expect-error everyType is a list, and nothing wider
 const notEveryType: number = drawn.everyType;
diff --git a/test/contract.test.mjs b/test/contract.test.mjs
index 0287fe9..f187531 100644
--- a/test/contract.test.mjs
+++ b/test/contract.test.mjs
@@ -223,6 +223,20 @@ test("a context map, its aggregates, flow and lifecycle answer in the schema ove
   await client.close();
 });
 
+test("an organization answers in the schema over the example, and is refused where no group is written", async () => {
+  const s = exampleSnapshot();
+  const client = await connect(s);
+  const whole = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "organization" } }));
+  assert.deepEqual([whole.shape, whole.title, whole.nodes.length, whole.links.length, whole.omitted], ["organization", null, 11, 4, 1]);
+  const team = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "organization", id: idAt(s, "groups/billing-run-team") } }));
+  assert.deepEqual([team.title, team.nodes.map((/** @type {{ type: string }} */ n) => n.type)], ["Billing Run Team", ["group", "profile", "profile"]]);
+  await client.close();
+  const without = await connect(instanceSnapshot());
+  const { error } = checkAnswer("diagram", await without.callTool({ name: "diagram", arguments: { shape: "organization" } }));
+  assert.deepEqual([error.code, error.details.type], ["unknown_type", "group"]);
+  await without.close();
+});
+
 test("a snapshot that predates what a tool reads is refused by code", async () => {
   const { checks, ...old } = exampleSnapshot();
   const client = await connect(old);
```

- [ ] **Step 2: Run them**

Run: `node --test test/contract.test.mjs test/consumer-types.test.mjs` Expected: PASS. Task 1 already answers in the schema; these tests pin it. `deploy/test/tools.mjs` runs in every deployment's own suite and here through `test/deploy-tools.test.mjs`, which `npm test` runs in Step 4.

- [ ] **Step 3: Write the description, the README row and the example**

Apply this patch.

```diff
diff --git a/README.md b/README.md
index be95328..a0e3826 100644
--- a/README.md
+++ b/README.md
@@ -20,7 +20,7 @@ It serves a snapshot parsed at build time with the meta-model's own parser, so a
 | `find_evidence` | everything the model says about one skill, paged |
 | `search` | entities by stem, by substring or by exact name |
 | `fetch` | one entity's page as written, by id |
-| `diagram` | part of the model as Mermaid: the concepts, a process, one entity's neighborhood, the schemas, a bounded context's map, its aggregates, their flow of commands and events, or their lifecycle |
+| `diagram` | part of the model as Mermaid: the concepts, a process, one entity's neighborhood, the schemas, a bounded context's map, its aggregates, their flow of commands and events, their lifecycle, or the organization: its people and open positions by group |
 
 [`docs/INTERFACE.md`](docs/INTERFACE.md) is the contract: every tool's arguments and answer with a real response, the codes of every refusal, how a list is paged, and what counts as a break. Every answer carries the model commit, the core version and the parser's tag. A name resolves within a type, and a name of an owned type within its owner, so two owners may each hold one name; a lookup that meets two refuses with every candidate's id, and an id reaches each.
 
diff --git a/lib/tools.mjs b/lib/tools.mjs
index 3446847..2c7fc8a 100644
--- a/lib/tools.mjs
+++ b/lib/tools.mjs
@@ -168,8 +168,8 @@ export const TOOLS = [
     output: OUTPUTS.fetch },
 
   { name: "diagram",
-    description: "A picture of the model as Mermaid, from its edges or its schemas. Use to show connections; for edges as data use list_references. Input: `shape`; `id`, `domain` or `type` narrow it; an aggregate, flow or lifecycle takes a context's id for all its aggregates. Returns `mermaid`, `nodes`, `links`, `title`, `edges`, `omitted`, schema's `everyType`, lifecycle's `transitions`. At most 50 nodes.",
-    input: z.object({ shape: z.enum(SHAPES), id: z.string().optional().describe("The process, the entity at a neighborhood's middle, the bounded context of a context map, or the aggregate or bounded context of an aggregate, flow or lifecycle picture"), domain: z.string().optional().describe("A domain's id or address, to draw its concepts"), type: z.string().optional().describe("A type, to draw its schema and the types it is declared with") }),
+    description: "A picture of the model as Mermaid, from its edges or its schemas. Use to show connections; for edges as data use list_references. Input: `shape`; `id`, `domain` or `type` narrow it; a context's id draws all its aggregates; organization without `id` draws the company. Returns `mermaid`, `nodes`, `links`, `title`, `edges`, `omitted`, schema's `everyType`, lifecycle's `transitions`. At most 50 nodes.",
+    input: z.object({ shape: z.enum(SHAPES), id: z.string().optional().describe("The process, the entity at a neighborhood's middle, the bounded context of a context map, or the aggregate or bounded context of an aggregate, flow or lifecycle picture, or the group an organization is narrowed to"), domain: z.string().optional().describe("A domain's id or address, to draw its concepts"), type: z.string().optional().describe("A type, to draw its schema and the types it is declared with") }),
     call: (s, args) => diagram(s, args),
     output: OUTPUTS.diagram },
 ];
diff --git a/scripts/interface.mjs b/scripts/interface.mjs
index 3ff11ab..843235b 100644
--- a/scripts/interface.mjs
+++ b/scripts/interface.mjs
@@ -41,6 +41,7 @@ export const EXAMPLES = {
   "`diagram` of its aggregates": { name: "diagram", contexts: true, arguments: { shape: "aggregate", id: CONTEXT_ID } },
   "`diagram` of its flow": { name: "diagram", contexts: true, arguments: { shape: "flow", id: CONTEXT_ID } },
   "`diagram` of its lifecycle": { name: "diagram", contexts: true, arguments: { shape: "lifecycle", id: CONTEXT_ID } },
+  "`diagram` of the organization": { name: "diagram", arguments: { shape: "organization", id: idAt(example, "groups/billing-run-team") } },
   "A refusal": { name: "get_entity", ambiguous: true },
 };
 
```

Then give `docs/INTERFACE.md` the heading the script fills: after the closing fence of the section "### `diagram` of its lifecycle", before "## Paging", insert

````markdown

### `diagram` of the organization

```json
{}
```
````

Run: `npm run interface` Expected: no output, and `docs/INTERFACE.md`'s new section holds the Billing Run Team answer, its `mermaid` opening `flowchart TB\n  subgraph g0 [\"Billing Run Team\"]`.

- [ ] **Step 4: Run the suite**

Run: `npm test` Expected: PASS, 351 tests, 0 failing. "every description is at most sixty words and says what comes back" passes with the description of Step 3.

Run: `npm run build:check && sh conventions/conventions-check && sh conventions/conventions-format` Expected: each passes.

- [ ] **Step 5: Commit**

```bash
git add lib/tools.mjs README.md scripts/interface.mjs docs/INTERFACE.md test/contract.test.mjs test/consumer-types.test.mjs deploy/test/tools.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The interface names the organization shape

The tool's description and the README name the shape, and INTERFACE.md carries an example, the Billing Run Team of the worked example. The contract holds the answer to its schema over the example and its refusal as unknown_type over a model without the pack, and a deployment's check holds that its own organization draws only people, jobs and groups.

Verified: npm test passes 351 tests; npm run build:check, conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Open the pull request and stop**

```bash
git push -u origin an-organization-is-drawn
gh pr create --title "The diagram tool draws an organization" --body-file - <<'EOF'
The spec, the shape and its interface. `diagram` gains `organization`: a box per person and per open position, framed by group, the frames side by side in rank order, solid arrows between the leads, dashed lines to staff, and agents in a frame of their own. A token before each name, `fak:fa-human` or `fak:fa-agent`, lets the widget mark the person; the source holds no word of its own.

`label()` now escapes the colon in Mermaid's icon syntax, and only that colon, so no other shape's source changes.

Verified: npm test passes 351 tests; build:check, conventions-check and conventions-format pass.

Sibling pull requests follow in robertblust/design, companygraph/chat-server and companygraph/mental-model.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Report the check and stop. The owner merges, and releases `mcp-server` as the next minor; its release notes say what changed for a client: a new value of `shape`, and frames in `nodes` named `g`.

### Task 3: The marks and the captions in the widget, English

**Repository:** robertblust/design, its worktree.

**Files:**

- Create: `lib/marks.mjs` — the two marks' bodies, the one definition
- Modify: `assets/chat.js` — `MARKS` and `withMarks()` before `loadMermaid()`, both of its paths through `withMarks`; `wrapNodeName` keeps a `.label-icon` outside the name; the strings `diagram.organization` and `diagram.reading.organization` in English and, as a placeholder the test refuses, German
- Modify: `assets/chat.css` — before `.rbchat-diagram-reading`, the mark sizes and colors, the open box, the agents' frame
- Test: `test/chat.test.mjs`, `test/chat-diagram.test.mjs`, `test/fixtures/diagrams.json` (two pictures from Task 1's answer), `test/spelling.test.mjs` (the German caption)

**Interfaces:**

- Consumes: the `diagram` event carrying Task 1's answer: `shape: "organization"`, `mermaid` with the tokens and the classes `lead`, `open`, `agents`.
- Produces: `MARKS` from `lib/marks.mjs`, `{ human: string, agent: string }`, each an SVG body on a 16-unit square in `currentColor`.

- [ ] **Step 1: Write the failing tests**

Apply this patch. The two pictures in `diagrams.json` are the answers Task 1 gives for Billing Run Team and for the whole example, byte for byte.

```diff
diff --git a/test/chat-diagram.test.mjs b/test/chat-diagram.test.mjs
index a167276..93611f5 100644
--- a/test/chat-diagram.test.mjs
+++ b/test/chat-diagram.test.mjs
@@ -708,3 +708,35 @@ test("a flow and a lifecycle draw as SVG in both themes, with no fallback source
   assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
   await page.close();
 });
+
+test("an organization draws each person's mark inside their box, outside the underlined name, in its nature's color", async () => {
+  const { page } = await asked([["diagram", PICTURES.organization], ["text", { text: "Billing Run Team." }]]);
+  await page.waitForSelector(".rbchat-diagram svg .label-icon");
+  const boxes = await page.$$eval(".rbchat-diagram svg g.node", (gs) => gs.map((g) => {
+    const icon = g.querySelector(".label-icon"), mark = g.querySelector(".rbchat-mark"), name = g.querySelector(".rbchat-node-name");
+    const box = g.querySelector("rect").getBoundingClientRect(), label = g.querySelector(".nodeLabel").getBoundingClientRect();
+    return {
+      nature: mark && mark.getAttribute("class"), color: mark && getComputedStyle(mark).color, inName: !!(name && icon && name.contains(icon)),
+      name: name && name.textContent.trim(), fits: label.width <= box.width && icon.getBoundingClientRect().right <= box.right,
+    };
+  }));
+  assert.deepEqual(boxes.map((b) => [b.nature, b.name, b.inName, b.fits]), [["rbchat-mark human", "Mira Halvorsen", false, true], ["rbchat-mark agent", "AI Agent", false, true]]);
+  assert.notEqual(boxes[0].color, boxes[1].color, "a person's mark and an agent's are two brightnesses");
+  const [frame, agents] = await page.$$eval(".rbchat-diagram svg .cluster rect", (rs) => rs.map((r) => getComputedStyle(r).fill));
+  assert.notEqual(agents, frame, "the agents' frame is shaded apart from its group's");
+  assert.equal(agents, await page.$eval(".rbchat-diagram-box", (b) => { const t = document.createElement("i"); t.style.color = "var(--press)"; b.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; }), "with the panel's press color");
+  assert.equal(await page.$eval(".rbchat-diagram figcaption span", (s) => s.textContent), "Organization · Billing Run Team");
+  assert.match(await page.$eval(".rbchat-diagram-reading", (p) => p.textContent), /agents stand in the shaded frame/);
+  await page.close();
+});
+
+test("the company's org chart draws its open positions as dashed, unfilled boxes, and no fallback source", async () => {
+  const { page } = await asked([["diagram", PICTURES.company], ["text", { text: "Beacon." }]]);
+  await page.waitForSelector(".rbchat-diagram svg g.node.open");
+  const open = await page.$$eval(".rbchat-diagram svg g.node.open", (gs) => gs.map((g) => { const r = g.querySelector("rect"); return [getComputedStyle(r).strokeDasharray, getComputedStyle(r).fill]; }));
+  assert.equal(open.length, 3);
+  for (const [dash, fill] of open) { assert.notEqual(dash, "none"); assert.equal(fill, "none"); }
+  assert.equal(await page.$$eval(".rbchat-diagram svg .label-icon", (els) => els.length), 4, "four people, four marks; an opening has none");
+  assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
+  await page.close();
+});
diff --git a/test/chat.test.mjs b/test/chat.test.mjs
index 647fde3..e412b10 100644
--- a/test/chat.test.mjs
+++ b/test/chat.test.mjs
@@ -6,6 +6,7 @@ import assert from "node:assert/strict";
 import fs from "node:fs";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
+import { MARKS } from "../lib/marks.mjs";
 
 const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const src = fs.readFileSync(path.join(PKG, "assets", "chat.js"), "utf8");
@@ -675,7 +676,7 @@ test("the caption names the shape in the page's language, then what it was drawn
   assert.equal(diagramCaption({ shape: "reading", title: null }, "de"), "");
   assert.equal(diagramCaption({ shape: "schema", title: null }, "en"), "Meta-model");
   assert.equal(diagramCaption({ shape: "schema", title: "phase" }, "de"), "Meta-Modell · phase");
-  for (const lang of ["en", "de"]) assert.deepEqual(Object.keys(strings(lang).diagram).sort(), ["aggregate", "concepts", "context", "expand", "failed", "fit", "fitTip", "flow", "lifecycle", "neighborhood", "process", "reading", "schema", "shut", "zoomIn", "zoomOut"]);
+  for (const lang of ["en", "de"]) assert.deepEqual(Object.keys(strings(lang).diagram).sort(), ["aggregate", "concepts", "context", "expand", "failed", "fit", "fitTip", "flow", "lifecycle", "neighborhood", "organization", "process", "reading", "schema", "shut", "zoomIn", "zoomOut"]);
 });
 
 test("the two pictures of a bounded context are captioned, and each has a reading line, in both languages", () => {
@@ -1017,3 +1018,14 @@ test("answerLang is the last answer's language where the server named one, else
   assert.match(src, /verdict: checked, lang: spoke \}\);/, "the answer's turn does not keep its language");
   assert.match(src, /verdict: t\.verdict \|\| null, lang: typeof t\.lang === "string" \? t\.lang : null \}\);/, "a restored turn loses its language, and the next page's chips switch back");
 });
+
+test("an organization is captioned and has a reading line in both languages, and the widget's marks are lib/marks.mjs's", () => {
+  assert.equal(diagramCaption({ shape: "organization", title: null }, "en"), "Organization");
+  assert.equal(diagramCaption({ shape: "organization", title: "Maintainers" }, "en"), "Organization · Maintainers");
+  for (const lang of ["en", "de"]) assert.ok(strings(lang).diagram.reading.organization.length > 20, lang);
+  assert.match(strings("en").diagram.reading.organization, /dashed box is an open position/);
+  assert.doesNotMatch(strings("de").diagram.reading.organization, /PROVISIONAL/, "the German is the translator's, made from the reviewed English");
+  assert.deepEqual(Object.keys(MARKS), ["human", "agent"]);
+  for (const [k, body] of Object.entries(MARKS)) assert.ok(src.includes(`${k}: '${body}'`), `chat.js carries the ${k} mark as lib/marks.mjs draws it`);
+  assert.match(src, /registerIconPacks\(\[\{ name: "fak"/);
+});
diff --git a/test/fixtures/diagrams.json b/test/fixtures/diagrams.json
index 2f0611a..c01ca03 100644
--- a/test/fixtures/diagrams.json
+++ b/test/fixtures/diagrams.json
@@ -215,5 +215,35 @@
    { "node": "n0", "id": "01a0ffff-0000-7000-8000-000000000111", "title": "Quote", "type": "aggregate" }
   ],
   "omitted": 0
+ },
+ "organization": {
+  "shape": "organization",
+  "title": "Billing Run Team",
+  "mermaid": "flowchart TB\n  subgraph g0 [\"Billing Run Team\"]\n    n0[\"fak:fa-human <b>Mira Halvorsen</b><br/><small>Backend Engineer</small>\"]:::lead\n    subgraph g0a [\" \"]\n      n1[\"fak:fa-agent <b>AI Agent</b>\"]\n    end\n    n0 ~~~ g0a\n  end\n  class g0a agents\n  classDef lead stroke-width:2px\n  classDef agents stroke-dasharray:2 3",
+  "nodes": [
+   { "node": "g0", "id": "01a1152c-3863-79ba-8430-755ed2dec49c", "title": "Billing Run Team", "type": "group" },
+   { "node": "n0", "id": "01a02f53-2408-7291-ac16-087fcdee4d71", "title": "Mira Halvorsen", "type": "profile" },
+   { "node": "n1", "id": "01a0a6b8-7e80-78af-b202-d3733bdd650c", "title": "AI Agent", "type": "profile" }
+  ],
+  "omitted": 0
+ },
+ "company": {
+  "shape": "organization",
+  "title": null,
+  "mermaid": "flowchart TB\n  subgraph g0 [\"Management\"]\n    n0[\"fak:fa-human <b>Ines Marchetti</b><br/><small>Managing Director</small>\"]:::lead\n    n1[\"fak:fa-human <b>Jonas Whitcombe</b><br/><small>Executive Assistant</small>\"]\n    n0 -.- n1\n  end\n  subgraph g1 [\"Legal\"]\n    n2[\"<b>Legal Counsel</b>\"]:::open\n  end\n  subgraph g2 [\"Engineering\"]\n    n3[\"fak:fa-human <b>Mira Halvorsen</b><br/><small>Engineering Lead</small>\"]:::lead\n    n4[\"<b>Backend Engineer</b><br/><small>× 2</small>\"]:::open\n    n3 ~~~ n4\n  end\n  subgraph g3 [\"Product\"]\n    n5[\"fak:fa-human <b>Tomas Reyes</b><br/><small>Head of Product</small>\"]:::lead\n    n6[\"<b>Head of Product</b>\"]:::open\n  end\n  n0 -.- n2\n  n0 --> n3\n  n0 --> n5\n  classDef lead stroke-width:2px\n  classDef open stroke-dasharray:5 4",
+  "nodes": [
+   { "node": "g0", "id": "01a1152c-3800-7600-a961-2992dc0f3e2d", "title": "Management", "type": "group" },
+   { "node": "n0", "id": "01a11fec-8792-73f8-b030-92147dae4f65", "title": "Ines Marchetti", "type": "profile" },
+   { "node": "n1", "id": "01a11fec-87c0-7d80-8aa2-fa64547264dc", "title": "Jonas Whitcombe", "type": "profile" },
+   { "node": "g1", "id": "01a11fcc-a579-7c38-88e9-0784850f3e77", "title": "Legal", "type": "group" },
+   { "node": "n2", "id": "01a11fcc-a49f-7fff-ba50-805be7c54c60", "title": "Legal Counsel", "type": "job" },
+   { "node": "g2", "id": "01a1152c-3830-7c3f-b3ad-3761dc40528c", "title": "Engineering", "type": "group" },
+   { "node": "n3", "id": "01a02f53-2408-7291-ac16-087fcdee4d71", "title": "Mira Halvorsen", "type": "profile" },
+   { "node": "n4", "id": "01a1199f-df7d-7d7d-90ae-03cd52174cbf", "title": "Backend Engineer", "type": "job" },
+   { "node": "g3", "id": "01a11732-685a-77fa-b329-a53090054f37", "title": "Product", "type": "group" },
+   { "node": "n5", "id": "01a03a2c-2de8-73b4-9058-8664caea919a", "title": "Tomas Reyes", "type": "profile" },
+   { "node": "n6", "id": "01a1199f-e00b-7a2a-9466-9f6a96ffe718", "title": "Head of Product", "type": "job" }
+  ],
+  "omitted": 1
  }
 }
diff --git a/test/spelling.test.mjs b/test/spelling.test.mjs
index 6e9b3bb..11826dc 100644
--- a/test/spelling.test.mjs
+++ b/test/spelling.test.mjs
@@ -39,7 +39,7 @@ const ALLOW = new Set([
   "parsers", "loser", "closer", "chooser", "eraser", "geyser", "laser", "lasers", "miser", "poser",
   "teaser", "visor", "denoiser", "analysis", "analyses", "hydrolysis",
   // German the widget's STRINGS carry, which only looks like a British -ise
-  "teilweise",
+  "teilweise", "organisation",
   // -our that is American
   "our", "ours", "hour", "hours", "four", "fours", "your", "yours", "tour", "tours", "pour", "poured",
   "pouring", "sour", "flour", "scour", "dour", "detour", "contour", "contours", "velour", "devour",
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/chat.test.mjs` Expected: FAIL at the import of `../lib/marks.mjs`, which does not exist yet.

- [ ] **Step 3: Write the marks, their registration, the label rule, the strings and the styles**

Apply this patch.

```diff
diff --git a/assets/chat.css b/assets/chat.css
index f6474d4..d9413a9 100644
--- a/assets/chat.css
+++ b/assets/chat.css
@@ -191,6 +191,15 @@ html[data-chat-waiting]::after{content:"ask \00b7  " attr(data-chat-waiting);pos
    mermaidConfig's edgeLabelBackground instead of fought over here. */
 .rbchat-diagram-box svg .edgeLabel,.rbchat-diagram-box svg .edgeLabel p,.rbchat-diagram-box svg .edgeLabel text{color:var(--dim)!important;fill:var(--dim)!important}
 .rbchat-diagram-failed{margin:0;font-size:.85rem}
+/* An org chart's marks: Mermaid sets the host's token as an svg.label-icon before a person's name,
+   sized to the text; a person's mark is the firm brightness and an agent's the mid, as the
+   Processes page draws them, and both beat the linked label's own color. An open position is a
+   dashed box with no fill, and the frame the agents of a group stand in is shaded. */
+.rbchat-diagram-box svg .label-icon{width:1.15em;height:1.15em;vertical-align:-.2em;margin-right:.3em}
+.rbchat-diagram-box svg .rbchat-mark.human{color:var(--c-firm,var(--ink))!important}
+.rbchat-diagram-box svg .rbchat-mark.agent{color:var(--c-mid)!important}
+.rbchat-diagram-box svg .node.open rect{fill:none!important}
+.rbchat-diagram-box svg .cluster.agents rect{fill:var(--press)!important}
 .rbchat-diagram-reading{margin:.35rem .1rem 0;font-size:.8rem;line-height:1.4;color:var(--dim)}
 /* A page's own picture is a preview: fitted to the column, never past its own size, and
    opened by a click to be read; chat.js marks it. The rule reaches the box only while it is in
diff --git a/assets/chat.js b/assets/chat.js
index 4901b97..6fc789f 100644
--- a/assets/chat.js
+++ b/assets/chat.js
@@ -127,7 +127,7 @@
       again: { sentence: "You can ask again {when}.", minute: "in a minute", minutes: "in {n} minutes", at: "at {time}", tomorrow: "tomorrow at {time}", day: "on {day} at {time}" },
       github: "{title} on GitHub", commit: "commit {sha}",
       modalClose: "Close \u00b7 Esc",
-      diagram: { concepts: "Concepts", process: "Process", neighborhood: "Connections", schema: "Meta-model", context: "Context map", aggregate: "Aggregate", flow: "Flow", lifecycle: "Lifecycle", reading: { context: "One-way arrows run from upstream to downstream; each arrow names the pattern between the two contexts.", aggregate: "The root holds what the diamonds join; the dashed arrows are the events it emits.", flow: "Solid arrows are commands sent to the aggregate, dashed arrows the events it emits; a box names the condition of each branch.", lifecycle: "Each arrow is a step from one state to the next, labeled with the command that takes it where there is one." }, expand: "Open full screen", shut: "Close full screen", zoomIn: "Zoom in", zoomOut: "Zoom out", fit: "Fit", fitTip: "Fit to the screen", failed: "The diagram could not be drawn; this is its source." },
+      diagram: { concepts: "Concepts", process: "Process", neighborhood: "Connections", schema: "Meta-model", context: "Context map", aggregate: "Aggregate", flow: "Flow", lifecycle: "Lifecycle", organization: "Organization", reading: { context: "One-way arrows run from upstream to downstream; each arrow names the pattern between the two contexts.", aggregate: "The root holds what the diamonds join; the dashed arrows are the events it emits.", flow: "Solid arrows are commands sent to the aggregate, dashed arrows the events it emits; a box names the condition of each branch.", lifecycle: "Each arrow is a step from one state to the next, labeled with the command that takes it where there is one.", organization: "Solid arrows run from a lead to the leads below; a dashed line joins staff to the head they serve; a dashed box is an open position, beside a lead the search for a successor; agents stand in the shaded frame." }, expand: "Open full screen", shut: "Close full screen", zoomIn: "Zoom in", zoomOut: "Zoom out", fit: "Fit", fitTip: "Fit to the screen", failed: "The diagram could not be drawn; this is its source." },
       refusal: {
         too_long: "That message is over 1,000 characters.",
         too_much: "The conversation has grown too long to send; start a new one.",
@@ -174,7 +174,7 @@
       again: { sentence: "Sie können {when} wieder fragen.", minute: "in einer Minute", minutes: "in {n} Minuten", at: "um {time}", tomorrow: "morgen um {time}", day: "am {day} um {time}" },
       github: "{title} auf GitHub", commit: "Commit {sha}",
       modalClose: "Schliessen \u00b7 Esc",
-      diagram: { concepts: "Konzepte", process: "Prozess", neighborhood: "Verbindungen", schema: "Meta-Modell", context: "Context Map", aggregate: "Aggregat", flow: "Ablauf", lifecycle: "Lebenszyklus", reading: { context: "Einfache Pfeile laufen vom Upstream- zum Downstream-Kontext; jeder Pfeil nennt das Muster zwischen den beiden Kontexten.", aggregate: "Die Wurzel des Aggregats hält, was die Rauten verbinden; die gestrichelten Pfeile sind die Ereignisse, die sie auslöst.", flow: "Durchgezogene Pfeile sind Befehle an das Aggregat, gestrichelte die Ereignisse, die es auslöst; ein Kasten nennt die Bedingung jedes Zweigs.", lifecycle: "Jeder Pfeil ist ein Schritt von einem Zustand zum nächsten, beschriftet mit dem Befehl, der ihn auslöst, wo es einen gibt." }, expand: "Im Vollbild öffnen", shut: "Vollbild schliessen", zoomIn: "Vergrössern", zoomOut: "Verkleinern", fit: "Einpassen", fitTip: "Auf den Bildschirm einpassen", failed: "Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle." },
+      diagram: { concepts: "Konzepte", process: "Prozess", neighborhood: "Verbindungen", schema: "Meta-Modell", context: "Context Map", aggregate: "Aggregat", flow: "Ablauf", lifecycle: "Lebenszyklus", organization: "Organisation", reading: { context: "Einfache Pfeile laufen vom Upstream- zum Downstream-Kontext; jeder Pfeil nennt das Muster zwischen den beiden Kontexten.", aggregate: "Die Wurzel des Aggregats hält, was die Rauten verbinden; die gestrichelten Pfeile sind die Ereignisse, die sie auslöst.", flow: "Durchgezogene Pfeile sind Befehle an das Aggregat, gestrichelte die Ereignisse, die es auslöst; ein Kasten nennt die Bedingung jedes Zweigs.", lifecycle: "Jeder Pfeil ist ein Schritt von einem Zustand zum nächsten, beschriftet mit dem Befehl, der ihn auslöst, wo es einen gibt.", organization: "PROVISIONAL – the translator writes this line from the reviewed English." }, expand: "Im Vollbild öffnen", shut: "Vollbild schliessen", zoomIn: "Vergrössern", zoomOut: "Verkleinern", fit: "Einpassen", fitTip: "Auf den Bildschirm einpassen", failed: "Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle." },
       refusal: {
         too_long: "Diese Nachricht ist länger als 1’000 Zeichen.",
         too_much: "Das Gespräch ist zu lang geworden, um es zu senden; beginnen Sie ein neues.",
@@ -785,7 +785,7 @@
   // Tolerant of a label Mermaid renders differently: an empty run is left unwrapped.
   function wrapNodeName(p){
     var kids = [].slice.call(p.childNodes), hasSmall = false, i;
-    for (i = 0; i < kids.length; i++) if (kids[i].nodeType === 1 && kids[i].tagName === "SMALL") { hasSmall = true; break; }
+    for (i = 0; i < kids.length; i++) if (kids[i].nodeType === 1 && (kids[i].tagName === "SMALL" || (kids[i].classList && kids[i].classList.contains("label-icon")))) { hasSmall = true; break; }
     function wrap(run){
       if (!run.length) return;
       var span = document.createElement("span");
@@ -798,6 +798,8 @@
     for (i = 0; i < kids.length; i++) {
       var k = kids[i];
       if (k.nodeType === 1 && (k.tagName === "SMALL" || k.tagName === "BR")) { wrap(run); run = []; }
+      // A nature's mark Mermaid set before the name stays outside the span a hover underlines.
+      else if (k.nodeType === 1 && k.classList && k.classList.contains("label-icon")) { wrap(run); run = []; }
       else run.push(k);
     }
     wrap(run);
@@ -898,12 +900,29 @@
   // The picture the one modal holds, its handle, and the zoom controls it carries in its head.
   var modalFig = null, modalHandle = null, zoomBar = null, zoomIn = null, zoomOut = null, zoomFit = null;
 
+  // The two natures' marks, lib/marks.mjs's own, which a test holds this copy to. The host writes
+  // `fak:fa-human` or `fak:fa-agent` before a person's name, and Mermaid swaps the token for the
+  // mark before it measures the label, so the box fits it. Registered once per Mermaid, whoever
+  // loaded it; each body is wrapped in a group whose class chat.css colors.
+  var MARKS = {
+    human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
+    agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>'
+  };
+  function withMarks(m){
+    if (m && typeof m.registerIconPacks === "function" && !m.rbMarks) {
+      var icons = {};
+      Object.keys(MARKS).forEach(function(k){ icons[k] = { body: '<g class="rbchat-mark ' + k + '">' + MARKS[k] + "</g>" }; });
+      m.registerIconPacks([{ name: "fak", icons: { prefix: "fak", width: 16, height: 16, icons: icons } }]);
+      m.rbMarks = true;
+    }
+    return m;
+  }
   function loadMermaid(){
-    if (window.mermaid) return Promise.resolve(window.mermaid);
+    if (window.mermaid) return Promise.resolve(withMarks(window.mermaid));
     if (!mermaidLoad) mermaidLoad = new Promise(function(resolve, reject){
       var s = document.createElement("script");
       s.src = new URL("mermaid.min.js", tag.src).href;
-      s.onload = function(){ if (window.mermaid) resolve(window.mermaid); else reject(new Error("mermaid.min.js set no mermaid")); };
+      s.onload = function(){ if (window.mermaid) resolve(withMarks(window.mermaid)); else reject(new Error("mermaid.min.js set no mermaid")); };
       // A failed fetch is not remembered: the next picture tries again.
       s.onerror = function(){ mermaidLoad = null; reject(new Error("mermaid.min.js did not load")); };
       document.head.appendChild(s);
diff --git a/lib/marks.mjs b/lib/marks.mjs
new file mode 100644
index 0000000..9c2fff6
--- /dev/null
+++ b/lib/marks.mjs
@@ -0,0 +1,8 @@
+// The two natures' marks, as the Processes page draws them: a filled figure for a person and an
+// outlined machine for an agent, on a 16-unit square, each in currentColor. The chat widget carries
+// the same two bodies, since it is a script a page loads and imports nothing, and a test holds its
+// copy to this one.
+export const MARKS = {
+  human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
+  agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>',
+};
```

- [ ] **Step 4: Run the suite**

Run: `npm test` Expected: 991 of 992 pass. The one failure is "an organization is captioned and has a reading line in both languages…", on the assertion "the German is the translator's, made from the reviewed English": the German reading line is still the placeholder, and Task 4 replaces it. The two Playwright tests pass in Chromium: each person's mark inside their box and outside the underlined name, a person's mark and an agent's in two brightnesses, the agents' frame shaded with the panel's press color, the three openings of the whole example dashed and unfilled, four marks for four people.

- [ ] **Step 5: Commit the English**

```bash
git add lib/marks.mjs assets/chat.js assets/chat.css test/chat.test.mjs test/chat-diagram.test.mjs test/fixtures/diagrams.json test/spelling.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F- <<'EOF'
The chat marks an organization's people as humans or agents

The diagram tool's organization writes fak:fa-human or fak:fa-agent before each person's name. The widget registers the Processes page's two marks as the icon pack fak, so Mermaid sets the mark and sizes the box around it, and colors them as the page does: a person's at the firm brightness, an agent's at the mid. An open position is a dashed, unfilled box and a group's agents stand in a shaded frame. The marks are defined once in lib/marks.mjs, and a test holds chat.js's copy to it.

The shape's English caption and reading line are in; the German reading line waits for the translator, and its test fails until it does.

Verified: npm test passes 991 of 992; the one failure is the German placeholder's own test.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: The owner reviews the English**

Ask the owner to review the caption "Organization" and the reading line "Solid arrows run from a lead to the leads below; a dashed line joins staff to the head they serve; a dashed box is an open position, beside a lead the search for a successor; agents stand in the shaded frame." on the branch. Nothing in Task 4 starts before that word.

### Task 4: The widget's German

**Repository:** robertblust/design, its worktree.

**Files:**

- Modify: `assets/chat.js:177` — `diagram.organization` and `diagram.reading.organization` in the German strings
- Modify: `test/spelling.test.mjs:42` — only if the German caption is not "Organisation"

- [ ] **Step 1: Dispatch the translator**

Dispatch the `translator` agent with: the reviewed English of the two strings, their place in `assets/chat.js`'s German `diagram` strings, and the German strings around them for voice ("Durchgezogene Pfeile sind Befehle an das Aggregat, gestrichelte die Ereignisse, die es auslöst; ein Kasten nennt die Bedingung jedes Zweigs."). It edits the two values and reports each with a reason.

- [ ] **Step 2: Dispatch the editor, then the back-reader**

Dispatch the `editor` agent with the two German values alone, never the English. Apply its corrections and each flag's first option. Then dispatch the `backreader` agent with the German alone, set its literal English against the reviewed English, and send any value whose meaning moved back to the translator.

- [ ] **Step 3: The owner picks**

Give the owner the editor's flags and the translator's term doubts, in German, with their alternatives. A term the owner settles becomes a row of `conventions/GLOSSARY.md` in robertblust/conventions, proposed there and not here.

- [ ] **Step 4: Run the suite**

If the German caption is "Organisation", `test/spelling.test.mjs` already allows it beside "teilweise". If it is another word that ends in -isation or -ise, add that word there instead and remove "organisation".

Run: `npm test` Expected: PASS, 992 tests, 0 failing.

- [ ] **Step 5: Commit the German**

```bash
git add assets/chat.js test/spelling.test.mjs
git commit --author "Translator <translator@blust.ch>" -F- <<'EOF'
The organization's caption and reading line in German

Made from the reviewed English by the translator, read by the editor without the English and rendered back by the back-reader, with the owner's picks where the editor flagged a choice.

Verified: npm test passes 992 tests.

Process: Delivery
Phase: Implement
Track: Prose
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Open the pull request and stop**

```bash
git push -u origin an-organization-is-drawn
gh pr create --title "The chat marks an organization's people as humans or agents" --body-file - <<'EOF'
The widget's side of companygraph/mcp-server's organization shape: the Processes page's two marks registered as the Mermaid icon pack `fak`, so `fak:fa-human` and `fak:fa-agent` before a name become a filled figure and an outlined machine, sized into the box; open positions dashed and unfilled; a group's agents in a shaded frame; the caption and reading line in English and German. The marks are defined once in `lib/marks.mjs`, held to `chat.js`'s copy by a test.

Verified: npm test passes 992 tests, the two organization pictures drawn in Chromium.

Sibling: the mcp-server pull request for the shape.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Report the check and stop. The owner merges and releases design as the next minor; the three sites take it in their next re-pin.

### Task 5: The chat asks for the shape

**Repository:** companygraph/chat-server, its worktree.

**Files:**

- Modify: `lib/prompt.mjs:87` — `DIAGRAM_RULE`
- Modify: `types/lib/prompt.d.mts` — written by `npm run build`
- Modify: `package.json`, `package-lock.json` — `companygraph-mcp-server` at the release Task 2's merge makes, the version its tests run against
- Test: `test/prompt.test.mjs`

**Interfaces:**

- Consumes: the `diagram` tool's shape `organization` and its answer's `omitted`, which `lib/loop.mjs:233` already gives the model.

- [ ] **Step 1: Write the failing test**

```diff
diff --git a/test/prompt.test.mjs b/test/prompt.test.mjs
index 6b1155f..fc2027e 100644
--- a/test/prompt.test.mjs
+++ b/test/prompt.test.mjs
@@ -199,7 +199,9 @@ test("the picture sentence follows the Markdown rule where the host draws, and i
   assert.match(DIAGRAM_RULE, /never the picture itself/);
   assert.match(DIAGRAM_RULE, /only the relations the tool listed/);
   assert.match(DIAGRAM_RULE, /bounded context/);
-  assert.match(DIAGRAM_RULE, /shape concepts, process, neighborhood, context, aggregate, flow or lifecycle/);
+  assert.match(DIAGRAM_RULE, /shape concepts, process, neighborhood, context, aggregate, flow, lifecycle or organization/);
+  assert.match(DIAGRAM_RULE, /how the company is organized, who leads what, who works in a group, or for an org chart, is shown shape organization, with a group's id where they name one/);
+  assert.match(DIAGRAM_RULE, /where its omitted is above zero, the answer says in one sentence that the teams outside the line are drawn when one is named/);
   assert.match(DIAGRAM_RULE, /a bounded context, or the diagrams of one, is shown shape context, then aggregate, then flow, then lifecycle, all with the context's id/);
   assert.match(DIAGRAM_RULE, /the map stands alone and the answer says only that the context holds no aggregate; otherwise, where flow or lifecycle refuses as empty,/);
   assert.match(DIAGRAM_RULE, /where flow or lifecycle refuses as empty, the answer says in one sentence that the model does not describe that flow or lifecycle yet/);
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/prompt.test.mjs` Expected: FAIL on `/shape concepts, process, neighborhood, context, aggregate, flow, lifecycle or organization/`.

- [ ] **Step 3: Write the clause**

```diff
diff --git a/lib/prompt.mjs b/lib/prompt.mjs
index d3c04dc..d149151 100644
--- a/lib/prompt.mjs
+++ b/lib/prompt.mjs
@@ -84,7 +84,7 @@ export const KIND_RULE = "A question about the questions this model answers, whi
 // together, because the widget draws every picture a message brings; a flow or a lifecycle the
 // model does not describe is said in one sentence, not answered in words and a table, since what
 // is missing is the rows, which no table could supply.
-export const DIAGRAM_RULE = "A visitor who asks to see how the concepts relate, how a process runs, or how something connects is shown a picture: call diagram, with shape concepts, process, neighborhood, context, aggregate, flow or lifecycle; one who asks to see the meta-model, the schemas or the types the model is written in, or what it is based on, is shown shape schema, with type where they name one, not shape concepts; the meta-model is always this model's schemas, so a question about what it is gets that answer. One who asks to see a bounded context, or the diagrams of one, is shown shape context, then aggregate, then flow, then lifecycle, all with the context's id, and the answer names what each drew; where aggregate refuses as empty, the map stands alone and the answer says only that the context holds no aggregate; otherwise, where flow or lifecycle refuses as empty, the answer says in one sentence that the model does not describe that flow or lifecycle yet. One who asks for the sequence or the lifecycle of a context or an aggregate is shown that shape alone, flow for the sequence, with its id. Then write a sentence or two naming what it drew by title, with no table of it, stating only the relations the tool listed, and never the picture itself, in Mermaid or any other form, because the widget draws it under the answer. Where diagram refuses for any other reason, answer in words and a table as you would without it.";
+export const DIAGRAM_RULE = "A visitor who asks to see how the concepts relate, how a process runs, or how something connects is shown a picture: call diagram, with shape concepts, process, neighborhood, context, aggregate, flow, lifecycle or organization; one who asks to see the meta-model, the schemas or the types the model is written in, or what it is based on, is shown shape schema, with type where they name one, not shape concepts; the meta-model is always this model's schemas, so a question about what it is gets that answer. One who asks to see a bounded context, or the diagrams of one, is shown shape context, then aggregate, then flow, then lifecycle, all with the context's id, and the answer names what each drew; where aggregate refuses as empty, the map stands alone and the answer says only that the context holds no aggregate; otherwise, where flow or lifecycle refuses as empty, the answer says in one sentence that the model does not describe that flow or lifecycle yet. One who asks for the sequence or the lifecycle of a context or an aggregate is shown that shape alone, flow for the sequence, with its id. One who asks how the company is organized, who leads what, who works in a group, or for an org chart, is shown shape organization, with a group's id where they name one; where its omitted is above zero, the answer says in one sentence that the teams outside the line are drawn when one is named. Then write a sentence or two naming what it drew by title, with no table of it, stating only the relations the tool listed, and never the picture itself, in Mermaid or any other form, because the widget draws it under the answer. Where diagram refuses for any other reason, answer in words and a table as you would without it.";
 
 // The types as one sentence, so the model knows what kinds of thing the model holds before it
 // reaches for a tool: `feature (5)`, and an owned type with its owner, `phase (12, owned by
```

- [ ] **Step 4: Take the mcp-server release**

Only once the owner has released mcp-server with the shape. Set `companygraph-mcp-server` in `package.json` to that release's tag, in the form the line already has, and run `npm install`.

- [ ] **Step 5: Run the suite**

Run: `npm run build && npm test && npm run build:check` Expected: PASS, 281 tests, 0 failing; `✓ types/ is what the JSDoc in lib/, bin/ and deploy/ declares`.

- [ ] **Step 6: Measure**

On the host of companygraph.io run locally against the model of Task 6 and the design release of Task 4, ask, control against change, "how is CompanyGraph organized?", "wer arbeitet an CompanyGraph?" and "show me the org chart". Read the answers, do not score them: the change draws Maintainers with five boxes, three of them in the agents' frame, and the answer names the group without describing the picture. Ask one of them again on the widget before Task 4's release, and read that the boxes show names with no stray text where the marks would be.

- [ ] **Step 7: Commit, open the pull request and stop**

```bash
git add lib/prompt.mjs types/lib/prompt.d.mts test/prompt.test.mjs package.json package-lock.json
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The chat draws the organization when asked how the company is organized

DIAGRAM_RULE gains the shape and one clause: a visitor who asks how the company is organized, who leads what, who works in a group or for an org chart is shown shape organization, with a group's id where they name one, and where teams outside the line were left out, the answer says they are drawn when one is named.

Verified: npm test passes 281 tests; build:check passes; the measurement on companygraph.io's model read the three answers.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push -u origin an-organization-is-drawn
gh pr create --title "The chat draws the organization when asked how the company is organized" --body "DIAGRAM_RULE asks for companygraph/mcp-server's new organization shape. Release it, and move a deployment to it, only after that deployment's site has taken the design release that marks the people.

Verified: npm test passes 281 tests; build:check passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Task 6: CompanyGraph's own team

**Repository:** companygraph/mental-model, its worktree.

**Files:**

- Modify: `.companygraph/manifest.json` — `packs` gains `organization`, with the vendored files' hashes; written by `upgrade`
- Create: `meta/organization/` — the pack, vendored by `upgrade`, never edited here
- Create: `model/group-kinds/README.md`, `model/groups/README.md`, `model/jobs/README.md` — written by `upgrade`
- Create: `model/group-kinds/team.md`, `model/jobs/maintainer.md`, `model/jobs/co-maintainer.md`, `model/groups/maintainers.md`
- Modify: `model/profiles/mischa-ramseyer/mischa-ramseyer.md` — the tagline

- [ ] **Step 1: Take the pack**

Run: `npx --yes "github:companygraph/meta-model#v0.88.0" upgrade . --pack organization` Expected: `packs: organization, vendored beside core`, the three READMEs written, and `✓ model/ against meta/core, meta/software, meta/organization/ at core 0.64.0: the mechanical checks pass`.

- [ ] **Step 2: Make four ids**

Run `npx --yes "github:companygraph/meta-model#v0.88.0" id` four times, one id for each page.

- [ ] **Step 3: Dispatch the writer**

Dispatch the `writer` agent with this brief. Audience: a visitor to companygraph.io and an agent reading the model, neither of whom knows the project. Point: CompanyGraph is kept by one team of two people and three agents, and nothing more is claimed. Facts it may claim, each with where it is shown: Robert Blust is "Maintainer of CompanyGraph" (his profile) and holds the Owner seat (`model/seats/owner.md`: the word every merge, tag and release waits on); Mischa Ramseyer holds the Partner seat (`model/seats/partner.md`: a say at every gate before Integrate, never the merge, the tag or the release); the three agents' profiles and seats; and the owner's decision of October 9, 2026 that Mischa's job is Co-Maintainer and the group is a team outside the line, because nothing published says it hires, appraises or sets objectives. Where it lands: the four pages below, against `meta/organization/`'s schemas and their writing rules, and Mischa Ramseyer's tagline, proposed as "Co-maintainer of CompanyGraph, and the human in the loop at beacon.build." and confirmed with Mischa, whose words it is. The pages as the shape must hold them, the writer free in the prose and not in the facts:

```markdown
---
id: <id 1>
source: Local
in-line: no
---

# Team

> A group gathered for the work of the project, whose people keep whatever they are employed as elsewhere.

## What it means

A team is how the people and agents who work on CompanyGraph stand together. It hires no one, appraises no one and sets no one's objectives, so it stands outside the disciplinary line; a unit that did those things would not be a team.
```

```markdown
---
id: <id 2>
source: Local
seats:
  - Owner
---

# Maintainer

> Keeps CompanyGraph: decides what it is for, and gives the word every merge, tag and release waits on.
```

```markdown
---
id: <id 3>
source: Local
seats:
  - Partner
---

# Co-Maintainer

> Maintains CompanyGraph beside the Maintainer, with a say at every gate before Integrate, and leaves the merge, the tag and the release to the Maintainer.
```

```markdown
---
id: <id 4>
source: Local
kind: Team
---

# Maintainers

> Keep CompanyGraph, the meta-model and everything published from it.

## People

| Profile | Job | Place |
| --- | --- | --- |
| Robert Blust | Maintainer | Lead |
| Mischa Ramseyer | Co-Maintainer | Member |
| AI Agent | | Member |
| English Voice | | Member |
| German Voice | | Member |
```

The writer reports what it wrote and each claim it could not trace.

- [ ] **Step 4: Check the model**

Run: `npx --yes "github:companygraph/meta-model#v0.88.0" check . && sh conventions/conventions-check && sh conventions/conventions-format` Expected: the mechanical checks pass; both conventions checks pass.

Run the shape over it from the mcp-server worktree, with Task 1 in place:

```bash
cd ~/git/companygraph/mcp-server-an-organization-is-drawn
node --input-type=module -e '
import path from "node:path";
import { buildSnapshot } from "./lib/snapshot.mjs";
import { readDir } from "./lib/read.mjs";
import { diagram } from "./lib/diagram.mjs";
const root = "../mental-model-an-organization-is-drawn";
const schemas = readDir(path.join(root, "meta", "core"));
for (const pack of ["software", "organization"]) for (const [f, t] of readDir(path.join(root, "meta", pack))) schemas.set(`${pack}/${f}`, t);
const s = buildSnapshot({ files: readDir(path.join(root, "model")), schemas, sub: "model/", core: "meta/core/", commit: "0".repeat(40), repo: "companygraph/mental-model", parserTag: "v0.88.0" });
console.log(diagram(s, { shape: "organization" }).mermaid);'
```

Expected:

```text
flowchart TB
  subgraph g0 ["Maintainers"]
    n0["fak:fa-human <b>Robert Blust</b><br/><small>Maintainer</small>"]:::lead
    n1["fak:fa-human <b>Mischa Ramseyer</b><br/><small>Co-Maintainer</small>"]
    subgraph g0a [" "]
      direction LR
      n2["fak:fa-agent <b>AI Agent</b>"]
      n3["fak:fa-agent <b>English Voice</b>"]
      n4["fak:fa-agent <b>German Voice</b>"]
    end
    n0 ~~~ n1
    n1 ~~~ g0a
  end
  class g0a agents
  classDef lead stroke-width:2px
  classDef agents stroke-dasharray:2 3
```

- [ ] **Step 5: The owner reviews the English, then commit**

After the owner's review on the branch:

```bash
git add .companygraph/manifest.json meta/organization model/group-kinds model/groups model/jobs model/profiles/mischa-ramseyer/mischa-ramseyer.md
git commit --author "Writer <writer@companygraph.io>" -F- <<'EOF'
CompanyGraph is kept by one team, the Maintainers

The model takes the organization pack and says what is true of the project's people: one team outside the disciplinary line, since nothing published says it hires, appraises or sets objectives, led by the Maintainer, with the Co-Maintainer and the three agents as its members. Mischa Ramseyer's tagline names the job, so the model claims nothing its prose does not show.

Verified: companygraph check passes the mechanical checks; conventions-check and conventions-format pass; the organization shape draws the five boxes and the agents' frame.

Process: Delivery
Phase: Implement
Track: Prose
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push -u origin an-organization-is-drawn
gh pr create --title "CompanyGraph is kept by one team, the Maintainers" --body "The organization pack, and the one group that is true of the project: Maintainers, a team outside the line, Robert Blust its lead as Maintainer, Mischa Ramseyer as Co-Maintainer, and the three agents. companygraph.io's org chart draws it once the host's pin moves.

Verified: companygraph check, conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Report the check and stop.

### Task 7: The pack no longer leaves the chart for later

**Repository:** companygraph/meta-model.

**Files:**

- Modify: `packs/organization/README.md` — the last paragraph

- [ ] **Step 1: Make the worktree**

```bash
cd ~/git/companygraph/meta-model
git worktree add ../meta-model-organization-chart -b organization-chart
cd ../meta-model-organization-chart
```

- [ ] **Step 2: Edit the line**

In `packs/organization/README.md`, under "## Left for later", replace

```markdown
Edges from a group to KPIs and processes; a transitive form of `part-of`; a check that a person in a job holds the seats the job names; a rendered org chart.
```

with

```markdown
Edges from a group to KPIs and processes; a transitive form of `part-of`; a check that a person in a job holds the seats the job names. An org chart is drawn by companygraph/mcp-server's `diagram` tool, shape `organization`.
```

- [ ] **Step 3: Verify**

Run: `npm ci && npm run verify && sh conventions/conventions-check && sh conventions/conventions-format`

Expected: each passes.

- [ ] **Step 4: Commit, open the pull request and stop**

```bash
git add packs/organization/README.md
git commit --author "Implementer <implementer@companygraph.io>" -F- <<'EOF'
The organization pack's chart is drawn by the diagram tool

The pack's README left a rendered org chart for later; the MCP server's diagram tool now draws one, so the README says where. The file is vendored into every instance that takes the pack, so the change rides with the next release.

Verified: npm run verify, conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push -u origin organization-chart
gh pr create --title "The organization pack's chart is drawn by the diagram tool" --body "One line of the pack's README. Vendored into instances, so it rides with the next meta-model release rather than one of its own.

Verified: npm run verify, conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Task 8: Order and hand-off

No code. What the session reports when the pull requests are open.

- [ ] **Step 1: Report the order**

The mcp-server pull request merges and is released first. Then design's, released, and taken by blust.ch, companygraph.io and guestgraph.io in their next re-pin. Then chat-server's, released and moved into each deployment only after its site has taken the design release. mental-model's merges at any time and reaches companygraph.io and mcp.companygraph.io when their commit pins move. meta-model's rides with its next release. The resync that moves the pins is the owner's to start; the session names which members each release reaches and starts none.

- [ ] **Step 2: Remove the worktrees once merged**

For each repository, after its pull request merges: `git worktree remove ../<repository>-an-organization-is-drawn` from the clone, and delete the branch.
