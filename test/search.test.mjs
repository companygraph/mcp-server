// Two lists a client browses by: the entities of a type, and the entities a query finds. Both
// are bounded, both filter by owner, and search tells an exact name from words in a text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listEntities, search } from "../lib/model.mjs";
import { exampleSnapshot, withSharedName, withOwnedNameTwice } from "./helpers.mjs";

const s = exampleSnapshot();
const MIRA = "profiles/mira-halvorsen";

test("list_entities pages, names each entry's type and keeps one owner's entities", () => {
  const all = listEntities(s, "skill");
  assert.deepEqual(Object.keys(all.entities[0]), ["id", "type", "name", "tagline", "owner"]);
  assert.deepEqual([all.entities[0].type, all.entities[0].owner], ["skill", null]);
  assert.equal(all.page.total, s.entities.filter((e) => e.type === "skill").length);
  const first = listEntities(s, "skill", { limit: 1 });
  assert.deepEqual([first.entities.length, first.page.hasMore], [1, true]);
  assert.equal(listEntities(s, "skill", { limit: 1, cursor: first.page.nextCursor }).entities[0].id, all.entities[1].id);
  const hers = listEntities(s, "experience", { owner: MIRA });
  assert.ok(hers.entities.length >= 1 && hers.entities.every((e) => e.owner === MIRA));
  assert.ok(hers.page.total < listEntities(s, "experience").page.total);
  assert.throws(() => listEntities(s, "experience", { owner: "nothing/here" }), (e) => e instanceof ModelError && e.code === "unknown_entity");
});

test("matched says where a query hit, in one form", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.equal(r.match, "text");
  const mira = r.results.find((x) => x.id === MIRA);
  assert.ok(mira.matched.some((m) => m.where === "table" && m.key === "Evidence"));
  assert.deepEqual([mira.title, mira.type, mira.owner], ["Mira Halvorsen", "profile", null]);
  const byName = search(s, "domain-driven").results.find((x) => x.id === "skills/domain-driven-design");
  assert.deepEqual(byName.matched.find((m) => m.where === "name"), { where: "name", key: null });
  for (const x of r.results) for (const m of x.matched) {
    assert.ok(["name", "tagline", "field", "section", "table"].includes(m.where));
    assert.equal(m.key === null, m.where === "name" || m.where === "tagline");
  }
  assert.equal(r.total, undefined, "the count lives in page");
  assert.equal(r.page.total, r.results.length);
});

test("match name is the exact canonical name, case-insensitive, across types", () => {
  const shared = withSharedName();
  const r = search(shared, "beacon systems", { match: "name" });
  assert.deepEqual(r.results.map((x) => x.type), ["identity", "profile"]);
  assert.ok(r.results.every((x) => x.matched.length === 1 && x.matched[0].where === "name"));
  assert.equal(search(shared, "beacon", { match: "name" }).page.total, 0, "a part of a name is no exact match");
  assert.deepEqual(search(shared, "Beacon Systems", { match: "name", type: "profile" }).results.map((x) => x.type), ["profile"]);
});

test("a title two owners hold is found under each, and owner keeps one", () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const both = search(snapshot, title, { match: "name", type: "experience" });
  assert.deepEqual(both.results.map((x) => x.owner).sort(), [...owners].sort());
  const one = search(snapshot, title, { match: "name", owner: owners[0] });
  assert.deepEqual(one.results.map((x) => x.owner), [owners[0]]);
});

test("search pages in a fixed order, and nothing found is an empty page", () => {
  const all = search(s, "a", { limit: 200 });
  // Compared part by part: joined into one string, "Foo" and "Foo Bar" would sort by the comma.
  const byParts = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const keys = all.results.map((x) => [x.type, x.title, x.id]);
  assert.deepEqual(keys, [...keys].sort(byParts));
  const first = search(s, "a", { limit: 5 });
  assert.deepEqual(first.page, { total: all.page.total, returned: 5, hasMore: true, nextCursor: first.page.nextCursor });
  assert.equal(search(s, "a", { limit: 5, cursor: first.page.nextCursor }).results[0].id, all.results[5].id);
  const none = search(s, "zzzz-nothing");
  assert.deepEqual([none.results, none.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
});

test("what search cannot take is refused by code", () => {
  assert.throws(() => search(s, "x", { match: "fuzzy" }), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === "match");
  assert.throws(() => search(s, "x", { type: "person" }), (e) => e instanceof ModelError && e.code === "unknown_type");
  assert.throws(() => search(s, "x", { owner: "nothing/here" }), (e) => e instanceof ModelError && e.code === "unknown_entity");
});
