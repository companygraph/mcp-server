// Arguments that fail a tool's input schema were refused by the SDK before this package ran, as
// a sentence alone, so the one refusal a careless client meets most often was the one it could
// not branch on. They are refused here now, as `invalid_argument` with the argument and the
// reason, in the shape every other refusal has. The tool listing must not pay for that: a client
// is still handed each tool's true input schema, word for word what the SDK wrote before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { createServer } from "../lib/server.mjs";
import { TOOLS } from "../lib/tools.mjs";
import { checkAnswer } from "../lib/contract.mjs";
import { exampleSnapshot } from "./helpers.mjs";

async function connectTo(server) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "arguments", version: "0" });
  await client.connect(b);
  return client;
}

test("an argument of the wrong type, a missing one and a value outside an enumeration are refused with a code", async () => {
  const s = exampleSnapshot();
  const client = await connectTo(createServer(s));
  const CASES = [
    ["search", { query: { words: "billing" } }, "query"],
    ["search", { query: "billing", limit: "ten" }, "limit"],
    ["describe_schema", {}, "type"],
    ["fetch", undefined, "id"],
    ["list_references", { direction: "sideways" }, "direction"],
    ["describe_relations", { type: 7 }, "type"],
  ];
  for (const [name, args, argument] of CASES) {
    const where = `${name} ${JSON.stringify(args)}`;
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, true, where);
    const refusal = checkAnswer(name, r);
    assert.equal(refusal.error.code, "invalid_argument", where);
    assert.equal(refusal.error.details.argument, argument, where);
    assert.ok(refusal.error.details.reason.length > 0, where);
    assert.equal(refusal.error.message, r.content[0].text, where);
    assert.match(refusal.error.message, new RegExp(`\\b${argument}\\b`), where);
    assert.equal(refusal.model.commit, s.commit, where);
  }
});

test("two arguments at fault are both named in the sentence, and the first stands in the details", async () => {
  const client = await connectTo(createServer(exampleSnapshot()));
  const r = await client.callTool({ name: "search", arguments: { query: 1, match: "fuzzy" } });
  const refusal = checkAnswer("search", r);
  assert.equal(refusal.error.details.argument, "query");
  assert.match(refusal.error.message, /\bquery\b.*\bmatch\b/s);
});

test("a call within the schema is served as before, and an argument no schema names is still ignored", async () => {
  const client = await connectTo(createServer(exampleSnapshot()));
  const r = await client.callTool({ name: "search", arguments: { query: "billing", limit: 1, colour: "red" } });
  assert.equal(r.isError, undefined);
  assert.equal(checkAnswer("search", r).page.returned, 1);
});

test("the listing still hands out each tool's true input schema, as the SDK writes it from the same schema", async () => {
  const plain = new McpServer({ name: "plain", version: "0" });
  for (const t of TOOLS) plain.registerTool(t.name, { description: t.description, inputSchema: t.input, outputSchema: t.output }, async () => ({ content: [] }));
  const expected = (await (await connectTo(plain)).listTools()).tools;
  const listed = (await (await connectTo(createServer(exampleSnapshot()))).listTools()).tools;
  assert.deepEqual(listed.map((t) => [t.name, t.inputSchema]), expected.map((t) => [t.name, t.inputSchema]));
  assert.ok(listed.find((t) => t.name === "search").inputSchema.required.includes("query"));
});
