// The diagram tool's pictures, over the worked example and over fixtures built for what the
// example does not hold. A shape's whole source is compared, because a client draws exactly what
// is sent and a line out of place is a different picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diagram, label, DIAGRAM_CAP } from "../lib/diagram.mjs";
import { ModelError } from "../lib/errors.mjs";
import { exampleSnapshot, instanceSnapshot, withHub, withLoops, withNothingToDraw, ODD, COMMIT } from "./helpers.mjs";

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
