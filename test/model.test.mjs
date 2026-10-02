import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, getEntityById, entityBy, REFERENCE_CAP, findEvidence, search, fetchEntity, createdOf } from "../lib/model.mjs";
import { exampleSnapshot, COMMIT, withSharedName, withOwnedNameTwice, EXAMPLE_CORE, PARSER, EXAMPLE_TYPES, instanceSnapshot, idAt } from "./helpers.mjs";

const s = exampleSnapshot();
// Each entity the tests name, by where its page sits, and the id the snapshot gives it.
const DDD = idAt(s, "skills/domain-driven-design");
const MIRA = idAt(s, "profiles/mira-halvorsen");
const ROOT = s.rootId;
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

test("list_entities lists one type, in the order of where their pages sit", () => {
  const r = listEntities(s, "skill");
  assert.equal(r.type, "skill");
  assert.deepEqual(r.entities.map((e) => e.id), ["skills/domain-driven-design", "skills/java-programming", "skills/product-discovery"].map((a) => idAt(s, a)));
  assert.deepEqual(Object.keys(r.entities[0]), ["id", "type", "name", "tagline", "owner", "created"]);
  assert.throws(() => listEntities(s, "person"), ModelError);
});

test("the moment a version 7 id was made is read from the id, and from no other id", () => {
  // Made with `companygraph id` on 2026-10-02; the moment is the one the id was made at.
  assert.equal(createdOf("01a0fadb-2a89-734e-85c3-2c8094ed07e6"), "2026-10-02T04:24:22.409Z");
  assert.equal(createdOf("01A0FADB-2A89-734E-85C3-2C8094ED07E6"), "2026-10-02T04:24:22.409Z");
  assert.equal(createdOf("3b241101-e2bb-4255-8caf-4136c566a962"), null, "a version 4 id");
  assert.equal(createdOf("skills/domain-driven-design"), null, "an address standing in for an id");
  assert.equal(createdOf("01a0fadb2a89734e85c32c8094ed07e6"), null, "a UUID without its hyphens");
  assert.equal(createdOf(undefined), null);
});

test("every entity a tool serves carries its moment, and one whose id has none carries no key", () => {
  const listed = listEntities(s, "skill").entities[0];
  assert.equal(listed.created, createdOf(listed.id));
  const found = search(s, "Domain-Driven Design", { match: "name" }).results[0];
  assert.equal(found.created, createdOf(found.id));
  assert.equal(getEntityById(s, DDD).entity.created, createdOf(DDD));
  const undated = instanceSnapshot();
  const first = listEntities(undated, "skill").entities[0];
  assert.equal("created" in first, false);
  assert.equal("created" in getEntityById(undated, first.id).entity, false);
  assert.equal("created" in search(undated, first.name, { match: "name" }).results[0], false);
});

