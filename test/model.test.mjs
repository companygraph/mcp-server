import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, getEntityById, entityBy, REFERENCE_CAP, findEvidence, search, fetchEntity } from "../lib/model.mjs";
import { exampleSnapshot, COMMIT, withSharedName, withOwnedNameTwice, EXAMPLE_CORE, PARSER, EXAMPLE_TYPES } from "./helpers.mjs";

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
  assert.deepEqual(Object.keys(r.entities[0]), ["id", "type", "name", "tagline", "owner"]);
  assert.throws(() => listEntities(s, "person"), ModelError);
});

test("get_entity resolves within the type and returns references both ways, as edges", () => {
  const r = getEntity(s, "skill", "Domain-Driven Design");
  assert.equal(r.entity.id, "skills/domain-driven-design");
  assert.equal(r.entity.owner, null);
  assert.equal(r.entity.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/skills/domain-driven-design.md`);
  assert.equal(r.entity.markdown, undefined);
  const claim = r.entity.referencedBy.find((x) => x.via === "Skills.Skill" && x.from.id === "profiles/mira-halvorsen");
  assert.deepEqual(claim.from, { id: "profiles/mira-halvorsen", type: "profile", name: "Mira Halvorsen" });
  assert.deepEqual(claim.to, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design" });
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  const row = r.entity.referencedBy.find((x) => x.via === "Evidence.Skill" && x.from.id === "profiles/mira-halvorsen");
  assert.match(row.attrs["What it shows"], /bounded contexts/);
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const source = r.entity.references.find((x) => x.via === "source");
  assert.deepEqual([source.to.type, source.to.name], ["source", "Local"]);
  assert.deepEqual(r.entity.referenceCounts, { references: r.entity.references.length, referencedBy: r.entity.referencedBy.length });
});

test("get_entity takes an id, and the tool's entry takes either and refuses neither", () => {
  assert.deepEqual(getEntityById(s, "skills/domain-driven-design"), getEntity(s, "skill", "Domain-Driven Design"));
  assert.equal(entityBy(s, { id: "identity" }).entity.id, "identity");
  assert.equal(entityBy(s, { type: "identity", name: "Beacon Systems" }).entity.id, "identity");
  assert.equal(entityBy(s, { id: "identity", type: "skill", name: "Knitting" }).entity.id, "identity", "the id wins");
  assert.throws(() => getEntityById(s, "nothing/here"), (e) => e instanceof ModelError && e.code === "unknown_entity");
  for (const [args, argument] of [[{}, "id"], [{ type: "skill" }, "name"], [{ name: "Domain-Driven Design" }, "type"]])
    assert.throws(() => entityBy(s, args), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === argument);
});

test("get_entity serves each table once, under tables", () => {
  const r = getEntity(s, "profile", "Mira Halvorsen");
  const skills = r.entity.sections.find((x) => x.heading === "Skills");
  assert.ok(skills.tables[0].rows.length >= 1);
  for (const section of r.entity.sections) assert.equal(section.table, undefined, section.heading);
  assert.ok(s.entities.find((e) => e.id === "profiles/mira-halvorsen").sections.find((x) => x.heading === "Skills").table, "the snapshot keeps the parser's graph untouched");
});

test("get_entity serves ownership both ways, as nested-in", () => {
  const owned = s.entities.filter((e) => e.owner === "profiles/mira-halvorsen");
  assert.ok(owned.length >= 1);
  const profile = getEntity(s, "profile", "Mira Halvorsen").entity;
  const owns = profile.referencedBy.filter((x) => x.via === "nested-in");
  assert.deepEqual(owns.map((x) => x.from.id).sort(), owned.map((e) => e.id).sort());
  assert.equal(profile.references.filter((x) => x.via === "nested-in").length, 0);
  const exp = getEntityById(s, owned[0].id).entity;
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.references.filter((x) => x.via === "nested-in"),
    [{ from: { id: owned[0].id, type: owned[0].type, name: owned[0].name }, via: "nested-in", to: { id: "profiles/mira-halvorsen", type: "profile", name: "Mira Halvorsen" }, attrs: {} }]);
});

test("get_entity is an R4 error for a name the type does not hold, even if another type does", () => {
  assert.throws(() => getEntity(s, "skill", "Beacon Systems"), (e) => e instanceof ModelError && /R4/.test(e.message) && /skill/.test(e.message));
  assert.equal(getEntity(s, "identity", "Beacon Systems").entity.id, "identity");
});

test("find_evidence groups every edge into the skill by the referencing type, attributes verbatim", () => {
  const r = findEvidence(s, "Domain-Driven Design");
  assert.deepEqual(findEvidence(s, "skills/domain-driven-design"), r, "an id reaches the same skill");
  assert.deepEqual(r.skill, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design", tagline: s.entities.find((e) => e.id === "skills/domain-driven-design").tagline });
  assert.deepEqual(Object.keys(r.evidence).sort(), ["experience", "profile", "role"]);
  const mira = r.evidence.profile.find((x) => x.from.id === "profiles/mira-halvorsen" && x.via === "Skills.Skill");
  assert.equal(mira.attrs.Level.name, "Competent");
  assert.equal(mira.owner, null);
  assert.equal(mira.to.id, "skills/domain-driven-design");
  const row = r.evidence.profile.find((x) => x.from.id === "profiles/mira-halvorsen" && x.via === "Evidence.Skill");
  assert.equal(row.attrs["What it shows"], "Split the billing domain into two bounded contexts; the seams have held under two years of change.");
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const exp = r.evidence.experience.find((x) => x.from.id === "profiles/mira-halvorsen/experiences/2022-beacon-systems");
  assert.equal(exp.via, "skills");
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.stamp, s.entities.find((e) => e.id === exp.from.id).stamp);
  assert.throws(() => findEvidence(s, "Knitting"), (e) => e instanceof ModelError && /R4/.test(e.message));
});

// Nothing in the package bounds how many pages of an instance name one skill, so the edges come
// a page at a time like every other list of them, in one fixed order: the type of the page
// that drew each and then the order every list of edges has, so a group is whole before the
// next begins and a walk puts together exactly what one large page holds.
test("find_evidence answers a page at a time, in one order, and a walk holds what one page does", () => {
  const whole = findEvidence(s, "skills/domain-driven-design");
  const flat = (r) => Object.values(r.evidence).flat();
  assert.deepEqual(whole.page, { total: flat(whole).length, returned: flat(whole).length, hasMore: false, nextCursor: null });
  assert.ok(whole.page.total >= 3, "the fixture draws enough edges to walk");
  assert.deepEqual(Object.keys(whole.evidence), Object.keys(whole.evidence).toSorted(), "groups come in the order of their type");
  const walked = [];
  let cursor;
  do {
    const r = findEvidence(s, "Domain-Driven Design", { limit: 2, cursor });
    assert.ok(r.page.returned <= 2);
    assert.equal(r.page.total, whole.page.total);
    assert.deepEqual(r.skill, whole.skill, "every page names the skill");
    walked.push(...flat(r));
    cursor = r.page.nextCursor;
  } while (cursor);
  assert.deepEqual(walked, flat(whole));
  assert.throws(() => findEvidence(s, "skills/domain-driven-design", { cursor: "nonsense" }), (e) => e instanceof ModelError && e.code === "invalid_cursor");
});

test("search matches name, tagline, fields, section text and cells, case-insensitive, sorted by type then name", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.ok(r.page.total >= 1);
  const mira = r.results.find((x) => x.id === "profiles/mira-halvorsen");
  assert.ok(mira.matched.some((m) => m.where === "table" && m.key === "Evidence"));
  assert.equal(mira.title, "Mira Halvorsen");
  assert.equal(mira.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/profiles/mira-halvorsen/mira-halvorsen.md`);
  const keys = r.results.map((x) => x.type + x.title);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(search(s, "zzzz-nothing").page.total, 0);
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

test("fetch is the page as written, by id, and carries no structured copy", () => {
  const r = fetchEntity(s, "skills/domain-driven-design");
  assert.deepEqual(Object.keys(r), ["id", "title", "type", "url", "text", "model"]);
  assert.deepEqual([r.title, r.type], ["Domain-Driven Design", "skill"]);
  assert.match(r.text, /^---\n/);
  assert.equal(r.text, s.entities.find((e) => e.id === r.id).markdown);
  // A name is no id. search finds the id a name belongs to, under every type that holds it.
  assert.throws(() => fetchEntity(s, "Beacon Systems"), (e) => e instanceof ModelError && e.code === "unknown_entity" && /match "name"/.test(e.message));
  assert.deepEqual(search(withSharedName(), "Beacon Systems", { match: "name" }).results.map((x) => x.id), ["identity", "profiles/beacon-systems"]);
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

// Core 0.31.0 lets two owners each own an entity of one name, and a lookup by type and name alone
// then meets two. Handing back the first would answer for the wrong person without saying so, so
// the lookup refuses with every candidate, and an id reaches each.
test("a name two owners each hold is refused by type and name, with every id named, and each is reached by id", () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const ids = snapshot.entities.filter((e) => e.type === "experience" && e.name === title).map((e) => e.id);
  assert.equal(ids.length, 2);
  assert.throws(() => getEntity(snapshot, "experience", title), (e) => e instanceof ModelError && /R2/.test(e.message) && ids.every((id) => e.message.includes(id)) && /by its id/.test(e.message));
  for (const id of ids) {
    assert.equal(getEntityById(snapshot, id).entity.id, id);
    assert.equal(fetchEntity(snapshot, id).id, id);
  }
  assert.ok(owners.every((o) => ids.some((id) => id.startsWith(`${o}/`))));
});
