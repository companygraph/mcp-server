// The diagram tool's pictures, over the worked example and over fixtures built for what the
// example does not hold. A shape's whole source is compared, because a client draws exactly what
// is sent and a line out of place is a different picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeOfAddress } from "companygraph-meta-model/instance";
import { diagram, processDiagram, label, plain, cannot, DIAGRAM_CAP } from "../lib/diagram.mjs";
import { ModelError } from "../lib/errors.mjs";
import { exampleSnapshot, instanceSnapshot, withHub, withLoops, withPunctuation, withNothingToDraw, withBackFlows, withContexts, CONTEXT_ID, CONTEXT_IDS, ODD, COMMIT, idAt } from "./helpers.mjs";

const s = exampleSnapshot();
// The example's entities by where their pages sit, and the ids the snapshot gives them. A fixture
// built from the example holds the same pages, so the same ids.
const I = (address) => idAt(s, address);
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
  assert.equal(label("`bold`"), "#96;bold#96;");
});

// The associations of a concepts picture stand in the order every list of edges has: by where
// the page of the concept drawing each sits, then where the one it reaches sits, and rows to one
// concept in their table's order. Each arrow is `[from, to, label]`, by node.
const associations = (arrows) => arrows.map(([from, to, said]) => `  ${from} --> ${to} : ${said}`);
const linksOf = (arrows) => arrows.map(([from, to, label]) => ({ from, to, label }));

test("every concept, with each Relations row an association labeled with its cardinality and role", () => {
  const d = diagram(s, { shape: "concepts" });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["concepts", null, 11, 0, COMMIT]);
  const arrows = [
    ["n1", "n3", "one, signing customer"], ["n1", "n3", "maybe one, paying customer"], ["n1", "n6", "one to many, terms"],
    ["n2", "n4", "one, corrected invoice"], ["n2", "n5", "one to many, lines"], ["n4", "n0", "one"],
    ["n4", "n3", "one, billed customer"], ["n4", "n5", "one to many, lines"], ["n5", "n6", "one, rule"],
    ["n5", "n7", "many, usage read"], ["n7", "n1", "one"],
  ];
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["Billing period"]', '  class n1["Contract"]', '  class n2["Credit note"]', '  class n3["Customer"]',
    '  class n4["Invoice"]', '  class n5["Invoice line"]', '  class n6["Pricing rule"]', '  class n7["Usage record"]',
    ...associations(arrows),
  ]);
  assert.deepEqual(d.nodes[4], { node: "n4", id: I("concepts/invoice"), title: "Invoice", type: "concept" });
  assert.equal(d.links.length, 11);
  assert.deepEqual(d.links, linksOf(arrows));
});

test("a domain draws its concepts, and one outside it that they reach carries its own domain's name", () => {
  const d = diagram(s, { shape: "concepts", domain: I("domains/invoicing") });
  assert.deepEqual([d.title, d.edges], ["Invoicing", 7]);
  const arrows = [
    ["n1", "n2", "one, corrected invoice"], ["n1", "n3", "one to many, lines"], ["n2", "n0", "one"],
    ["n2", "n4", "one, billed customer"], ["n2", "n3", "one to many, lines"], ["n3", "n5", "one, rule"], ["n3", "n6", "many, usage read"],
  ];
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["Billing period"]', '  class n1["Credit note"]', '  class n2["Invoice"]', '  class n3["Invoice line"]',
    '  class n4["Customer · Pricing"]', '  class n5["Pricing rule · Pricing"]', '  class n6["Usage record · Pricing"]',
    ...associations(arrows),
  ]);
  assert.deepEqual(d.nodes[4], { node: "n4", id: I("concepts/customer"), title: "Customer", type: "concept" });
  assert.equal(d.links.length, 7);
  assert.deepEqual(d.links, linksOf(arrows));
});

test("an As cell's own colon and semicolon are escaped, since Mermaid ends an unquoted association label at either", () => {
  const d = diagram(withPunctuation(), { shape: "concepts" });
  const bond = d.nodes.find((n) => n.title === "Bond").node;
  const glue = d.nodes.find((n) => n.title === "Glue").node;
  assert.ok(lines(d).includes(`  ${bond} --> ${glue} : one, a#58; b#59; c`), d.mermaid);
  assert.deepEqual(d.links.find((l) => l.from === bond && l.to === glue), { from: bond, to: glue, label: "one, a: b; c" });
  const quoted = d.nodes.find((n) => n.title === "Quoted").node;
  assert.ok(lines(d).includes(`  ${quoted} --> ${glue} : one, the #quot;glue#quot;#59; a`), d.mermaid);
});

// The model's own parser reads every field one line at a time, so a raw value can never carry a
// line break through it; `plain()` is the fold a raw link label would still need if one ever did,
// the same fold `label()` applies before its own escaping, tested directly since a fixture holding
// a real line break cannot reach a link through the parser to prove it end to end.
test("plain() folds a line break and its surrounding spaces to one space, the fold a raw link label keeps", () => {
  assert.equal(plain("Reviewer\nSecond"), "Reviewer Second");
  assert.equal(plain("Reviewer \r\n  Second"), "Reviewer Second");
  assert.equal(plain("Reviewer, Second"), "Reviewer, Second");
  assert.equal(label("a\nb"), plain(label("a\nb")), "label()'s own fold matches plain()'s");
});

