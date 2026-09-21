import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, listReferences, REFERENCE_CAP, findEvidence, search, fetchEntity } from "../lib/model.mjs";
import { createServer } from "../lib/server.mjs";
import { instanceSnapshot, INSTANCE_COMMIT, INSTANCE_CORE, PARSER } from "./helpers.mjs";

const s = instanceSnapshot();

test("the instance parses to what its site publishes", () => {
  assert.equal(s.root, "Robert Blust");
  assert.equal(s.rootId, "identity");
  assert.equal(s.entities.length, 155);
  assert.equal(s.edges.length, 964);
  assert.equal(listTypes(s).types.length, 16);
  assert.deepEqual(listTypes(s).model, { commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", core: INSTANCE_CORE, parser: PARSER });
});

test("the company of one: the identity and the profile share a name, and each is reached by type or by id", () => {
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
  assert.deepEqual(search(s, "Robert Blust", { match: "name" }).results.map((x) => x.id), ["identity", "profiles/robert-blust"]);
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && e.code === "unknown_entity");
  assert.equal(fetchEntity(s, "profiles/robert-blust").title, "Robert Blust");
});

// The profile draws more edges than one entity answer holds, so the answer is capped and says
// by how much, and the claims are read where edges are filtered.
test("which skills are Expert, and on what evidence", () => {
  const profile = getEntity(s, "profile", "Robert Blust").entity;
  assert.equal(profile.references.length, REFERENCE_CAP);
  assert.ok(profile.referenceCounts.references > REFERENCE_CAP);
  const claims = listReferences(s, { entity: profile.id, direction: "out", via: "Skills.Skill", limit: 200 });
  assert.equal(claims.page.hasMore, false);
  const expert = claims.edges.filter((r) => r.attrs.Level.name === "Expert");
  assert.equal(expert.length, 24);
  assert.ok(expert.some((r) => r.to.name === "Agentic AI development"));
  const ev = findEvidence(s, "Agentic AI development");
  const claim = ev.evidence.profile.find((x) => x.from.id === "profiles/robert-blust" && x.via === "Skills.Skill");
  assert.equal(claim.attrs.Level.name, "Expert");
  const row = ev.evidence.profile.find((x) => x.via === "Evidence.Skill" && x.attrs["What it shows"].startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  assert.equal(row.attrs.Experience.name, "Co-Founder & Head of Technology");
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

test("every declared type describes, lists and, where it holds an entity, gets one without throwing", () => {
  for (const { type, count } of listTypes(s).types) {
    const schema = describeSchema(s, type);
    assert.ok(Array.isArray(schema.sections));
    const entities = listEntities(s, type).entities;
    assert.ok(Array.isArray(entities));
    if (count > 0) {
      const r = getEntity(s, type, entities[0].name);
      assert.equal(r.entity.type, type);
      assert.ok(Array.isArray(r.entity.references));
      assert.ok(Array.isArray(r.entity.referencedBy));
    }
  }
});

test("the server introduces the instance by its own words", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  assert.equal(client.getServerVersion().title, "Robert Blust");
  const vision = s.entities.find((e) => e.type === "vision");
  assert.ok(client.getInstructions().startsWith(vision.tagline));
  // The commit is an answer's to name. A client keeps the instructions past the snapshot's time.
  assert.doesNotMatch(client.getInstructions(), new RegExp(INSTANCE_COMMIT));
  const { structuredContent } = await client.callTool({ name: "list_types", arguments: {} });
  assert.equal(structuredContent.model.commit, INSTANCE_COMMIT);
  await client.close();
});
