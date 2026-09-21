// A description is read by a model choosing a tool, every time, so it is short and built one
// way: purpose, when to use it and which sibling instead, inputs, the answer's shape, limits.
// The terms it leans on are defined once, in the instructions, and used without ceremony.
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { TOOLS } from "../lib/tools.mjs";
import { listEntities } from "../lib/model.mjs";
import { GLOSSARY, instructionsFor } from "../lib/server.mjs";
import { exampleSnapshot } from "./helpers.mjs";

const words = (text) => text.split(/\s+/).filter(Boolean).length;
const of = (name) => TOOLS.find((t) => t.name === name).description;

test("every description is at most sixty words and says what comes back", () => {
  for (const t of TOOLS) {
    assert.ok(words(t.description) <= 60, `${t.name} runs to ${words(t.description)} words`);
    assert.match(t.description, /Returns /, t.name);
  }
});

test("the two retrieval tools each say when, and name the other", () => {
  assert.match(of("get_entity"), /structured/);
  assert.match(of("get_entity"), /\bfetch\b/);
  assert.match(of("fetch"), /as written/);
  assert.match(of("fetch"), /\bget_entity\b/);
});

test("a paged tool says how to continue, and a tool with a sibling names it", () => {
  for (const name of ["list_entities", "list_references", "find_evidence", "search"]) assert.match(of(name), /`cursor`/, name);
  assert.match(of("list_entities"), /\bsearch\b/);
  assert.match(of("describe_relations"), /\bdescribe_schema\b/);
  assert.match(of("describe_schema"), /\bdescribe_relations\b/);
  assert.match(of("list_rules"), /\bdescribe_rule\b/);
});

test("describe_relations names direction as one side of relations, not a narrower it shares with every list", () => {
  assert.match(of("describe_relations"), /one side of relations/);
  assert.doesNotMatch(of("describe_relations"), /narrow every list/);
});

test("the terms are defined once, in the instructions, before the sentence on provenance", () => {
  for (const term of ["id", "canonical name", "owner", "`via`", "reference", "qualifier"]) assert.ok(GLOSSARY.includes(term), term);
  const text = instructionsFor(exampleSnapshot());
  assert.ok(text.indexOf(GLOSSARY) > 0);
  assert.ok(text.indexOf(GLOSSARY) < text.indexOf("This server reports"));
});

// A client that reads only the tool listing meets `limit` and `cursor` as bare arguments, and a
// limit outside the range is served at the nearest bound and never refused, so `limit: 0` comes
// back as one entry with nothing to say why. The arguments say it themselves, in the schema
// every client is handed, in one wording on every paged tool; and what they say is held to
// what the server does.
test("limit and cursor describe themselves, identically on every paged tool, and truly", () => {
  const paged = TOOLS.filter((t) => "limit" in t.input.shape);
  assert.deepEqual(paged.map((t) => t.name).sort(), ["find_evidence", "list_entities", "list_references", "search"]);
  const said = paged.map((t) => z.toJSONSchema(t.input).properties).map((p) => [p.limit.description, p.cursor.description]);
  for (const [limit, cursor] of said) {
    assert.deepEqual([limit, cursor], said[0]);
    assert.match(limit, /50 by default, clamped to 1–200, so 0 returns one entry and 1000 returns 200/);
    assert.match(cursor, /page\.nextCursor.*same arguments.*first page/);
  }
  const s = exampleSnapshot();
  const type = s.entities[0].type;
  assert.equal(listEntities(s, type, { limit: 0 }).entities.length, 1);
  assert.equal(listEntities(s, type, { limit: 1000 }).page.returned, Math.min(200, listEntities(s, type).page.total));
});

