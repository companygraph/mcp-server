// An entity is one thing with two names since meta-model 0.65.0: its id, read off the page's
// `id:` and kept through every move and rename, and its address, the folder and slug where the
// page sits now. A client may hold either, from an answer given before a page moved or from a
// link a person wrote, so every tool that takes an entity takes both and reaches the same one;
// every answer gives the id, so what a client keeps from it stays good after the page moves.
// The worked example carries an id on every page, which is what these tests run on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { ModelError, listEntities, listReferences, search, findEvidence, getEntityById, fetchEntity, allEdges, imageUrl } from "../lib/model.mjs";
import { diagram } from "../lib/diagram.mjs";
import { createServer } from "../lib/server.mjs";
import { exampleSnapshot, at } from "./helpers.mjs";

const s = exampleSnapshot();
const MIRA = at(s, "profiles/mira-halvorsen");
const DDD = at(s, "skills/domain-driven-design");

test("the example carries a stable id on every page, apart from where the page sits", () => {
  for (const e of s.entities) {
    assert.equal(e.id, e.fields.id, e.address);
    assert.notEqual(e.id, e.address, e.address);
  }
});

test("an owner's address and its id give the same list_entities and search answer", () => {
  assert.notEqual(MIRA.id, MIRA.address);
  const byId = listEntities(s, "experience", { owner: MIRA.id });
  assert.ok(byId.entities.length >= 1 && byId.entities.every((e) => e.owner === MIRA.id));
  assert.deepEqual(listEntities(s, "experience", { owner: MIRA.address }), byId);
  const found = search(s, "billing", { owner: MIRA.id });
  assert.ok(found.results.length >= 1);
  assert.deepEqual(search(s, "billing", { owner: MIRA.address }), found);
});

test("every tool that takes an entity reaches the same one by its address as by its id", () => {
  assert.deepEqual(listReferences(s, { entity: MIRA.address, direction: "in" }), listReferences(s, { entity: MIRA.id, direction: "in" }));
  assert.deepEqual(getEntityById(s, DDD.address), getEntityById(s, DDD.id));
  assert.deepEqual(fetchEntity(s, DDD.address), fetchEntity(s, DDD.id));
  assert.deepEqual(findEvidence(s, DDD.address), findEvidence(s, DDD.id));
  const delivery = at(s, "processes/delivery");
  assert.deepEqual(diagram(s, { shape: "process", id: delivery.address }), diagram(s, { shape: "process", id: delivery.id }));
  assert.deepEqual(diagram(s, { shape: "neighborhood", id: MIRA.address }), diagram(s, { shape: "neighborhood", id: MIRA.id }));
  const invoicing = at(s, "domains/invoicing");
  assert.deepEqual(diagram(s, { shape: "concepts", domain: invoicing.address }), diagram(s, { shape: "concepts", domain: invoicing.id }));
});

test("a value that is neither an id nor an address is refused as it always was", () => {
  for (const value of ["profiles/nobody", "profiles", "mira-halvorsen", MIRA.address + "/"])
    assert.throws(() => listEntities(s, "experience", { owner: value }), (e) => e instanceof ModelError && e.code === "unknown_entity" && e.details.id === value, value);
});

test("every answer's id is the stable id, whichever name the call used", () => {
  const stable = new Set(s.entities.map((e) => e.fields.id));
  const addresses = new Set(s.entities.map((e) => e.address));
  const held = (id, where) => { assert.ok(stable.has(id), `${where}: ${id}`); assert.ok(!addresses.has(id), `${where}: ${id}`); };
  for (const e of listEntities(s, "experience", { owner: MIRA.address, limit: 200 }).entities) { held(e.id, "list_entities"); held(e.owner, "list_entities owner"); }
  const entity = getEntityById(s, MIRA.address).entity;
  held(entity.id, "get_entity");
  for (const x of [...entity.references, ...entity.referencedBy]) { held(x.from.id, "get_entity edge"); held(x.to.id, "get_entity edge"); }
  for (const x of allEdges(s)) { held(x.from.id, "edge"); held(x.to.id, "edge"); }
  for (const r of search(s, "billing", { limit: 200 }).results) held(r.id, "search");
  held(fetchEntity(s, DDD.address).id, "fetch");
  const evidence = findEvidence(s, DDD.address);
  held(evidence.skill.id, "find_evidence");
  for (const d of [diagram(s, { shape: "neighborhood", id: MIRA.address }), diagram(s, { shape: "process", id: "processes/delivery" })])
    for (const n of d.nodes) held(n.id, `diagram ${d.shape}`);
});

// Where a page sits is `path` in an answer, as it always was; the parser's `address` is its own
// name for the same place and is not served beside it.
test("an entity's answer names it by its id and adds no address", () => {
  const entity = getEntityById(s, MIRA.address).entity;
  assert.equal(entity.id, MIRA.id);
  assert.equal(entity.path, MIRA.path);
  assert.ok(!("address" in entity));
});

// The sites publish a picture under the page's address, so the address the picture is served at
// is built from that and not from the id, which names no file.
test("image_url ends in the entity's address and the picture's extension", () => {
  const agent = at(s, "profiles/ai-agent");
  assert.notEqual(agent.id, agent.address);
  const url = getEntityById(s, agent.id).entity.image_url;
  assert.equal(url, imageUrl(s, agent));
  assert.ok(url.endsWith(`/images/${agent.address}.${agent.fields.image.split(".").pop()}`), url);
  assert.ok(!url.includes(agent.id), url);
});

test("the tools take an address over the wire and answer with the id", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  const byAddress = await client.callTool({ name: "list_entities", arguments: { type: "experience", owner: MIRA.address } });
  const byId = await client.callTool({ name: "list_entities", arguments: { type: "experience", owner: MIRA.id } });
  assert.equal(byAddress.isError, undefined);
  assert.deepEqual(byAddress.structuredContent, byId.structuredContent);
  const got = await client.callTool({ name: "get_entity", arguments: { id: DDD.address } });
  assert.equal(got.structuredContent.entity.id, DDD.id);
  await client.close();
});
