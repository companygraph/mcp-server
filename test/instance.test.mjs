import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { ModelError, listTypes, listEntities, getEntity, findEvidence, search, fetchEntity } from "../lib/model.mjs";
import { createServer } from "../lib/server.mjs";
import { instanceSnapshot, INSTANCE_COMMIT } from "./helpers.mjs";

const s = instanceSnapshot();

test("the instance parses to what its site publishes", () => {
  assert.equal(s.root, "Robert Blust");
  assert.equal(s.rootId, "identity");
  assert.equal(s.entities.length, 143);
  assert.equal(s.edges.length, 608);
  assert.equal(listTypes(s).types.length, 15);
  assert.deepEqual(listTypes(s).model, { commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", core: "0.25.2", parser: "v0.25.2" });
});

test("the company of one: the identity and the profile share a name, and a bare name is refused", () => {
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && /R2/.test(e.message) && /identity/.test(e.message) && /profile/.test(e.message));
  assert.equal(fetchEntity(s, "profiles/robert-blust").title, "Robert Blust");
});

test("which skills are Expert, and on what evidence", () => {
  const profile = getEntity(s, "profile", "Robert Blust").entity;
  const expert = profile.references.filter((r) => r.via === "Skills.Skill" && r.attrs.Level.name === "Expert");
  assert.equal(expert.length, 27);
  assert.ok(expert.some((r) => r.name === "Agentic AI development"));
  const ev = findEvidence(s, "Agentic AI development");
  const claim = ev.evidence.profile.find((x) => x.id === "profiles/robert-blust");
  assert.equal(claim.attrs.Level.name, "Expert");
  assert.ok(claim.attrs.Evidence.startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  assert.ok(ev.evidence.experience.length >= 1);
});

test("what was built at LIKE MAGIC", () => {
  const hits = search(s, "LIKE MAGIC").results;
  assert.ok(hits.some((r) => r.id === "profiles/robert-blust/experiences/2022-likemagic"));
  const e = getEntity(s, "experience", "Co-Founder & Head of Technology").entity;
  assert.equal(e.id, "profiles/robert-blust/experiences/2022-likemagic");
  assert.equal(e.fields.organization, "LIKE MAGIC AG");
  assert.deepEqual(e.stamp, { kind: "Role", start: "2022-04", end: "2026-05" });
  assert.ok(e.sections.some((x) => x.heading === "Achievements"));
});

test("what he holds to", () => {
  const values = listEntities(s, "value").entities.map((v) => v.name);
  assert.deepEqual(values, ["Build the alternative before making the point", "Decide well over build fast", "Grow the people with the platform", "Model it before you build it", "Production is the finish line"]);
});

test("the server introduces the instance by its own words", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  assert.equal(client.getServerVersion().title, "Robert Blust");
  const vision = s.entities.find((e) => e.type === "vision");
  assert.ok(client.getInstructions().startsWith(vision.tagline));
  assert.match(client.getInstructions(), new RegExp(INSTANCE_COMMIT));
  await client.close();
});
