// The diagram tool's pictures, over the worked example and over fixtures built for what the
// example does not hold. A shape's whole source is compared, because a client draws exactly what
// is sent and a line out of place is a different picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diagram, label, plain, cannot, DIAGRAM_CAP } from "../lib/diagram.mjs";
import { ModelError } from "../lib/errors.mjs";
import { exampleSnapshot, instanceSnapshot, withHub, withLoops, withPunctuation, withNothingToDraw, ODD, COMMIT } from "./helpers.mjs";

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
  assert.equal(label("`bold`"), "#96;bold#96;");
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
  assert.equal(d.links.length, 11);
  assert.deepEqual(d.links[0], { from: "n1", to: "n3", label: "one, signing customer" });
  assert.deepEqual(d.links, [
    { from: "n1", to: "n3", label: "one, signing customer" }, { from: "n1", to: "n3", label: "maybe one, paying customer" },
    { from: "n1", to: "n6", label: "one to many, terms" }, { from: "n2", to: "n4", label: "one, corrected invoice" },
    { from: "n2", to: "n5", label: "one to many, lines" }, { from: "n4", to: "n0", label: "one" },
    { from: "n4", to: "n3", label: "one, billed customer" }, { from: "n4", to: "n5", label: "one to many, lines" },
    { from: "n5", to: "n6", label: "one, rule" }, { from: "n5", to: "n7", label: "many, usage read" },
    { from: "n7", to: "n1", label: "one" },
  ]);
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
  assert.equal(d.links.length, 7);
});

test("an As cell's own colon and semicolon are escaped, since Mermaid ends an unquoted association label at either", () => {
  const d = diagram(withPunctuation(), { shape: "concepts" });
  const bond = d.nodes.find((n) => n.title === "Bond").node;
  const glue = d.nodes.find((n) => n.title === "Glue").node;
  assert.ok(lines(d).includes(`  ${bond} --> ${glue} : one, a#58; b#59; c`), d.mermaid);
  assert.deepEqual(d.links.find((l) => l.from === bond && l.to === glue), { from: bond, to: glue, label: "one, a: b; c" });
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
  const d = diagram(s, { shape: "process", id: "processes/delivery" });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Delivery", 2, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<b>Specify</b><br/><small>Backend Engineer</small>"]', '  n1["<b>Build</b><br/><small>Backend Engineer, Reviewer</small>"]', '  n2["<b>Release</b><br/><small>Reviewer</small>"]',
    '  n0 -->|"Reviewer"| n1', '  n1 -->|"Reviewer"| n2',
  ]);
  assert.deepEqual(ids(d), [["n0", "processes/delivery/phases/specify"], ["n1", "processes/delivery/phases/build"], ["n2", "processes/delivery/phases/release"]]);
  assert.deepEqual(d.links, [{ from: "n0", to: "n1", label: "Reviewer" }, { from: "n1", to: "n2", label: "Reviewer" }]);
});

test("a neighborhood draws one hop both ways, the smallest groups first", () => {
  const d = diagram(s, { shape: "neighborhood", id: "concepts/invoice" });
  assert.deepEqual([d.title, d.edges, d.omitted], ["Invoice", 8, 0]);
  assert.deepEqual(lines(d), [
    "flowchart LR",
    '  n0["<small>«concept»</small><br/><b>Invoice</b>"]', '  n1["<small>«domain»</small><br/>Invoicing"]', '  n2["<small>«source»</small><br/>Local"]',
    '  n3["<small>«concept»</small><br/>Credit note"]', '  n4["<small>«feature»</small><br/>Billing run"]', '  n5["<small>«feature»</small><br/>Credit notes"]',
    '  n6["<small>«concept»</small><br/>Billing period"]', '  n7["<small>«concept»</small><br/>Customer"]', '  n8["<small>«concept»</small><br/>Invoice line"]',
    '  n0 -->|"domain"| n1', '  n0 -->|"source"| n2', '  n3 -->|"Relations.Concept"| n0', '  n4 -->|"concepts"| n0',
    '  n5 -->|"concepts"| n0', '  n0 -->|"Relations.Concept"| n6', '  n0 -->|"Relations.Concept"| n7', '  n0 -->|"Relations.Concept"| n8',
  ]);
  assert.deepEqual(d.nodes[0], { node: "n0", id: "concepts/invoice", title: "Invoice", type: "concept" });
  assert.deepEqual(d.links, [
    { from: "n0", to: "n1", label: "domain" }, { from: "n0", to: "n2", label: "source" },
    { from: "n3", to: "n0", label: "Relations.Concept" }, { from: "n4", to: "n0", label: "concepts" },
    { from: "n5", to: "n0", label: "concepts" }, { from: "n0", to: "n6", label: "Relations.Concept" },
    { from: "n0", to: "n7", label: "Relations.Concept" }, { from: "n0", to: "n8", label: "Relations.Concept" },
  ]);
  assert.ok(d.links.every((l) => l.from === "n0" || l.to === "n0"), "every link of the neighborhood touches the middle");
});

test("two rows drawing one edge are one arrow that says how many", () => {
  const d = diagram(s, { shape: "neighborhood", id: "concepts/contract" });
  assert.ok(lines(d).includes('  n0 -->|"Relations.Concept ×2"| n4'), d.mermaid);
  assert.equal(d.nodes[4].id, "concepts/customer");
  assert.equal(d.edges, 9);
  assert.deepEqual(d.links.find((l) => l.to === "n4" || l.from === "n4"), { from: "n0", to: "n4", label: "Relations.Concept ×2" });
});