test("a process draws its phases in its table's order, who executes each, and each gate with its approvers", () => {
  const d = diagram(s, { shape: "process", id: I("processes/delivery") });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Delivery", 4, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<b>Specify</b><br/><small>Backend Engineer</small>"]', '  n1["<b>Build</b><br/><small>Backend Engineer, Reviewer</small>"]', '  n2["<b>Release</b><br/><small>Reviewer</small>"]',
    '  n0 -->|"Reviewer"| n1', '  n1 -->|"Reviewer"| n2',
    '  n0 -.->|"Reviewer: reshaped"| n0',
    '  n1 -.->|"Reviewer: reworked"| n1',
    "  stop((Stop))",
    '  n0 -.->|"Reviewer: dropped"| stop',
    '  n1 -.->|"Reviewer: abandoned"| stop',
    '  n2 -.->|"Reviewer: rolled back"| stop',
    "  classDef stop fill:none,stroke-dasharray:3 3",
    "  class stop stop",
  ]);
  assert.deepEqual(ids(d), [["n0", I("processes/delivery/phases/specify")], ["n1", I("processes/delivery/phases/build")], ["n2", I("processes/delivery/phases/release")]]);
  assert.deepEqual(d.links, [
    { from: "n0", to: "n1", label: "Reviewer" }, { from: "n1", to: "n2", label: "Reviewer" },
    { from: "n0", to: "n0", label: "Reviewer: reshaped" }, { from: "n1", to: "n1", label: "Reviewer: reworked" },
  ]);
});

test("rows to one phase merge into one arrow, in table order, escaped in the picture and raw in links; no stop row, no Stop node", () => {
  const d = diagram(withBackFlows(), { shape: "process", id: I("processes/delivery") });
  assert.deepEqual(lines(d).slice(6), [
    '  n0 -.->|"Reviewer: reshaped"| n0',
    '  n1 -.->|"Reviewer: respecified, held #quot;for now#quot; #lt;#35;1#gt;"| n0',
    '  n2 -.->|"Reviewer: held"| n2',
  ]);
  assert.ok(!d.mermaid.includes("stop"), d.mermaid);
  assert.deepEqual(d.links.slice(2), [
    { from: "n0", to: "n0", label: "Reviewer: reshaped" },
    { from: "n1", to: "n0", label: 'Reviewer: respecified, held "for now" <#1>' },
    { from: "n2", to: "n2", label: "Reviewer: held" },
  ]);
  assert.equal(d.edges, 6);
});

test("a site's model.json, the parser's entities and edges with no schemas, draws the tool's own process picture", () => {
  const { entities, edges, commit, repo } = withBackFlows();
  const { model, shape, ...drawn } = diagram(withBackFlows(), { shape: "process", id: I("processes/delivery") });
  assert.deepEqual(processDiagram(structuredClone({ entities, edges, commit, repo }), I("processes/delivery")), drawn);
});

test("the Stop node is never a node a client links, and its arrows are never links", () => {
  const d = diagram(s, { shape: "process", id: I("processes/delivery") });
  assert.ok(d.nodes.every((n) => n.node !== "stop"));
  assert.ok(d.links.every((l) => l.to !== "stop" && l.from !== "stop"));
});

test("a phase with no If not met section, as on an older core, draws exactly today's picture", () => {
  const old = structuredClone(exampleSnapshot());
  for (const e of old.entities) if (e.type === "phase") e.sections = e.sections.filter((x) => x.heading !== "If not met");
  old.edges = old.edges.filter((x) => x.via !== "If not met.Leads to");
  const d = diagram(old, { shape: "process", id: I("processes/delivery") });
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<b>Specify</b><br/><small>Backend Engineer</small>"]', '  n1["<b>Build</b><br/><small>Backend Engineer, Reviewer</small>"]', '  n2["<b>Release</b><br/><small>Reviewer</small>"]',
    '  n0 -->|"Reviewer"| n1', '  n1 -->|"Reviewer"| n2',
  ]);
  assert.equal(d.edges, 2);
});

test("a neighborhood draws one hop both ways, the smallest groups first", () => {
  const d = diagram(s, { shape: "neighborhood", id: I("concepts/invoice") });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Invoice", 8, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<small>«concept»</small><br/><b>Invoice</b>"]', '  n1["<small>«domain»</small><br/>Invoicing"]', '  n2["<small>«source»</small><br/>Local"]',
    '  n3["<small>«concept»</small><br/>Credit note"]', '  n4["<small>«feature»</small><br/>Billing run"]', '  n5["<small>«feature»</small><br/>Credit notes"]',
    '  n6["<small>«concept»</small><br/>Billing period"]', '  n7["<small>«concept»</small><br/>Customer"]', '  n8["<small>«concept»</small><br/>Invoice line"]',
    '  n0 -->|"domain"| n1', '  n0 -->|"source"| n2', '  n3 -->|"Relations.Concept"| n0', '  n4 -->|"concepts"| n0',
    '  n5 -->|"concepts"| n0', '  n0 -->|"Relations.Concept"| n6', '  n0 -->|"Relations.Concept"| n7', '  n0 -->|"Relations.Concept"| n8',
  ]);
  assert.deepEqual(d.nodes[0], { node: "n0", id: I("concepts/invoice"), title: "Invoice", type: "concept" });
  assert.deepEqual(d.links, [
    { from: "n0", to: "n1", label: "domain" }, { from: "n0", to: "n2", label: "source" },
    { from: "n3", to: "n0", label: "Relations.Concept" }, { from: "n4", to: "n0", label: "concepts" },
    { from: "n5", to: "n0", label: "concepts" }, { from: "n0", to: "n6", label: "Relations.Concept" },
    { from: "n0", to: "n7", label: "Relations.Concept" }, { from: "n0", to: "n8", label: "Relations.Concept" },
  ]);
  assert.ok(d.links.every((l) => l.from === "n0" || l.to === "n0"), "every link of the neighborhood touches the middle");
});

test("two rows drawing one edge are one arrow that says how many", () => {
  const d = diagram(s, { shape: "neighborhood", id: I("concepts/contract") });
  assert.ok(lines(d).includes('  n0 -->|"Relations.Concept ×2"| n4'), d.mermaid);
  assert.equal(d.nodes[4].id, I("concepts/customer"));
  assert.equal(d.edges, 9);
  assert.deepEqual(d.links.find((l) => l.to === "n4" || l.from === "n4"), { from: "n0", to: "n4", label: "Relations.Concept ×2" });
});

