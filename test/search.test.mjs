// Two lists a client browses by: the entities of a type, and the entities a query finds. Both
// are bounded, both filter by owner, and search tells an exact name from words in a text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listEntities, search } from "../lib/model.mjs";
import { OUTPUTS } from "../lib/schemas.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";
import { exampleSnapshot, exampleFiles, withSharedName, withOwnedNameTwice, COMMIT, PARSER } from "./helpers.mjs";

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
  assert.equal(search(shared, "systems", { match: "name" }).page.total, 0, "a part of a name is no exact match");
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

// The two headlines the owner put to the chat, on a fixture built the way withSharedName builds
// its own, so the case waits on no re-pin of the reference instance. The example's words are
// counted: "in" and "open" fall short of half of its entities and are required, so both
// experiences carry them, and only one carries "ideas".
function withHeadlines() {
  const { files, schemas } = exampleFiles();
  files.set("values/decide-well-over-build-fast.md", "---\nsource: Local\n---\n\n# Decide well over build fast\n\n> A choice made once beats a feature shipped twice.\n\n## In practice\n\nWe write the decision down before the code.\n");
  files.set("profiles/nils-aker/nils-aker.md", "---\nsource: Local\nnature: human\n---\n\n# Nils Aker\n\n> Deciding well is the whole job.\n\n## Summary\n\nOne person.\n");
  files.set("profiles/nils-aker/experiences/2024-open-review.md", "---\nsource: Local\nkind: Role\nstart: 2024-01\n---\n\n# The open review\n\n> A year of reviews held where anyone could read them.\n\n## Achievements\n\n### Decisions\n\n- Put the validation of every number in front of the customer.\n\n### Results\n\n- Held the review in the open, on the list.\n- Two ideas from the list shipped.\n");
  files.set("profiles/nils-aker/experiences/2025-closed-review.md", "---\nsource: Local\nkind: Role\nstart: 2025-01\n---\n\n# The closed review\n\n> A year of reviews held in one room.\n\n## Achievements\n\n### Decisions\n\n- Put the validation of every number in front of the customer.\n\n### Results\n\n- Held the review in the open, on the list.\n");
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
}

// The boundary of common: the example's entities plus two more than their number, every added
// one holding "florp" and all but one of them "glorp", so florp stands in more than half of the
// whole and glorp in exactly half.
function withBoundary() {
  const { files, schemas } = exampleFiles();
  const n = exampleSnapshot().entities.length;
  for (let i = 0; i < n + 2; i++)
    files.set(`skills/boundary-${i}.md`, `---\nsource: Local\n---\n\n# Boundary ${i}\n\n> florp${i < n + 1 ? " glorp" : ""}.\n\n## In practice\n\nNothing.\n`);
  return { snapshot: buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER }), added: n + 2 };
}

test("Deciding well finds the value Decide well over build fast and the profile whose tagline says it", () => {
  const r = search(withHeadlines(), "Deciding well", { match: "words" });
  assert.equal(r.match, "words");
  assert.deepEqual(r.words, [{ word: "deciding", stem: "decid", common: false }, { word: "well", stem: "well", common: false }]);
  const value = r.results.find((x) => x.id === "values/decide-well-over-build-fast");
  const profile = r.results.find((x) => x.id === "profiles/nils-aker");
  assert.deepEqual(value.matched, [{ where: "name", key: null }]);
  assert.deepEqual(profile.matched, [{ where: "tagline", key: null }]);
  assert.equal(search(exampleSnapshot(), "Deciding well").results.length, 0, "the substring finds neither");
});

