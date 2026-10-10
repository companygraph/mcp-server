// An instance that takes the landscape pack (meta-model 0.89.0) is served in full: the pack's
// types are listed and described, a system's two tables reach a reader with their qualifier
// columns as attributes of the row's edge (R16), the edge a system draws to a feature is read
// from the feature's side, and the pictures that enumerate types or packs hold a third pack.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listTypes, describeSchema, getEntityById, listReferences } from "../lib/model.mjs";
import { diagram } from "../lib/diagram.mjs";
import { exampleSnapshot, idAt } from "./helpers.mjs";

const s = exampleSnapshot();
const LANDSCAPE = ["data-object", "service", "system", "system-kind"];
const I = (address) => idAt(s, address);
const ref = (e, via, to) => e.references.find((r) => r.via === via && r.to.name === to);

test("list_types and describe_schema show the landscape types, each in its pack's file", () => {
  const types = listTypes(s).types.map((t) => t.type);
  for (const t of LANDSCAPE) assert.ok(types.includes(t), t);
  for (const t of LANDSCAPE) assert.match(describeSchema(s, t).url, /\/landscape\/[a-z-]+-schema\.md$/, t);
  assert.ok(types.includes("product-kind"), "the core's product kind, which a product now declares");
});

test("get_entity on a system returns its Connects to and Holds rows with the qualifiers resolved", () => {
  const mailer = getEntityById(s, I("systems/invoice-mailer")).entity;
  const feed = ref(mailer, "Connects to.System", "Billing service");
  assert.ok(feed, "the Connects to row draws its edge to the system it names");
  assert.deepEqual(feed.attrs, {
    As: "Feed endpoint",
    Service: { id: I("services/invoice-feed"), type: "service", name: "Invoice feed" },
    Carries: { id: I("concepts/invoice"), type: "concept", name: "Invoice" },
    Via: "REST",
  });
  const held = ref(mailer, "Holds.Concept", "Invoice");
  assert.ok(held);
  assert.ok(Object.keys(held.attrs).includes("Access") && "Data object" in held.attrs);
  const billing = getEntityById(s, I("systems/billing-service")).entity;
  assert.deepEqual(ref(billing, "Holds.Concept", "Invoice").attrs["Data object"], { id: I("data-objects/invoice-record"), type: "data-object", name: "Invoice record" });
  assert.equal(ref(billing, "Holds.Concept", "Invoice").attrs.Access, "master");
});

test("list_references shows a feature's inverse edge from the system that realizes it", () => {
  const edges = listReferences(s, { entity: I("features/billing-run"), direction: "in", via: "realizes" }).edges;
  assert.deepEqual(edges.map((e) => [e.from.name, e.from.type, e.via, e.to.name]), [["Billing service", "system", "realizes", "Billing run"]]);
});

test("the diagram tool, which names its shapes and packs, still draws the example that takes a third pack", () => {
  const schemas = diagram(s, { shape: "schema" });
  for (const t of LANDSCAPE) assert.ok(schemas.nodes.some((n) => n.title === t || n.id === t || String(n.title).includes(t)), `the schema diagram draws ${t}`);
  const org = diagram(s, { shape: "organization" });
  assert.ok(org.edges > 0, "the organization shape is unmoved");
  const hood = diagram(s, { shape: "neighborhood", id: I("systems/billing-service") });
  assert.ok(hood.nodes.some((n) => n.type === "feature") && hood.nodes.some((n) => n.type === "concept"));
});
