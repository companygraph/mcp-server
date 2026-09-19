import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, findEvidence, search, fetchEntity } from "../lib/model.mjs";
import { exampleSnapshot, COMMIT, withSharedName, EXAMPLE_CORE, PARSER, EXAMPLE_TYPES } from "./helpers.mjs";

const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER };

test("list_types names every declared type with its tagline and count", () => {
  const r = listTypes(s);
  assert.deepEqual(r.model, MODEL);
  assert.equal(r.types.length, EXAMPLE_TYPES);
  const skill = r.types.find((t) => t.type === "skill");
  assert.equal(skill.name, "Skill Schema");
  assert.equal(skill.count, s.entities.filter((e) => e.type === "skill").length);
  assert.equal(r.types.find((t) => t.type === "experience").owner, "profile");
  assert.equal(r.types.find((t) => t.type === "identity").count, 1);
});

test("describe_schema returns the schema's sections and refuses an undeclared type", () => {
  const r = describeSchema(s, "profile");
  assert.equal(r.name, "Profile Schema");
  assert.deepEqual(r.sections.map((x) => x.heading), ["File Location", "Frontmatter", "Sections", "Purpose", "Writing rules"]);
  const frontmatter = r.sections.find((x) => x.heading === "Frontmatter");
  assert.ok(frontmatter.tables[0].columns.includes("Field"));
  assert.equal(frontmatter.table, undefined);
  assert.throws(() => describeSchema(s, "person"), (e) => e instanceof ModelError && /no schema declares "person"/.test(e.message) && /skill/.test(e.message));
});

test("list_entities lists one type, sorted by id", () => {
  const r = listEntities(s, "skill");
  assert.equal(r.type, "skill");
  assert.deepEqual(r.entities.map((e) => e.id), ["skills/domain-driven-design", "skills/java-programming", "skills/product-discovery"]);
  assert.deepEqual(Object.keys(r.entities[0]), ["id", "name", "tagline", "owner"]);
  assert.throws(() => listEntities(s, "person"), ModelError);
});

