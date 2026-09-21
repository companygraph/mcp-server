// The interface as a client meets it: every tool called through a real client, every answer
// parsed here against the schema the tool declares, so a failure names the field rather than
// surfacing as the SDK's protocol error. Empty results, every refusal and every page are held
// the same way, on the worked example and on the reference instance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { OUTPUTS, ErrorResult } from "../lib/schemas.mjs";
import { CODES } from "../lib/errors.mjs";
import { sampleCalls, checkAnswer } from "../lib/contract.mjs";
import { exampleSnapshot, instanceSnapshot, withOwnedNameTwice } from "./helpers.mjs";

async function connect(s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "contract", version: "0" });
  await client.connect(b);
  return client;
}

const FIXTURES = [["the worked example", exampleSnapshot()], ["the reference instance", instanceSnapshot()]];
// Every code a refusal below is seen to carry, so the last test can say none went unmet.
const reached = new Set();
const EMPTY_PAGE = { total: 0, returned: 0, hasMore: false, nextCursor: null };
const LISTS = { list_entities: "entities", list_references: "edges", search: "results" };
const largestType = (s) => {
  const counts = new Map();
  for (const e of s.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

for (const [label, s] of FIXTURES) {
  test(`${label}: every tool's answer satisfies the schema it declares`, async () => {
    const client = await connect(s);
    const { tools } = await client.listTools();
    const calls = sampleCalls(s);
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(OUTPUTS).sort(), "a tool without a schema, or a schema without a tool");
    assert.deepEqual(Object.keys(calls).sort(), Object.keys(OUTPUTS).sort(), "a tool without a sample call");
    for (const { name } of tools) {
      assert.ok(calls[name] !== undefined, `${name}: this fixture gives it something to be asked about`);
      const r = await client.callTool({ name, arguments: calls[name] });
      assert.equal(r.isError, undefined, `${name}: ${r.content[0].text}`);
      assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent, name);
      checkAnswer(name, r);
    }
    await client.close();
  });

  test(`${label}: an empty result still carries its arrays and its page`, async () => {
    const client = await connect(s);
    const found = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: "zzzz-nothing-holds-this" } }));
    assert.deepEqual([found.results, found.page], [[], EMPTY_PAGE]);
    const named = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: "zzzz-nothing-holds-this", match: "name" } }));
    assert.deepEqual([named.results, named.page], [[], EMPTY_PAGE]);
    const edges = checkAnswer("list_references", await client.callTool({ name: "list_references", arguments: { entity: s.rootId, via: "No.Such" } }));
    assert.deepEqual([edges.edges, edges.page], [[], EMPTY_PAGE]);
    const owned = checkAnswer("list_entities", await client.callTool({ name: "list_entities", arguments: { type: largestType(s), owner: s.rootId } }));
    assert.deepEqual([owned.entities, owned.page], [[], EMPTY_PAGE], "the identity owns nothing of the largest type");
    const none = checkAnswer("describe_relations", await client.callTool({ name: "describe_relations", arguments: { via: "No.Such" } }));
    assert.deepEqual([none.relations, none.enums], [[], []]);
    await client.close();
  });

  test(`${label}: a walk over the pages is the whole list, at any page size`, async () => {
    const client = await connect(s);
    async function walk(name, args, limit) {
      const all = [];
      let cursor, total, pages = 0;
      do {
        const a = checkAnswer(name, await client.callTool({ name, arguments: { ...args, limit, ...(cursor ? { cursor } : {}) } }));
        assert.equal(a.page.returned, a[LISTS[name]].length, name);
        assert.ok(a.page.returned <= limit, name);
        assert.equal(a.page.hasMore, a.page.nextCursor !== null, name);
        total ??= a.page.total;
        assert.equal(a.page.total, total, name);
        all.push(...a[LISTS[name]]);
        cursor = a.page.nextCursor;
        assert.ok(++pages < 5000, "the walk ends");
      } while (cursor);
      assert.equal(all.length, total, name);
      return all;
    }
    for (const [name, args] of [["list_entities", { type: largestType(s) }], ["search", { query: "a" }], ["list_references", {}]]) {
      const small = await walk(name, args, 2);
      const large = await walk(name, args, 200);
      assert.ok(small.length > 2, `${name} spans more than one small page here`);
      assert.deepEqual(small, large, `${name}: the same list whatever the page size`);
      if (name !== "list_references") assert.equal(new Set(small.map((x) => x.id)).size, small.length, `${name}: nothing twice`);
    }
    await client.close();
  });

  test(`${label}: every refusal carries its code, its details and the sentence, in the error schema`, async () => {
    const client = await connect(s);
    const type = largestType(s);
    const other = await connect({ ...s, commit: "f".repeat(40) });
    const theirs = checkAnswer("list_entities", await other.callTool({ name: "list_entities", arguments: { type, limit: 1 } })).page.nextCursor;
    assert.equal(typeof theirs, "string");
    const CASES = [
      ["describe_schema", { type: "person" }, "unknown_type", (d) => d.type === "person" && d.declared.includes("skill")],
      ["list_entities", { type: "person" }, "unknown_type", (d) => d.type === "person"],
      ["get_entity", { type: "skill", name: "Knitting" }, "unknown_entity", (d) => d.type === "skill" && d.name === "Knitting"],
      ["get_entity", { id: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["fetch", { id: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["list_references", { entity: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["find_evidence", { skill: "Knitting" }, "unknown_entity", (d) => d.name === "Knitting"],
      ["describe_rule", { rule: "R999" }, "unknown_rule", (d) => d.rule === "R999" && d.rules.includes("R4")],
      ["get_entity", {}, "invalid_argument", (d) => d.argument === "id"],
      ["search", { query: "   " }, "invalid_argument", (d) => d.argument === "query"],
      ["list_references", { direction: "out" }, "invalid_argument", (d) => d.argument === "direction"],
      ["describe_relations", { direction: "declares" }, "invalid_argument", (d) => d.argument === "direction"],
      ["list_entities", { type, cursor: "not-a-cursor" }, "invalid_cursor", (d) => d.reason === "malformed"],
      ["list_entities", { type, cursor: theirs }, "invalid_cursor", (d) => d.reason === "other_commit"],
    ];
    for (const [name, args, code, holds] of CASES) {
      const r = await client.callTool({ name, arguments: args });
      const where = `${name} ${JSON.stringify(args)}`;
      assert.equal(r.isError, true, where);
      const refusal = checkAnswer(name, r);
      assert.equal(refusal.error.code, code, where);
      reached.add(refusal.error.code);
      assert.equal(refusal.error.message, r.content[0].text, where);
      assert.ok(holds(refusal.error.details), `${where}: ${JSON.stringify(refusal.error.details)}`);
      assert.equal(refusal.model.commit, s.commit, where);
    }
    await client.close();
    await other.close();
  });
}

test("an ambiguous name is refused with every candidate's id, and each id then answers", async () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const client = await connect(snapshot);
  const r = await client.callTool({ name: "get_entity", arguments: { type: "experience", name: title } });
  assert.equal(r.isError, true);
  const { error } = checkAnswer("get_entity", r);
  assert.deepEqual([error.code, error.rule, error.details.type, error.details.name], ["ambiguous_name", "R2", "experience", title]);
  reached.add(error.code);
  assert.deepEqual(error.details.candidates.map((c) => c.owner).sort(), [...owners].sort());
  for (const c of error.details.candidates) {
    const one = checkAnswer("get_entity", await client.callTool({ name: "get_entity", arguments: { id: c.id } }));
    assert.deepEqual([one.entity.id, one.entity.owner], [c.id, c.owner]);
  }
  await client.close();
});

test("a snapshot that predates what a tool reads is refused by code", async () => {
  const { checks, ...old } = exampleSnapshot();
  const client = await connect(old);
  const { error } = checkAnswer("list_checks", await client.callTool({ name: "list_checks", arguments: {} }));
  assert.deepEqual([error.code, error.details], ["unsupported_snapshot", { missing: "checks" }]);
  reached.add(error.code);
  await client.close();
});

// Tests in one file run in the order written, so every refusal above has been seen by now.
test("the refusals above carried every code, so a code added meets a case or fails here", () => {
  assert.deepEqual([...reached].sort(), [...CODES].sort());
});

// A schema that accepts anything passes every test above. Each one is shown a real answer with a
// required field gone, and one with a field of the wrong type, and has to refuse both.
test("every schema refuses a missing field, a wrong type and a field nobody declared", async () => {
  const s = exampleSnapshot();
  const client = await connect(s);
  const calls = sampleCalls(s);
  for (const name of Object.keys(OUTPUTS)) {
    const good = (await client.callTool({ name, arguments: calls[name] })).structuredContent;
    assert.ok(OUTPUTS[name].safeParse(good).success, name);
    for (const key of Object.keys(good)) {
      const { [key]: gone, ...rest } = good;
      assert.ok(!OUTPUTS[name].safeParse(rest).success, `${name} accepts an answer without ${key}`);
    }
    assert.ok(!OUTPUTS[name].safeParse({ ...good, model: { ...good.model, core: 7 } }).success, `${name} accepts a number for model.core`);
    assert.ok(!OUTPUTS[name].safeParse({ ...good, undeclared: true }).success, `${name} accepts a field nobody declared`);
  }
  const listed = (await client.callTool({ name: "list_entities", arguments: calls.list_entities })).structuredContent;
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [{ ...listed.entities[0], id: 7 }] }).success, "an id that is a number");
  const { id, ...nameless } = listed.entities[0];
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [nameless] }).success, "an entity without its id");
  const refused = (await client.callTool({ name: "get_entity", arguments: { id: "nothing/here" } })).structuredContent;
  assert.ok(ErrorResult.safeParse(refused).success);
  assert.ok(!ErrorResult.safeParse({ ...refused, error: { ...refused.error, code: "not_a_code" } }).success);
  const { code, ...codeless } = refused.error;
  assert.ok(!ErrorResult.safeParse({ ...refused, error: codeless }).success);
  await client.close();
});

test("checkAnswer itself fails with the tool and the field named", () => {
  assert.throws(() => checkAnswer("fetch", { structuredContent: { id: "a", title: "A", type: "t", url: null, model: {} } }), /fetch[\s\S]*text/);
  assert.throws(() => checkAnswer("no_such_tool", { structuredContent: {} }), /no_such_tool/);
});