test("past the cap a neighborhood leaves out the largest group whole and names it", () => {
  const hub = withHub({ out: 60, into: 5 });
  const d = diagram(hub, { shape: "neighborhood", id: idAt(hub, "concepts/hub") });
  assert.deepEqual([d.nodes.length, d.edges, d.omitted], [7, 6, 60]);
  assert.deepEqual(lines(d).slice(-2), ['  more["+60: Relations.Concept"]', "  n0 -.- more"]);
  assert.ok(!d.nodes.some((n) => n.node === "more"));
  assert.equal(d.links.length, 6);
  assert.ok(!d.links.some((l) => l.from === "more" || l.to === "more"));
});

test("at the cap nothing is left out", () => {
  const hub = withHub({ out: DIAGRAM_CAP - 6, into: 5 });
  const d = diagram(hub, { shape: "neighborhood", id: idAt(hub, "concepts/hub") });
  assert.deepEqual([d.nodes.length, d.omitted], [DIAGRAM_CAP + 1, 0]);
  assert.ok(!d.mermaid.includes("more"));
});

test("a busy entity of the reference instance is drawn within the cap and says what it left out", () => {
  const i = instanceSnapshot();
  // Named by address, which reaches the profile whether or not the instance carries ids.
  const d = diagram(i, { shape: "neighborhood", id: "profiles/robert-blust" });
  assert.ok(d.nodes.length <= DIAGRAM_CAP + 1, `${d.nodes.length} nodes`);
  assert.ok(d.omitted > 0);
  assert.equal(lines(d).at(-1), "  n0 -.- more");
});

test("a self-reference is not drawn, an entity reached both ways is one node, and an odd title stays a label", () => {
  const loops = withLoops();
  const d = diagram(loops, { shape: "neighborhood", id: idAt(loops, "concepts/loop") });
  const odd = label(ODD);
  assert.equal(odd, "Partner #quot;A#quot; #lt;B#gt; #35;1 --#gt; C");
  assert.deepEqual(lines(d), [
    "flowchart LR", '  n0["<small>«concept»</small><br/><b>Loop</b>"]', `  n1["<small>«concept»</small><br/>${odd}"]`, '  n2["<small>«source»</small><br/>Local"]',
    '  n0 -->|"Relations.Concept"| n1', '  n0 -->|"source"| n2', '  n1 -->|"Relations.Concept"| n0',
  ]);
  assert.equal(d.nodes[1].title, ODD, "nodes carry the title as written, not escaped");
  const escapes = ["#quot;", "#lt;", "#gt;", "#35;", "#58;", "#59;", "#96;"];
  assert.ok(d.links.every((l) => escapes.every((esc) => !l.label.includes(esc))), "no link label carries a Mermaid escape");
  assert.equal(d.links.length, lines(d).filter((l) => l.includes("-->")).length);
});

test("every link's ends are drawn nodes, and the link count matches the arrow lines, over every shape", () => {
  for (const d of [
    diagram(s, { shape: "concepts" }),
    diagram(s, { shape: "process", id: I("processes/delivery") }),
    diagram(s, { shape: "neighborhood", id: I("concepts/invoice") }),
    diagram(s, { shape: "schema" }),
    diagram(s, { shape: "schema", type: "profile" }),
  ]) {
    const known = new Set(d.nodes.map((n) => n.node));
    for (const l of d.links) { assert.ok(known.has(l.from), l.from); assert.ok(known.has(l.to), l.to); }
    // A process's dashed arrow into the Stop node is an arrow line but never a link, since the
    // Stop node is no entity; every other arrow line, solid or dashed, is exactly one link.
    assert.equal(d.links.length, lines(d).filter((line) => /-->|\.\.>|--\*|-\.->/.test(line) && !line.endsWith(" stop")).length);
    // A concepts or process diagram holds one type throughout, which its caption already says,
    // so only a neighborhood's nodes carry a stereotype.
    if (d.shape !== "neighborhood") assert.ok(!d.mermaid.includes("«"), d.mermaid);
  }
});