test("get_entity resolves within the type and returns references both ways", () => {
  const r = getEntity(s, "skill", "Domain-Driven Design");
  assert.equal(r.entity.id, "skills/domain-driven-design");
  assert.equal(r.entity.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/skills/domain-driven-design.md`);
  assert.equal(r.entity.markdown, undefined);
  const claim = r.entity.referencedBy.find((x) => x.via === "Skills.Skill" && x.id === "profiles/mira-halvorsen");
  assert.equal(claim.type, "profile");
  assert.equal(claim.name, "Mira Halvorsen");
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  const row = r.entity.referencedBy.find((x) => x.via === "Evidence.Skill" && x.id === "profiles/mira-halvorsen");
  assert.match(row.attrs["What it shows"], /bounded contexts/);
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const source = r.entity.references.find((x) => x.via === "source");
  assert.equal(source.type, "source");
  assert.equal(source.name, "Local");
});

test("get_entity serves each table once, under tables", () => {
  const r = getEntity(s, "profile", "Mira Halvorsen");
  const skills = r.entity.sections.find((x) => x.heading === "Skills");
  assert.ok(skills.tables[0].rows.length >= 1);
  for (const section of r.entity.sections) assert.equal(section.table, undefined, section.heading);
  assert.ok(s.entities.find((e) => e.id === "profiles/mira-halvorsen").sections.find((x) => x.heading === "Skills").table, "the snapshot keeps the parser's graph untouched");
});

test("get_entity serves ownership both ways, as owner", () => {
  const owned = s.entities.filter((e) => e.owner === "profiles/mira-halvorsen");
  assert.ok(owned.length >= 1);
  const profile = getEntity(s, "profile", "Mira Halvorsen").entity;
  const owns = profile.referencedBy.filter((x) => x.via === "owner");
  assert.deepEqual(owns.map((x) => x.id).sort(), owned.map((e) => e.id).sort());
  assert.deepEqual(owns[0], { via: "owner", id: owned[0].id, type: owned[0].type, name: owned[0].name, attrs: {} });
  assert.equal(profile.references.filter((x) => x.via === "owner").length, 0);
  const exp = getEntity(s, owned[0].type, owned[0].name).entity;
  assert.deepEqual(exp.references.filter((x) => x.via === "owner"), [{ via: "owner", id: "profiles/mira-halvorsen", type: "profile", name: "Mira Halvorsen", attrs: {} }]);
});

test("get_entity is an R4 error for a name the type does not hold, even if another type does", () => {
  assert.throws(() => getEntity(s, "skill", "Beacon Systems"), (e) => e instanceof ModelError && /R4/.test(e.message) && /skill/.test(e.message));
  assert.equal(getEntity(s, "identity", "Beacon Systems").entity.id, "identity");
});

test("find_evidence groups every edge into the skill by the referencing type, attributes verbatim", () => {
  const r = findEvidence(s, "Domain-Driven Design");
  assert.deepEqual(r.skill, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design", tagline: s.entities.find((e) => e.id === "skills/domain-driven-design").tagline });
  assert.deepEqual(Object.keys(r.evidence).sort(), ["experience", "profile", "role"]);
  const mira = r.evidence.profile.find((x) => x.id === "profiles/mira-halvorsen" && x.via === "Skills.Skill");
  assert.equal(mira.attrs.Level.name, "Competent");
  const row = r.evidence.profile.find((x) => x.id === "profiles/mira-halvorsen" && x.via === "Evidence.Skill");
  assert.equal(row.attrs["What it shows"], "Split the billing domain into two bounded contexts; the seams have held under two years of change.");
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const exp = r.evidence.experience.find((x) => x.id === "profiles/mira-halvorsen/experiences/2022-beacon-systems");
  assert.equal(exp.via, "skills");
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.stamp, s.entities.find((e) => e.id === exp.id).stamp);
  assert.throws(() => findEvidence(s, "Knitting"), (e) => e instanceof ModelError && /R4/.test(e.message));
});

test("search matches name, tagline, fields, section text and cells, case-insensitive, sorted by type then name", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.ok(r.total >= 1);
  const mira = r.results.find((x) => x.id === "profiles/mira-halvorsen");
  assert.ok(mira.matched.includes("table:Evidence"));
  assert.equal(mira.title, "Mira Halvorsen");
  assert.equal(mira.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/profiles/mira-halvorsen/mira-halvorsen.md`);
  const byName = search(s, "domain-driven").results.find((x) => x.id === "skills/domain-driven-design");
  assert.ok(byName.matched.includes("name"));
  const keys = r.results.map((x) => x.type + x.title);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(search(s, "zzzz-nothing").total, 0);
  assert.throws(() => search(s, "  "), ModelError);
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

test("fetch takes an id, falls back to a name held by exactly one type, and refuses a shared name", () => {
  const byId = fetchEntity(s, "skills/domain-driven-design");
  assert.equal(byId.title, "Domain-Driven Design");
  assert.match(byId.text, /^---\n/);
  assert.equal(byId.entity.id, "skills/domain-driven-design");
  assert.equal(byId.entity.markdown, undefined);
  assert.equal(fetchEntity(s, "Beacon Systems").entity.id, "identity");
  const shared = withSharedName();
  assert.throws(() => fetchEntity(shared, "Beacon Systems"), (e) => e instanceof ModelError && /R2/.test(e.message) && /identity/.test(e.message) && /profile/.test(e.message));
  assert.throws(() => fetchEntity(s, "nothing/here"), (e) => e instanceof ModelError && /nothing\/here/.test(e.message));
});

// A tagline wrapped across `>` lines is one paragraph, and an agent reads the whole of it. The
// example's partner directory wraps its tagline, and before core 0.27.0 the parser served its
// first line only, so every tool that lists an entity ended the sentence mid-clause.
test("a wrapped tagline reaches every tool whole", () => {
  const s = exampleSnapshot();
  const listed = listEntities(s, "surface").entities.find((e) => e.name === "Partner directory");
  assert.match(listed.tagline, /takes no feed\.$/);
  assert.equal(getEntity(s, "surface", "Partner directory").entity.tagline, listed.tagline);
});