test("validated in the open finds the experience whose bullets hold validation, open and ideas, and not the one short of ideas", () => {
  const r = search(withHeadlines(), "validated in the open ideas", { match: "words" });
  assert.deepEqual(r.words.map((w) => [w.word, w.stem]), [["validated", "valid"], ["in", "in"], ["the", "the"], ["open", "open"], ["ideas", "idea"]]);
  // "in" was common while core 0.43.0's example entities held it past half of them; core 0.45.0's
  // question-kind and fourth question grow the example past that boundary again, and "in" falls
  // back to required. A common or required word is reported the same way, so the results below
  // are unmoved either way.
  assert.deepEqual(r.words.map((w) => w.common), [false, false, true, false, false]);
  assert.deepEqual(r.results.map((x) => x.id), ["profiles/nils-aker/experiences/2024-open-review"]);
  assert.deepEqual(r.results[0].matched, [{ where: "name", key: null }, { where: "section", key: "Achievements" }], "open in the name, the rest in the bullets");
});

test("a query whose stems occur nowhere is an empty page in words mode too", () => {
  const none = search(s, "zzzz qqqq", { match: "words" });
  assert.deepEqual([none.results, none.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
  assert.deepEqual(none.words.map((w) => w.common), [false, false]);
});

test("a stem in more than half of the entities is common and not required; one in exactly half is required", () => {
  const { snapshot, added } = withBoundary();
  const both = search(snapshot, "florp glorp", { match: "words", limit: 200 });
  assert.deepEqual(both.words, [{ word: "florp", stem: "florp", common: true }, { word: "glorp", stem: "glorp", common: false }]);
  assert.equal(both.page.total, added - 1, "every entity holding glorp, whether or not it also holds florp");
  const common = search(snapshot, "florp", { match: "words", limit: 200 });
  assert.deepEqual(common.words, [{ word: "florp", stem: "florp", common: true }]);
  assert.equal(common.page.total, added, "all common: the entities holding every one of them");
  for (const x of common.results) assert.deepEqual(x.matched, [{ where: "tagline", key: null }]);
});

test("words is in the query's order, absent in text mode, and the schema ties it to the mode", () => {
  const r = search(s, "billing deciding", { match: "words" });
  assert.deepEqual(r.words.map((w) => w.word), ["billing", "deciding"]);
  assert.ok(OUTPUTS.search.safeParse(JSON.parse(JSON.stringify(r))).success);
  const t = search(s, "billing");
  assert.equal("words" in t, false);
  assert.ok(OUTPUTS.search.safeParse(JSON.parse(JSON.stringify(t))).success);
  assert.ok(!OUTPUTS.search.safeParse({ ...t, words: [] }).success, "words under match text is refused");
  const { words: _, ...bare } = r;
  assert.ok(!OUTPUTS.search.safeParse(bare).success, "a words answer without words is refused");
  assert.ok(!OUTPUTS.search.safeParse({ ...t, match: "fuzzy" }).success);
});

test("a query with no words is refused on query, and the stems are never written into the snapshot", () => {
  assert.throws(() => search(s, "… — ...", { match: "words" }), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === "query");
  const before = JSON.stringify(s);
  search(s, "billing", { match: "words" });
  assert.equal(JSON.stringify(s), before);
  assert.equal(Object.keys(s.entities[0]).includes("stems"), false);
});

test("a word asked twice is reported twice, and common is counted over the whole instance whatever the filter keeps", () => {
  assert.deepEqual(search(s, "deciding deciding", { match: "words" }).words.map((w) => w.word), ["deciding", "deciding"]);
  const { snapshot } = withBoundary();
  const values = search(snapshot, "florp glorp", { match: "words", type: "value" });
  assert.deepEqual(values.words.map((w) => w.common), [true, false], "florp is common in the instance though no value holds it");
  assert.equal(values.page.total, 0);
});

test("a possessive asks for its noun, so the apostrophe narrows nothing", () => {
  const owned = search(s, "the company's billing", { match: "words" });
  const plain = search(s, "the company billing", { match: "words" });
  assert.deepEqual(owned.words.map((w) => w.word), ["the", "company", "billing"]);
  assert.deepEqual(owned.results.map((x) => x.id), plain.results.map((x) => x.id));
  assert.ok(owned.page.total > 0);
});