test("get_entity resolves within the type and returns references both ways, as edges", () => {
  const r = getEntity(s, "skill", "Domain-Driven Design");
  assert.equal(r.entity.id, DDD);
  assert.equal(r.entity.owner, null);
  assert.equal(r.entity.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/skills/domain-driven-design.md`);
  assert.equal(r.entity.markdown, undefined);
  const claim = r.entity.referencedBy.find((x) => x.via === "Skills.Skill" && x.from.id === MIRA);
  assert.deepEqual(claim.from, { id: MIRA, type: "profile", name: "Mira Halvorsen" });
  assert.deepEqual(claim.to, { id: DDD, type: "skill", name: "Domain-Driven Design" });
  assert.deepEqual(claim.attrs.Level, { id: idAt(s, "proficiency-levels/competent"), type: "proficiency-level", name: "Competent" });
  const row = r.entity.referencedBy.find((x) => x.via === "Evidence.Skill" && x.from.id === MIRA);
  assert.match(row.attrs["What it shows"], /bounded contexts/);
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const source = r.entity.references.find((x) => x.via === "source");
  assert.deepEqual([source.to.type, source.to.name], ["source", "Local"]);
  assert.deepEqual(r.entity.referenceCounts, { references: r.entity.references.length, referencedBy: r.entity.referencedBy.length });
});

// core 0.40.0's `ref → by <Column> in <Owner>` form (R9): a question's "Rests on" row draws an
// edge to the entity its own `Entity` cell names, of the type its own `Type` cell names, resolved
// within the owner its own `Owner` cell names. The row's other columns, `Type` and `Owner`
// included, arrive verbatim in `attrs`, with no backticks, since the row's own words are not a
// resolved qualifier.
test("a question's edge resolves the type and owner its own row names, and carries them as attrs", () => {
  const r = getEntity(s, "question", "Who split billing out of the monolith?");
  const rests = r.entity.references.filter((x) => x.via === "Rests on.Entity");
  // Two rows since core 0.43.0, one owned and one not, sorted by where the page they reach sits;
  // the unowned row's Owner cell is blank and arrives as the empty string it is.
  assert.deepEqual(rests.map((x) => x.to), [
    { id: idAt(s, "decisions/2022-billing-leaves-the-monolith"), type: "decision", name: "Billing leaves the monolith" },
    { id: idAt(s, "profiles/mira-halvorsen/experiences/2022-beacon-systems"), type: "experience", name: "Splitting the billing domain" },
  ]);
  assert.deepEqual(rests.map((x) => x.attrs), [
    { Type: "decision", Owner: "", For: "why" },
    { Type: "experience", Owner: "Mira Halvorsen", For: "the period" },
  ]);
});

// core 0.45.0 adds question-kind as a declared type and a required kind on every question; the
// type is served like any other, and the field is a reference like source, resolved by name.
test("list_types serves question-kind, and a question's kind is an edge to it", () => {
  const types = listTypes(s).types.map((t) => t.type);
  assert.ok(types.includes("question-kind"), "list_types includes question-kind");
  const r = getEntity(s, "question", "Who split billing out of the monolith?");
  const kind = r.entity.references.find((x) => x.via === "kind");
  assert.deepEqual([kind.to.type, kind.to.name], ["question-kind", "Product"]);
});

test("get_entity takes an id, and the tool's entry takes either and refuses neither", () => {
  assert.deepEqual(getEntityById(s, DDD), getEntity(s, "skill", "Domain-Driven Design"));
  assert.equal(entityBy(s, { id: ROOT }).entity.id, ROOT);
  assert.equal(entityBy(s, { type: "identity", name: "Beacon Systems" }).entity.id, ROOT);
  assert.equal(entityBy(s, { id: ROOT, type: "skill", name: "Knitting" }).entity.id, ROOT, "the id wins");
  assert.throws(() => getEntityById(s, "nothing/here"), (e) => e instanceof ModelError && e.code === "unknown_entity");
  for (const [args, argument] of [[{}, "id"], [{ type: "skill" }, "name"], [{ name: "Domain-Driven Design" }, "type"]])
    assert.throws(() => entityBy(s, args), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === argument);
});

test("get_entity serves each table once, under tables", () => {
  const r = getEntity(s, "profile", "Mira Halvorsen");
  const skills = r.entity.sections.find((x) => x.heading === "Skills");
  assert.ok(skills.tables[0].rows.length >= 1);
  for (const section of r.entity.sections) assert.equal(section.table, undefined, section.heading);
  assert.ok(s.entities.find((e) => e.id === MIRA).sections.find((x) => x.heading === "Skills").table, "the snapshot keeps the parser's graph untouched");
});

test("get_entity serves ownership both ways, as nested-in", () => {
  const owned = s.entities.filter((e) => e.owner === MIRA);
  assert.ok(owned.length >= 1);
  const profile = getEntity(s, "profile", "Mira Halvorsen").entity;
  const owns = profile.referencedBy.filter((x) => x.via === "nested-in");
  assert.deepEqual(owns.map((x) => x.from.id).sort(), owned.map((e) => e.id).sort());
  assert.equal(profile.references.filter((x) => x.via === "nested-in").length, 0);
  const exp = getEntityById(s, owned[0].id).entity;
  assert.equal(exp.owner, MIRA);
  assert.deepEqual(exp.references.filter((x) => x.via === "nested-in"),
    [{ from: { id: owned[0].id, type: owned[0].type, name: owned[0].name }, via: "nested-in", to: { id: MIRA, type: "profile", name: "Mira Halvorsen" }, attrs: {} }]);
});

test("get_entity is an R4 error for a name the type does not hold, even if another type does", () => {
  assert.throws(() => getEntity(s, "skill", "Beacon Systems"), (e) => e instanceof ModelError && /R4/.test(e.message) && /skill/.test(e.message));
  assert.equal(getEntity(s, "identity", "Beacon Systems").entity.id, ROOT);
});

test("find_evidence groups every edge into the skill by the referencing type, attributes verbatim", () => {
  const r = findEvidence(s, "Domain-Driven Design");
  assert.deepEqual(findEvidence(s, DDD), r, "an id reaches the same skill");
  assert.deepEqual(findEvidence(s, "skills/domain-driven-design"), r, "and so does its address");
  assert.deepEqual(r.skill, { id: DDD, type: "skill", name: "Domain-Driven Design", tagline: s.entities.find((e) => e.id === DDD).tagline });
  assert.deepEqual(Object.keys(r.evidence).sort(), ["experience", "profile", "role"]);
  const mira = r.evidence.profile.find((x) => x.from.id === MIRA && x.via === "Skills.Skill");
  assert.equal(mira.attrs.Level.name, "Competent");
  assert.equal(mira.owner, null);
  assert.equal(mira.to.id, DDD);
  const row = r.evidence.profile.find((x) => x.from.id === MIRA && x.via === "Evidence.Skill");
  assert.equal(row.attrs["What it shows"], "Split the billing domain into two bounded contexts; the seams have held under two years of change.");
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const exp = r.evidence.experience.find((x) => x.from.id === idAt(s, "profiles/mira-halvorsen/experiences/2022-beacon-systems"));
  assert.equal(exp.via, "skills");
  assert.equal(exp.owner, MIRA);
  assert.deepEqual(exp.stamp, s.entities.find((e) => e.id === exp.from.id).stamp);
  assert.throws(() => findEvidence(s, "Knitting"), (e) => e instanceof ModelError && /R4/.test(e.message));
});

// Nothing in the package bounds how many pages of an instance name one skill, so the edges come
// a page at a time like every other list of them, in one fixed order: the type of the page
// that drew each and then the order every list of edges has, so a group is whole before the
// next begins and a walk puts together exactly what one large page holds.
test("find_evidence answers a page at a time, in one order, and a walk holds what one page does", () => {
  const whole = findEvidence(s, DDD);
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
  assert.throws(() => findEvidence(s, DDD, { cursor: "nonsense" }), (e) => e instanceof ModelError && e.code === "invalid_cursor");
});

test("search matches name, tagline, fields, section text and cells, case-insensitive, sorted by type then name", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.ok(r.page.total >= 1);
  const mira = r.results.find((x) => x.id === MIRA);
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
  const r = fetchEntity(s, DDD);
  assert.deepEqual(Object.keys(r), ["id", "title", "type", "url", "text", "model"]);
  assert.deepEqual([r.title, r.type], ["Domain-Driven Design", "skill"]);
  assert.match(r.text, /^---\n/);
  assert.equal(r.text, s.entities.find((e) => e.id === r.id).markdown);
  // A name is no id. search finds the id a name belongs to, under every type that holds it.
  assert.throws(() => fetchEntity(s, "Beacon Systems"), (e) => e instanceof ModelError && e.code === "unknown_entity" && /match "name"/.test(e.message));
  const shared = withSharedName();
  assert.deepEqual(search(shared, "Beacon Systems", { match: "name" }).results.map((x) => x.id), [shared.rootId, idAt(shared, "profiles/beacon-systems")]);
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
  const { snapshot, title, addresses } = withOwnedNameTwice();
  const ids = snapshot.entities.filter((e) => e.type === "experience" && e.name === title).map((e) => e.id);
  assert.equal(ids.length, 2);
  assert.throws(() => getEntity(snapshot, "experience", title), (e) => e instanceof ModelError && /R2/.test(e.message) && ids.every((id) => e.message.includes(id)) && /by its id/.test(e.message));
  for (const id of ids) {
    assert.equal(getEntityById(snapshot, id).entity.id, id);
    assert.equal(fetchEntity(snapshot, id).id, id);
  }
  const placed = ids.map((id) => snapshot.entities.find((e) => e.id === id).address);
  assert.ok(addresses.every((o) => placed.some((a) => a.startsWith(`${o}/`))));
});

// A profile's picture is served by the site the identity names, at the entity's address, where
// its page sits: the file a client can fetch, beside the file name the field holds.
test("get_entity names where an entity's picture is served, and nothing where it carries none", () => {
  const agent = getEntityById(s, idAt(s, "profiles/ai-agent")).entity;
  assert.equal(agent.fields.image, "ai-agent.png");
  assert.equal(agent.image_url, "https://beacon.example/images/profiles/ai-agent.png");
  const mira = getEntityById(s, MIRA).entity;
  assert.equal(mira.fields.image, undefined);
  assert.ok(!("image_url" in mira));
  assert.ok(!("image_url" in getEntityById(s, ROOT).entity));
});

// A core older than the type declares no image field, so a snapshot from it names no picture,
// whatever a page happens to hold: the reference fixture vendors such a core.
test("a snapshot from a core that predates image names no picture", () => {
  const old = instanceSnapshot();
  for (const e of old.entities) assert.ok(!("image_url" in getEntityById(old, e.id).entity), e.id);
});

// A list built from entities of the example's own type, so the order is the only thing a test
// varies: three moments, two of them in one millisecond, and one entity whose id says none.
const dated = (entries) => ({ ...s, entities: entries.map(([id, address]) => ({ id, type: "skill", name: address, tagline: "", owner: null, address, fields: {}, sections: [] })) });
const EARLY = "01a0fadb-2a89-734e-85c3-2c8094ed07e6";
const TIE_A = "01a0fadf-b1c5-7c45-b1a5-f4f9e18831f4";
const TIE_B = "01a0fadf-b1c5-7fff-8000-000000000000";
const UNDATED = "skills/written-before-ids";

test("list_entities leaves out its type to list every type, and names none in its answer", () => {
  const r = listEntities(s, undefined, { limit: 200 });
  assert.equal(r.type, null);
  assert.equal(r.page.total, s.entities.length);
  assert.ok(new Set(r.entities.map((e) => e.type)).size > 1);
  assert.deepEqual(r.entities, listEntities(s, undefined, { order: "address", limit: 200 }).entities, "address is the default");
});

test("newest and oldest order by the moment, then the id, and are each other reversed", () => {
  const t = dated([[TIE_B, "skills/b"], [UNDATED, "skills/a"], [EARLY, "skills/c"], [TIE_A, "skills/d"]]);
  assert.deepEqual(listEntities(t, "skill", { order: "oldest" }).entities.map((e) => e.id), [EARLY, TIE_A, TIE_B, UNDATED]);
  assert.deepEqual(listEntities(t, "skill", { order: "newest" }).entities.map((e) => e.id), [TIE_B, TIE_A, EARLY, UNDATED]);
  assert.deepEqual(listEntities(t, "skill").entities.map((e) => e.id), [UNDATED, TIE_B, EARLY, TIE_A], "address order is untouched");
});

test("entities whose ids say no moment follow in address order, and a list of only those is refused", () => {
  const t = dated([[EARLY, "skills/c"], ["skills/z", "skills/z"], ["skills/y", "skills/y"]]);
  assert.deepEqual(listEntities(t, "skill", { order: "newest" }).entities.map((e) => e.id), [EARLY, "skills/y", "skills/z"]);
  const none = dated([["skills/z", "skills/z"], ["skills/y", "skills/y"]]);
  assert.throws(() => listEntities(none, "skill", { order: "oldest" }), (e) => e instanceof ModelError && e.code === "no_creation_time"
    && e.details.order === "oldest" && e.details.type === "skill" && /address/.test(e.message));
  assert.throws(() => listEntities(none, undefined, { order: "newest" }), (e) => e.code === "no_creation_time" && e.details.type === null);
  assert.equal(listEntities(none, "skill").page.total, 2, "address order lists them");
});

test("a list its filters leave empty is an empty page in any order, never a refusal", () => {
  const r = listEntities(s, "skill", { owner: s.rootId, order: "newest" });
  assert.deepEqual([r.entities, r.page.total], [[], 0]);
});

test("a walk through newest meets every entity once, in the order one large page gives", () => {
  const whole = listEntities(s, undefined, { order: "newest", limit: 200 }).entities;
  const walked = [];
  let cursor;
  do {
    const r = listEntities(s, undefined, { order: "newest", limit: 2, cursor });
    walked.push(...r.entities);
    cursor = r.page.nextCursor;
  } while (cursor);
  assert.deepEqual(walked, whole);
  assert.equal(new Set(walked.map((e) => e.id)).size, s.entities.length);
  const times = walked.map((e) => e.created);
  assert.deepEqual(times, [...times].sort().reverse());
  assert.equal(walked[0].created, createdOf(walked[0].id));
});

test("an order outside the three is refused, named", () => {
  assert.throws(() => listEntities(s, "skill", { order: "latest" }), (e) => e.code === "invalid_argument" && e.details.argument === "order");
});