test("the arguments each shape does not take, needs or cannot use are refused by name", () => {
  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood, schema, context, aggregate, flow, lifecycle, organization" });
  refused(() => diagram(s, { shape: "schema", id: "core/phase" }), "invalid_argument", { argument: "id", reason: "not taken by schema" });
  refused(() => diagram(s, { shape: "concepts", type: "phase" }), "invalid_argument", { argument: "type", reason: "not taken by concepts" });
  refused(() => diagram(s, { shape: "schema", domain: I("domains/pricing") }), "invalid_argument", { argument: "domain", reason: "not taken by schema" });
  refused(() => diagram(s, { shape: "schema", type: "nothing" }), "unknown_type");
  refused(() => diagram(s, { shape: "concepts", id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not taken by concepts" });
  refused(() => diagram(s, { shape: "process", id: I("processes/delivery"), domain: I("domains/pricing") }), "invalid_argument", { argument: "domain", reason: "not taken by process" });
  refused(() => diagram(s, { shape: "neighborhood" }), "invalid_argument", { argument: "id", reason: "needed by neighborhood" });
  refused(() => diagram(s, { shape: "process", id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a process" });
  refused(() => diagram(s, { shape: "concepts", domain: I("concepts/invoice") }), "invalid_argument", { argument: "domain", reason: "not a domain" });
  refused(() => diagram(s, { shape: "process", id: "nothing/here" }), "unknown_entity", { id: "nothing/here" });
  refused(() => diagram(instanceSnapshot(), { shape: "concepts" }), "unknown_type");
});

test("a diagram with nothing to draw, or more than it holds, is refused rather than cut", () => {
  const n = withNothingToDraw();
  refused(() => diagram(n, { shape: "concepts", domain: idAt(n, "domains/support") }), "cannot_draw", { shape: "concepts", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(n, { shape: "process", id: idAt(n, "processes/intake") }), "cannot_draw", { shape: "process", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(withHub({ out: 60, into: 5 }), { shape: "concepts" }), "cannot_draw", { shape: "concepts", reason: "too_large", nodes: 74, limit: DIAGRAM_CAP });
});

test("the too-large hint to name a domain is said only when none was given", () => {
  let whole;
  try { diagram(withHub({ out: 60, into: 5 }), { shape: "concepts" }); assert.fail("expected a refusal"); } catch (e) { whole = e; }
  assert.match(whole.message, /name a domain/);

  // A too-large fixture that is already domain-filtered is costly to build, so the message
  // builder is asserted on directly here, with the same shape, reason and node count as above.
  const filtered = cannot("concepts", "too_large", 74, { id: I("domains/pricing"), name: "Pricing" });
  assert.doesNotMatch(filtered.message, /name a domain/);
  assert.deepEqual(filtered.details, { shape: "concepts", reason: "too_large", nodes: 74, limit: DIAGRAM_CAP });
});

test("a concept outside the domain that belongs to no domain is drawn by its title alone", () => {
  const n = withNothingToDraw();
  const d = diagram(n, { shape: "concepts", domain: I("domains/pricing") });
  const stray = d.nodes.find((x) => x.id === idAt(n, "concepts/stray"));
  assert.ok(d.mermaid.split("\n").includes(`  class ${stray.node}["Stray"]`), d.mermaid);
});

test("the schemas draw every type, each declared reference with its multiplicity and each nesting, and leave out what every type declares", () => {
  const d = diagram(s, { shape: "schema" });
  assert.equal(d.title, null);
  assert.deepEqual(d.nodes.map((n) => n.title), s.schemas.map((x) => typeOfAddress(x.address)).sort());
  assert.deepEqual(d.nodes[0], { node: "n0", id: "core/achievement-kind", title: "achievement-kind", type: "schema",
    url: `https://github.com/companygraph/meta-model/blob/${COMMIT}/core/achievement-kind-schema.md` });
  // Every type but the source's own declares `source`, so it is said once and drawn by none,
  // though the source type is still a class.
  assert.deepEqual(d.everyType, [{ via: "source", to: "source", multiplicity: "1" }]);
  assert.ok(!d.links.some((l) => l.label.startsWith("source ")), d.mermaid);
  assert.ok(d.nodes.some((n) => n.title === "source"));
  const at = (t) => d.nodes.find((n) => n.title === t).node;
  // Solid where the reference must resolve, dashed where it may stay a fact or only qualifies.
  assert.ok(lines(d).includes(`  ${at("experience")} --> "0..*" ${at("skill")} : skills`), d.mermaid);
  assert.ok(lines(d).includes(`  ${at("experience")} ..> "0..1" ${at("identity")} : organization`), d.mermaid);
  assert.ok(lines(d).includes(`  ${at("profile")} ..> "0..*" ${at("proficiency-level")} : Skills.Level`), d.mermaid);
  assert.ok(lines(d).includes(`  ${at("feature")} --> "1..*" ${at("product")} : products`), d.mermaid);
  assert.ok(lines(d).includes(`  ${at("experience")} --* ${at("profile")} : nested-in`), d.mermaid);
  assert.deepEqual(d.links.find((l) => l.label === "nested-in"), { from: at("experience"), to: at("profile"), label: "nested-in" });
  assert.equal(d.edges, d.links.length);
  assert.ok(d.omitted >= s.schemas.length - 1, "every left-out source declaration is counted");
  assert.ok(!d.mermaid.includes("«"), d.mermaid);
});

test("a type narrows the schemas to itself, what it declares, what declares it and what it nests with", () => {
  const d = diagram(s, { shape: "schema", type: "phase" });
  assert.deepEqual([d.title, d.edges, d.omitted], ["phase", 10, 1]);
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["phase"]', '  class n1["process"]', '  class n2["seat"]', '  class n3["track"]',
    '  n0 --> "0..*" n3 : Activities.Track', '  n0 --> "0..*" n0 : If not met.Leads to', '  n0 --> "1" n2 : escalation-authority', '  n0 --> "1..*" n2 : executed-by',
    '  n0 --> "1..*" n2 : gate-approvers', '  n0 --> "0..1" n0 : gate-to', '  n0 --> "1" n2 : owner',
    '  n0 --> "0..*" n2 : supported-by', '  n1 --> "0..*" n0 : Phases.Phase', "  n0 --* n1 : nested-in",
  ]);
  assert.deepEqual(d.links.at(0), { from: "n0", to: "n3", label: "Activities.Track 0..*" });
  assert.deepEqual(d.links.at(-1), { from: "n0", to: "n1", label: "nested-in" });
});

test("the source type narrowed draws itself alone and counts every declaration to it as left out", () => {
  const d = diagram(s, { shape: "schema", type: "source" });
  assert.deepEqual([d.nodes.length, d.edges, d.omitted], [1, 0, s.schemas.length - 1]);
});

test("a schema node links nowhere where the repository or the commit is not known", () => {
  const d = diagram({ ...s, commit: null }, { shape: "schema", type: "phase" });
  assert.ok(d.nodes.every((n) => n.url === null));
});

test("the too-large hint for the schemas is to name a type, said only when none was given", () => {
  assert.match(cannot("schema", "too_large", 60).message, /name a type to draw part of it/);
  assert.doesNotMatch(cannot("schema", "too_large", 60, "phase").message, /name a type/);
});

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
    '  n2 <-->|"shared kernel"| n0',
    '  n0 -->|"U → D · customer/supplier"| n3',
  ]);
  assert.deepEqual(ids(d), [["n0", CONTEXT_ID], ["n1", K.catalog], ["n2", K.invoicing], ["n3", K.ordering]]);
  assert.deepEqual(d.nodes.map((n) => n.type), ["bounded-context", "bounded-context", "bounded-context", "bounded-context"]);
  assert.deepEqual(d.links, [
    { from: "n1", to: "n0", label: "U → D · conformist" },
    { from: "n2", to: "n0", label: "shared kernel" },
    { from: "n0", to: "n3", label: "U → D · customer/supplier" },
  ]);
});

test("a symmetric pattern named from both sides is one arrow, from either side's map", () => {
  const d = diagram(B, { shape: "context", id: K.invoicing });
  assert.deepEqual([d.title, d.edges], ["Invoicing", 2]);
  assert.deepEqual(lines(d).slice(1), [
    '  n0["<small>«bounded-context» · core</small><br/><b>Invoicing</b>"]',
    '  n1["<small>«bounded-context» · core</small><br/>Quoting"]',
    '  n0 <-->|"shared kernel"| n1',
  ]);
});

test("a symmetric arrow reads the same whichever row comes first", () => {
  const flipped = structuredClone(B);
  flipped.edges.reverse();
  for (const id of [K.invoicing, CONTEXT_ID]) {
    const [x, y] = [diagram(B, { shape: "context", id }), diagram(flipped, { shape: "context", id })];
    assert.deepEqual([y.mermaid, y.links], [x.mermaid, x.links]);
  }
});

test("two rows that disagree each keep their own arrow", () => {
  const d = diagram(withContexts({ disagree: true }), { shape: "context", id: CONTEXT_ID });
  assert.equal(d.edges, 5);
  assert.deepEqual(lines(d).slice(5), [
    '  n1 -->|"U → D · conformist"| n0',
    '  n1 <-->|"partnership"| n0',
    '  n2 <-->|"shared kernel"| n0',
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
  const rootless = structuredClone(B);
  rootless.edges = rootless.edges.filter((x) => !(x.via === "root" && x.from === K.priceList));
  refused(() => diagram(rootless, { shape: "aggregate", id: K.priceList }), "cannot_draw", { shape: "aggregate", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(B, { shape: "aggregate", id: K.money }), "invalid_argument", { argument: "id", reason: "not an aggregate or a bounded-context" });
  refused(() => diagram(s, { shape: "aggregate", id: "nothing/here" }), "unknown_type");
});

// The flow and the lifecycle are read from an aggregate's handled commands and state transitions.
// `edited` is the context fixture with one aggregate's tables and the edges its commands draw replaced.
const edited = (aggregateId, { commands, transitions, edges }) => {
  const m = structuredClone(B);
  const a = m.entities.find((x) => x.id === aggregateId);
  const put = (heading, rows) => { if (rows) for (const t of a.sections.find((x) => x.heading === heading).tables) t.rows = rows; };
  put("Handled commands", commands);
  put("State transitions", transitions);
  for (const sec of a.sections) if (sec.table) sec.table = sec.tables[0];
  if (edges) m.edges = m.edges.filter((x) => !(x.via === "Handled commands.Emits" && x.from === aggregateId)).concat(edges);
  return m;
};
const emits = (from, to, command, when = "") => ({ from, to, via: "Handled commands.Emits", attrs: { Command: command, When: when, Description: "" } });

test("a flow draws each command sent to the aggregate and the events it emits, a command of several rows an alt", () => {
  const d = diagram(B, { shape: "flow", id: K.quote });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted], ["flow", "Quote", 2, 0]);
  assert.equal(d.mermaid, [
    "sequenceDiagram", "  participant caller as Caller", "  participant n0 as Quote",
    "  caller->>n0: Send quote", "  n0--)caller: Quote sent",
    "  caller->>n0: Accept quote", "  alt the customer signs before it expires", "    n0--)caller: Quote accepted",
    "  else it has expired (INV-T1)", "    Note over n0: —", "  end",
  ].join("\n"));
  assert.deepEqual(ids(d), [["n0", K.quote], ["n1", K.sent], ["n2", K.accepted]]);
  assert.deepEqual(d.nodes.map((n) => n.title), ["Quote", "Quote sent", "Quote accepted"]);
  assert.deepEqual(d.links, [{ from: "n0", to: "n1", label: "Send quote" }, { from: "n0", to: "n2", label: "Accept quote · the customer signs before it expires" }]);
});

test("a context's flow draws its aggregates in name order, one with a command and no answer included", () => {
  const d = diagram(B, { shape: "flow", id: CONTEXT_ID });
  assert.deepEqual(lines(d).slice(0, 6), ["sequenceDiagram", "  participant caller as Caller", "  participant n0 as Price list", "  participant n1 as Quote", "  caller->>n0: Publish price list", "  caller->>n1: Send quote"]);
  assert.deepEqual(ids(d).slice(0, 2), [["n0", K.priceList], ["n1", K.quote]]);
  assert.equal(d.links.length, 2);
});

test("a command whose rows all name no event draws its message and empty branches, never a refusal", () => {
  const m = edited(K.quote, { commands: [["Close", "", "it is paid", ""], ["Close", "", "it is void", ""]], edges: [] });
  const d = diagram(m, { shape: "flow", id: K.quote });
  assert.equal(d.mermaid, ["sequenceDiagram", "  participant caller as Caller", "  participant n0 as Quote", "  caller->>n0: Close",
    "  alt it is paid", "    Note over n0: —", "  else it is void", "    Note over n0: —", "  end"].join("\n"));
  assert.deepEqual([d.links, d.nodes.length, d.edges], [[], 1, 0]);
});

test("one event two commands emit is two links, each labeled with its own command", () => {
  const m = edited(K.quote, {
    commands: [["Send quote", "Quote sent", "", ""], ["Resend quote", "Quote sent", "", ""]],
    edges: [emits(K.quote, K.sent, "Send quote"), emits(K.quote, K.sent, "Resend quote")],
  });
  const d = diagram(m, { shape: "flow", id: K.quote });
  assert.deepEqual(d.links, [{ from: "n0", to: "n1", label: "Send quote" }, { from: "n0", to: "n1", label: "Resend quote" }]);
  assert.equal(d.nodes.length, 2);
});

test("one command naming the same event under two Whens draws two messages in its alt and two labeled links", () => {
  const m = edited(K.quote, {
    commands: [["Accept quote", "Quote accepted", "by the customer", ""], ["Accept quote", "Quote accepted", "by the agent", ""]],
    edges: [emits(K.quote, K.accepted, "Accept quote", "by the customer"), emits(K.quote, K.accepted, "Accept quote", "by the agent")],
  });
  const d = diagram(m, { shape: "flow", id: K.quote });
  assert.deepEqual(lines(d).slice(3), ["  caller->>n0: Accept quote", "  alt by the customer", "    n0--)caller: Quote accepted", "  else by the agent", "    n0--)caller: Quote accepted", "  end"]);
  assert.deepEqual(d.links, [{ from: "n0", to: "n1", label: "Accept quote · by the customer" }, { from: "n0", to: "n1", label: "Accept quote · by the agent" }]);
  assert.deepEqual([d.nodes.length, d.edges], [2, 2]);
});

test("a flow totalling exactly the cap is drawn", () => {
  const commands = Array.from({ length: DIAGRAM_CAP - 2 }, (_, i) => [`Command ${i}`, "", "", ""]);
  const d = diagram(edited(K.quote, { commands, edges: [] }), { shape: "flow", id: K.quote });
  assert.deepEqual([d.shape, d.nodes.length], ["flow", 1]);
});

test("a flow or a lifecycle past the cap is refused as too large", () => {
  // A flow counts the caller, each participant and each message, so fifty commands and one aggregate make fifty-two.
  const commands = Array.from({ length: DIAGRAM_CAP }, (_, i) => [`Command ${i}`, "", "", ""]);
  refused(() => diagram(edited(K.quote, { commands, edges: [] }), { shape: "flow", id: K.quote }), "cannot_draw", { shape: "flow", reason: "too_large", nodes: DIAGRAM_CAP + 2, limit: DIAGRAM_CAP });
  const transitions = Array.from({ length: DIAGRAM_CAP + 1 }, (_, i) => ["", `Step ${i}`, `State ${i}`]);
  refused(() => diagram(edited(K.quote, { transitions }), { shape: "lifecycle", id: K.quote }), "cannot_draw", { shape: "lifecycle", reason: "too_large", nodes: DIAGRAM_CAP + 1, limit: DIAGRAM_CAP });
});

test("a lifecycle draws the states, a blank From as the start and a state no step leaves as an end", () => {
  const d = diagram(B, { shape: "lifecycle", id: K.quote });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.links, d.nodes], ["lifecycle", "Quote", 3, 0, [], [{ node: "n0", id: K.quote, title: "Quote", type: "aggregate" }]]);
  assert.equal(d.mermaid, [
    "stateDiagram-v2", '  state "Sent" as s0', '  state "Accepted" as s1', '  state "Expired" as s2',
    "  [*] --> s0 : Send quote", "  s0 --> s1 : Accept quote", "  s0 --> s2", "  s1 --> [*]", "  s2 --> [*]",
  ].join("\n"));
  assert.deepEqual(d.transitions, [
    { aggregate: "Quote", from: null, to: "Sent", command: "Send quote" },
    { aggregate: "Quote", from: "Sent", to: "Accepted", command: "Accept quote" },
    { aggregate: "Quote", from: "Sent", to: "Expired", command: null },
  ]);
});

test("a context's lifecycle wraps each aggregate's states in a composite state under its name", () => {
  const d = diagram(B, { shape: "lifecycle", id: CONTEXT_ID });
  const one = lines(diagram(B, { shape: "lifecycle", id: K.quote })).slice(1).map((l) => `  ${l}`);
  assert.deepEqual(lines(d), ["stateDiagram-v2", '  state "Quote" as n0 {', ...one, "  }"]);
});

test("a state named in two aggregates of one context is two states, one in each composite", () => {
  const m = structuredClone(B);
  const a = m.entities.find((x) => x.id === K.priceList);
  a.sections.push({ heading: "State transitions", text: "", tables: [{ caption: null, columns: ["From", "Command", "To"], rows: [["", "Publish price list", "Sent"]] }] });
  a.sections.at(-1).table = a.sections.at(-1).tables[0];
  const d = diagram(m, { shape: "lifecycle", id: CONTEXT_ID });
  const states = lines(d).filter((l) => l.includes('"Sent"'));
  assert.deepEqual(states, ['    state "Sent" as s0', '    state "Sent" as s1']);
  // Each "Sent" sits inside its own composite: between its opening line and the next closing brace.
  const all = lines(d);
  const open = all.map((l, i) => (/^  state ".*" as n\d+ \{$/.test(l) ? i : -1)).filter((i) => i >= 0);
  assert.equal(open.length, 2);
  open.forEach((from, k) => {
    const to = all.indexOf("  }", from);
    assert.deepEqual(all.slice(from, to).filter((l) => l.includes('"Sent"')), [`    state "Sent" as s${k}`]);
  });
  assert.deepEqual(d.nodes.map((n) => n.node), ["n0", "n1"]);
  assert.equal(d.transitions.length, 4);
});

test("nothing to draw, or another type, is refused by the flow and the lifecycle", () => {
  refused(() => diagram(B, { shape: "flow", id: K.archive }), "cannot_draw", { shape: "flow", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(B, { shape: "lifecycle", id: K.priceList }), "cannot_draw", { shape: "lifecycle", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  for (const shape of ["flow", "lifecycle"]) {
    refused(() => diagram(B, { shape, id: K.money }), "invalid_argument", { argument: "id", reason: "not an aggregate or a bounded-context" });
    refused(() => diagram(B, { shape }), "invalid_argument", { argument: "id", reason: `needed by ${shape}` });
    refused(() => diagram(s, { shape, id: "nothing/here" }), "unknown_type");
  }
});

test("a When, a command and a state holding a quote, a colon and a semicolon are escaped", () => {
  const odd = 'a "q": b; c';
  const m = edited(K.quote, {
    commands: [[odd, "Quote sent", odd, ""], [odd, "Quote accepted", "or not", ""]],
    transitions: [[odd, odd, odd]],
    edges: [emits(K.quote, K.sent, odd, odd), emits(K.quote, K.accepted, odd, "or not")],
  });
  const flow = diagram(m, { shape: "flow", id: K.quote }).mermaid;
  const life = diagram(m, { shape: "lifecycle", id: K.quote }).mermaid;
  const esc = "a #quot;q#quot;#58; b#59; c";
  assert.ok(flow.includes(`caller->>n0: ${esc}`) && flow.includes(`alt ${esc}`), flow);
  // A state's words sit inside quotes, where only the quote is escaped, as for every quoted label.
  assert.ok(life.includes(`state "a #quot;q#quot;: b; c" as s0`) && life.includes(`s0 --> s0 : ${esc}`), life);
  assert.ok(!/[^#]"q"|: b;/.test(flow), flow);
});

// The organization: the example's Beacon Systems holds four units in the line, a team outside it,
// a staff person, a staff unit with only an opening, an opening for two and an open Lead beside a
// lead who stays. Fixtures edit the example's groups in place: the shape reads entities alone.
const today = new Date().toISOString().slice(0, 10);
const G = (name) => s.entities.find((e) => e.type === "group" && e.name === name).id;
// The example with its groups changed: `edit` takes each group by name and may change it in place,
// and `add` brings new entities, a group or a profile, in the shape the parser gives one.
const org = (edit = {}, add = []) => {
  const m = structuredClone(s);
  for (const e of m.entities) if (e.type === "group" && edit[e.name]) edit[e.name](e);
  m.entities.push(...add);
  return m;
};
// A section table as the parser gives one, under both names a section carries it by.
const table = (heading, columns, rows) => { const t = { columns, rows }; return { heading, tables: [t], table: t }; };
const group = (id, name, fields, sections = []) => ({ id, type: "group", name, fields: { id, source: "Local", ...fields }, sections });
const setRows = (e, heading, rows) => { const sec = e.sections.find((x) => x.heading === heading); sec.tables[0].rows = rows; sec.table = sec.tables[0]; };
const BEACON = [
  "flowchart TB",
  '  subgraph g0 ["Management"]',
  '    n0["fak:fa-human <b>Ines Marchetti</b><br/><small>Managing Director</small>"]:::lead',
  '    n1["fak:fa-human <b>Jonas Whitcombe</b><br/><small>Executive Assistant</small>"]',
  "    n0 -.- n1",
  "  end",
  '  subgraph g1 ["Legal"]',
  '    n2["<b>Legal Counsel</b>"]:::open',
  "  end",
  '  subgraph g2 ["Engineering"]',
  '    n3["fak:fa-human <b>Mira Halvorsen</b><br/><small>Engineering Lead</small>"]:::lead',
  '    n4["<b>Backend Engineer</b><br/><small>× 2</small>"]:::open',
  "    n3 ~~~ n4",
  "  end",
  '  subgraph g3 ["Product"]',
  '    n5["fak:fa-human <b>Tomas Reyes</b><br/><small>Head of Product</small>"]:::lead',
  '    n6["<b>Head of Product</b>"]:::open',
  "  end",
  "  n0 -.- n2",
  "  n0 --> n3",
  "  n0 --> n5",
  "  classDef lead stroke-width:2px",
  "  classDef open stroke-dasharray:5 4",
];

test("the company is its units in the line, in rank order, a box per person and per opening, the leads joined", () => {
  const d = diagram(s, { shape: "organization" });
  assert.deepEqual([d.shape, d.title, d.edges, d.omitted, d.model.commit], ["organization", null, 4, 1, COMMIT]);
  assert.deepEqual(lines(d), BEACON);
  assert.deepEqual(d.nodes.map((n) => [n.node, n.title, n.type]), [
    ["g0", "Management", "group"], ["n0", "Ines Marchetti", "profile"], ["n1", "Jonas Whitcombe", "profile"],
    ["g1", "Legal", "group"], ["n2", "Legal Counsel", "job"],
    ["g2", "Engineering", "group"], ["n3", "Mira Halvorsen", "profile"], ["n4", "Backend Engineer", "job"],
    ["g3", "Product", "group"], ["n5", "Tomas Reyes", "profile"], ["n6", "Head of Product", "job"],
  ]);
  assert.deepEqual(d.nodes[0], { node: "g0", id: G("Management"), title: "Management", type: "group" });
  assert.deepEqual(d.links, [["n0", "n1"], ["n0", "n2"], ["n0", "n3"], ["n0", "n5"]].map(([from, to]) => ({ from, to, label: "" })));
});

test("a team named by its id draws its people, its agents in a frame of their own below them", () => {
  const d = diagram(s, { shape: "organization", id: G("Billing Run Team") });
  assert.deepEqual([d.title, d.edges, d.omitted, d.links], ["Billing Run Team", 0, 0, []]);
  assert.deepEqual(lines(d), [
    "flowchart TB",
    '  subgraph g0 ["Billing Run Team"]',
    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Backend Engineer</small>"]:::lead',
    '    subgraph g0a [" "]',
    '      n1["fak:fa-agent <b>AI Agent</b>"]',
    "    end",
    "    n0 ~~~ g0a",
    "  end",
    "  class g0a agents",
    "  classDef lead stroke-width:2px",
    "  classDef agents stroke-dasharray:2 3",
  ]);
});

test("a unit named by its id draws every unit under it, however deep, and not the one above", () => {
  const PLATFORM = "01a0ffff-0000-7000-8000-0000000000d1";
  const m = org({}, [group(PLATFORM, "Platform", { kind: "Department", rank: "25", "part-of": "Engineering" },
    [table("Openings", ["Job", "Place", "Count", "Since"], [["Backend Engineer", "Lead", "", ""]])])]);
  const d = diagram(m, { shape: "organization", id: G("Engineering") });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Engineering", 1, 0]);
  assert.deepEqual(lines(d), [
    "flowchart TB",
    '  subgraph g0 ["Engineering"]',
    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Engineering Lead</small>"]:::lead',
    '    n1["<b>Backend Engineer</b><br/><small>× 2</small>"]:::open',
    "    n0 ~~~ n1",
    "  end",
    '  subgraph g1 ["Platform"]',
    '    n2["<b>Backend Engineer</b>"]:::open',
    "  end",
    "  n0 --> n2",
    "  classDef lead stroke-width:2px",
    "  classDef open stroke-dasharray:5 4",
  ]);
  // One job open in two units is two boxes, each naming the job.
  assert.deepEqual([d.nodes[2].id, d.nodes[4].id], [d.nodes[2].id, d.nodes[2].id]);
  // The whole company draws Platform too, under Engineering's lead, after it in rank order.
  assert.ok(lines(diagram(m, { shape: "organization" })).includes("  n3 --> n5"));
});

test("people stand Lead, Deputy, Member, Staff; agents side by side; a unit with no lead is reached at its frame", () => {
  const AGENT = "01a0ffff-0000-7000-8000-0000000000d2", OPS = "01a0ffff-0000-7000-8000-0000000000d3";
  const agent = { id: AGENT, type: "profile", name: "Review Agent", fields: { id: AGENT, source: "Local", nature: "agent" }, sections: [] };
  const m = org({
    "Billing Run Team": (e) => setRows(e, "People", [["AI Agent", "", "Member"], ["Jonas Whitcombe", "", "Member"], ["Review Agent", "", "Member"], ["Tomas Reyes", "Head of Product", "Deputy"], ["Mira Halvorsen", "Backend Engineer", "Lead"]]),
  }, [agent, group(OPS, "Operations", { kind: "Department", rank: "40", "part-of": "Management" })]);
  const team = lines(diagram(m, { shape: "organization", id: G("Billing Run Team") }));
  assert.deepEqual(team.slice(1, 13), [
    '  subgraph g0 ["Billing Run Team"]',
    '    n0["fak:fa-human <b>Mira Halvorsen</b><br/><small>Backend Engineer</small>"]:::lead',
    '    n1["fak:fa-human <b>Tomas Reyes</b><br/><small>Head of Product</small>"]',
    '    n2["fak:fa-human <b>Jonas Whitcombe</b>"]',
    '    subgraph g0a [" "]',
    "      direction LR",
    '      n3["fak:fa-agent <b>AI Agent</b>"]',
    '      n4["fak:fa-agent <b>Review Agent</b>"]',
    "    end",
    "    n0 ~~~ n1",
    "    n0 ~~~ n2",
    "    n2 ~~~ g0a",
  ]);
  // Operations has no one in it and nothing open: it draws no box, and the arrow ends at its frame.
  assert.ok(lines(diagram(m, { shape: "organization" })).includes("  n0 --> g4"));
});

test("a model whose only groups are teams draws them for the company, and a group that has ended is left out", () => {
  const teams = org({ Management: (e) => { e.fields.kind = "Team"; }, Legal: (e) => { e.fields.kind = "Team"; }, Engineering: (e) => { e.fields.kind = "Team"; }, Product: (e) => { e.fields.kind = "Team"; } });
  const d = diagram(teams, { shape: "organization" });
  assert.deepEqual([d.omitted, d.nodes.filter((n) => n.type === "group").map((n) => n.title)], [0, ["Management", "Legal", "Engineering", "Product", "Billing Run Team"]]);
  // A person in two teams is a box in each, since every box is a node of its own.
  assert.equal(d.nodes.filter((n) => n.title === "Mira Halvorsen").length, 2);
  const ended = org({ Product: (e) => { e.fields.end = "2020-01"; }, Legal: (e) => { e.fields.end = today; } });
  const titles = diagram(ended, { shape: "organization" }).nodes.filter((n) => n.type === "group").map((n) => n.title);
  assert.deepEqual(titles, ["Management", "Legal", "Engineering"]);
  refused(() => diagram(ended, { shape: "organization", id: G("Product") }), "cannot_draw", { shape: "organization", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
});

test("the organization refuses what it cannot draw, and a title is never read as a mark", () => {
  const crowd = org({ Engineering: (e) => setRows(e, "Openings", Array.from({ length: DIAGRAM_CAP }, () => ["Backend Engineer", "Member", "", ""])) });
  refused(() => diagram(crowd, { shape: "organization" }), "cannot_draw", { shape: "organization", reason: "too_large", nodes: DIAGRAM_CAP + 6, limit: DIAGRAM_CAP });
  let whole;
  try { diagram(crowd, { shape: "organization" }); } catch (e) { whole = e; }
  assert.match(whole.message, /name a group to draw part of it/);
  refused(() => diagram(s, { shape: "organization", id: I("concepts/invoice") }), "invalid_argument", { argument: "id", reason: "not a group" });
  refused(() => diagram(instanceSnapshot(), { shape: "organization" }), "unknown_type");
  const odd = diagram(org({ Legal: (e) => { e.name = "Ops fas:fa-x"; } }), { shape: "organization" });
  assert.ok(lines(odd).includes('  subgraph g1 ["Ops fas#58;fa-x"]'), odd.mermaid);
  assert.equal(label("sofa:fa-bed and a: colon"), "sofa#58;fa-bed and a: colon");
});

test("a part-of loop the checks refuse, or a rank that is no number, still draws and never hangs", () => {
  const m = org({ Management: (e) => { e.fields["part-of"] = "Product"; e.fields.rank = "first"; } });
  const d = diagram(m, { shape: "organization", id: G("Engineering") });
  assert.deepEqual(d.nodes.filter((n) => n.type === "group").map((n) => n.title), ["Engineering"]);
  const whole = diagram(m, { shape: "organization" });
  // Management has no rank it can be ordered by, so it comes after the ranked units.
  assert.deepEqual(whole.nodes.filter((n) => n.type === "group").map((n) => n.title), ["Legal", "Engineering", "Product", "Management"]);
  const top = diagram(m, { shape: "organization", id: G("Management") });
  assert.deepEqual(top.nodes.filter((n) => n.type === "group").map((n) => n.title).sort(), ["Engineering", "Legal", "Management", "Product"]);
});