test("past the cap a neighborhood leaves out the largest group whole and names it", () => {
  const d = diagram(withHub({ out: 60, into: 5 }), { shape: "neighborhood", id: "concepts/hub" });
  assert.deepEqual([d.nodes.length, d.edges, d.omitted], [7, 6, 60]);
  assert.deepEqual(lines(d).slice(-2), ['  more["+60: Relations.Concept"]', "  n0 -.- more"]);
  assert.ok(!d.nodes.some((n) => n.node === "more"));
  assert.equal(d.links.length, 6);
  assert.ok(!d.links.some((l) => l.from === "more" || l.to === "more"));
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
    diagram(s, { shape: "process", id: "processes/delivery" }),
    diagram(s, { shape: "neighborhood", id: "concepts/invoice" }),
    diagram(s, { shape: "schema" }),
    diagram(s, { shape: "schema", type: "profile" }),
  ]) {
    const known = new Set(d.nodes.map((n) => n.node));
    for (const l of d.links) { assert.ok(known.has(l.from), l.from); assert.ok(known.has(l.to), l.to); }
    assert.equal(d.links.length, lines(d).filter((line) => /-->|\.\.>|--\*/.test(line)).length);
    // A concepts or process diagram holds one type throughout, which its caption already says,
    // so only a neighborhood's nodes carry a stereotype.
    if (d.shape !== "neighborhood") assert.ok(!d.mermaid.includes("«"), d.mermaid);
  }
});

test("the arguments each shape does not take, needs or cannot use are refused by name", () => {
  refused(() => diagram(s, { shape: "graph" }), "invalid_argument", { argument: "shape", reason: "one of concepts, process, neighborhood, schema" });
  refused(() => diagram(s, { shape: "schema", id: "core/phase" }), "invalid_argument", { argument: "id", reason: "not taken by schema" });
  refused(() => diagram(s, { shape: "concepts", type: "phase" }), "invalid_argument", { argument: "type", reason: "not taken by concepts" });
  refused(() => diagram(s, { shape: "schema", domain: "domains/pricing" }), "invalid_argument", { argument: "domain", reason: "not taken by schema" });
  refused(() => diagram(s, { shape: "schema", type: "nothing" }), "unknown_type");
  refused(() => diagram(s, { shape: "concepts", id: "concepts/invoice" }), "invalid_argument", { argument: "id", reason: "not taken by concepts" });
  refused(() => diagram(s, { shape: "process", id: "processes/delivery", domain: "domains/pricing" }), "invalid_argument", { argument: "domain", reason: "not taken by process" });
  refused(() => diagram(s, { shape: "neighborhood" }), "invalid_argument", { argument: "id", reason: "needed by neighborhood" });
  refused(() => diagram(s, { shape: "process", id: "concepts/invoice" }), "invalid_argument", { argument: "id", reason: "not a process" });
  refused(() => diagram(s, { shape: "concepts", domain: "concepts/invoice" }), "invalid_argument", { argument: "domain", reason: "not a domain" });
  refused(() => diagram(s, { shape: "process", id: "nothing/here" }), "unknown_entity", { id: "nothing/here" });
  refused(() => diagram(instanceSnapshot(), { shape: "concepts" }), "unknown_type");
});

test("a diagram with nothing to draw, or more than it holds, is refused rather than cut", () => {
  const n = withNothingToDraw();
  refused(() => diagram(n, { shape: "concepts", domain: "domains/support" }), "cannot_draw", { shape: "concepts", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(n, { shape: "process", id: "processes/intake" }), "cannot_draw", { shape: "process", reason: "empty", nodes: 0, limit: DIAGRAM_CAP });
  refused(() => diagram(withHub({ out: 60, into: 5 }), { shape: "concepts" }), "cannot_draw", { shape: "concepts", reason: "too_large", nodes: 74, limit: DIAGRAM_CAP });
});

test("the too-large hint to name a domain is said only when none was given", () => {
  let whole;
  try { diagram(withHub({ out: 60, into: 5 }), { shape: "concepts" }); assert.fail("expected a refusal"); } catch (e) { whole = e; }
  assert.match(whole.message, /name a domain/);

  // A too-large fixture that is already domain-filtered is costly to build, so the message
  // builder is asserted on directly here, with the same shape, reason and node count as above.
  const filtered = cannot("concepts", "too_large", 74, { id: "domains/pricing", name: "Pricing" });
  assert.doesNotMatch(filtered.message, /name a domain/);
  assert.deepEqual(filtered.details, { shape: "concepts", reason: "too_large", nodes: 74, limit: DIAGRAM_CAP });
});

test("a concept outside the domain that belongs to no domain is drawn by its title alone", () => {
  const d = diagram(withNothingToDraw(), { shape: "concepts", domain: "domains/pricing" });
  const stray = d.nodes.find((n) => n.id === "concepts/stray");
  assert.ok(d.mermaid.split("\n").includes(`  class ${stray.node}["Stray"]`), d.mermaid);
});

test("the schemas draw every type, each declared reference with its multiplicity and each nesting, and leave out what every type declares", () => {
  const d = diagram(s, { shape: "schema" });
  assert.equal(d.title, null);
  assert.deepEqual(d.nodes.map((n) => n.title), s.schemas.map((x) => x.id.slice("core/".length)).sort());
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
  assert.deepEqual([d.title, d.edges, d.omitted], ["phase", 9, 1]);
  assert.deepEqual(lines(d), [
    "classDiagram",
    '  class n0["phase"]', '  class n1["process"]', '  class n2["role"]', '  class n3["track"]',
    '  n0 --> "0..*" n3 : Activities.Track', '  n0 --> "1" n2 : escalation-authority', '  n0 --> "1..*" n2 : executed-by',
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
