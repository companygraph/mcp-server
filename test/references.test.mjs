// The instance's edges as a list of their own, so a client inspects one entity's relations, or
// one kind of reference, without taking whole entities. An edge names both its ends, because a
// list of edges belongs to no single entity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listReferences } from "../lib/model.mjs";
import { exampleSnapshot, instanceSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const s = exampleSnapshot();
const DDD = "skills/domain-driven-design";
const MIRA = "profiles/mira-halvorsen";

test("an edge names both ends, the field that drew it and the row's other columns", () => {
  const r = listReferences(s, { entity: DDD, direction: "in", via: "Skills.Skill" });
  assert.deepEqual(r.model, { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER });
  const claim = r.edges.find((x) => x.from.id === MIRA);
  assert.deepEqual(Object.keys(claim), ["from", "via", "to", "attrs"]);
  assert.deepEqual(claim.from, { id: MIRA, type: "profile", name: "Mira Halvorsen" });
  assert.deepEqual(claim.to, { id: DDD, type: "skill", name: "Domain-Driven Design" });
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  assert.ok(r.edges.every((x) => x.via === "Skills.Skill" && x.to.id === DDD));
  assert.equal(r.page.total, r.edges.length);
});

test("direction reads relative to the entity, and both is the default", () => {
  const out = listReferences(s, { entity: MIRA, direction: "out" });
  const into = listReferences(s, { entity: MIRA, direction: "in" });
  const both = listReferences(s, { entity: MIRA });
  assert.ok(out.edges.length > 0 && out.edges.every((x) => x.from.id === MIRA));
  assert.ok(into.edges.length > 0 && into.edges.every((x) => x.to.id === MIRA));
  assert.equal(both.page.total, out.page.total + into.page.total);
});

test("nesting is an edge from the owned to its owner, via owner", () => {
  const owned = s.entities.filter((e) => e.owner === MIRA).map((e) => e.id).sort();
  assert.ok(owned.length >= 1);
  const r = listReferences(s, { entity: MIRA, direction: "in", via: "owner" });
  assert.deepEqual(r.edges.map((x) => x.from.id).sort(), owned);
  assert.deepEqual(r.edges[0].attrs, {});
});

test("type is the far end's with an entity, and either end's without", () => {
  const far = listReferences(s, { entity: MIRA, direction: "out", type: "skill" });
  assert.ok(far.edges.length > 0 && far.edges.every((x) => x.to.type === "skill"));
  const either = listReferences(s, { type: "vision", limit: 200 });
  assert.ok(either.edges.length > 0 && either.edges.every((x) => x.from.type === "vision" || x.to.type === "vision"));
});

test("with no argument it pages through every edge, in one fixed order", () => {
  const nesting = s.entities.filter((e) => e.owner).length;
  const first = listReferences(s, { limit: 40 });
  assert.equal(first.page.total, s.edges.length + nesting);
  assert.equal(first.edges.length, 40);
  // Compared part by part: joined into one string, a name that is the start of another would
  // sort by whatever character the join put between them.
  const byParts = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const all = listReferences(s, { limit: 200 }).edges.map((x) => [x.from.id, x.via, x.to.id]);
  assert.deepEqual(all, [...all].sort(byParts), "sorted by from, via, to");
  const second = listReferences(s, { limit: 40, cursor: first.page.nextCursor });
  assert.deepEqual(second.edges[0], listReferences(s, { limit: 200 }).edges[40]);
});

test("a filter that matches nothing is an empty page, never an error", () => {
  const r = listReferences(s, { entity: DDD, via: "No.Such" });
  assert.deepEqual([r.edges, r.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
});

test("what cannot be answered is refused by code", () => {
  const code = (args) => { try { listReferences(s, args); } catch (e) { assert.ok(e instanceof ModelError); return [e.code, e.details]; } assert.fail("not refused"); };
  assert.deepEqual(code({ entity: "nothing/here" }), ["unknown_entity", { id: "nothing/here" }]);
  assert.equal(code({ type: "person" })[0], "unknown_type");
  assert.deepEqual(code({ direction: "out" }), ["invalid_argument", { argument: "direction", reason: "needs entity" }]);
  assert.deepEqual(code({ entity: DDD, direction: "sideways" }), ["invalid_argument", { argument: "direction", reason: "one of out, in, both" }]);
});

test("the reference instance's profile holds more edges than one page, and they walk", () => {
  const i = instanceSnapshot();
  const first = listReferences(i, { entity: "profiles/robert-blust", direction: "out" });
  assert.ok(first.page.hasMore);
  assert.equal(first.edges.length, 50);
});
