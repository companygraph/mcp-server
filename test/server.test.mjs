import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { exampleSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER };

async function connect(snapshot = s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(snapshot).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  return client;
}

test("the server names itself from the package and the model", async () => {
  const client = await connect();
  assert.deepEqual(client.getServerVersion(), { name: pkg.name, version: pkg.version, title: "Beacon Systems" });
  const identity = s.entities.find((e) => e.id === "identity");
  const vision = s.entities.find((e) => e.type === "vision");
  assert.equal(client.getInstructions(), `${vision.tagline}\n\n${identity.tagline}\n\nThis server reports what the model says at one commit, which every answer names under \`model\`, and adds nothing.`);
});

// A client reads the instructions once, when the connection is set up, and may keep that copy
// for as long as the connector exists. A commit or a core version written there is then read
// beside answers that name a later one, and the two disagree with nothing to say which is old.
test("the instructions name no commit and no version, which a client would keep past their time", async () => {
  const client = await connect();
  const text = client.getInstructions();
  assert.ok(!text.includes(COMMIT), "the commit");
  assert.ok(!text.includes(EXAMPLE_CORE), "the core version");
  assert.ok(!text.includes(pkg.version), "the package version");
});

test("the tools, by their exact names", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["describe_relations", "describe_rule", "describe_schema", "fetch", "find_evidence", "get_entity", "list_checks", "list_entities", "list_references", "list_rules", "list_types", "search"]);
  for (const t of tools) assert.ok(t.description.length > 20, t.name);
});

test("every tool returns structured content carrying the model", async () => {
  const client = await connect();
  const calls = [
    ["list_types", {}], ["describe_schema", { type: "skill" }], ["describe_relations", {}], ["list_rules", {}],
    ["describe_rule", { rule: "R4" }], ["list_checks", {}], ["list_entities", { type: "skill" }],
    ["get_entity", { type: "skill", name: "Domain-Driven Design" }], ["list_references", { entity: "skills/domain-driven-design" }],
    ["find_evidence", { skill: "Domain-Driven Design" }],
    ["search", { query: "billing" }], ["fetch", { id: "skills/domain-driven-design" }],
  ];
  // Every tool the server lists is called here, so one it gains cannot go without.
  const { tools } = await client.listTools();
  assert.deepEqual(calls.map(([name]) => name).sort(), tools.map((t) => t.name).sort());
  for (const [name, args] of calls) {
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, undefined, name);
    assert.deepEqual(r.structuredContent.model, MODEL, name);
    assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent, name);
  }
});

test("a refusal is a tool error: its sentence as text, and the same refusal as data", async () => {
  const client = await connect();
  const r = await client.callTool({ name: "get_entity", arguments: { type: "skill", name: "Beacon Systems" } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /R4/);
  assert.deepEqual(r.structuredContent, { error: { code: "unknown_entity", message: r.content[0].text, rule: "R4", details: { type: "skill", name: "Beacon Systems" } }, model: MODEL });
});

test("the listing carries each tool's own output schema", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  const entities = tools.find((t) => t.name === "list_entities").outputSchema;
  assert.deepEqual(entities.required.sort(), ["entities", "model", "page", "type"]);
  assert.equal(entities.additionalProperties, false);
  assert.ok(tools.every((t) => t.outputSchema.required.includes("model")));
});

test("a model without a vision still has instructions", async () => {
  const bare = { ...s, entities: s.entities.filter((e) => e.type !== "vision"), edges: s.edges.filter((e) => !e.from.startsWith("vision") && !e.to.startsWith("vision")) };
  const client = await connect(bare);
  assert.ok(client.getInstructions().startsWith(s.entities.find((e) => e.id === "identity").tagline));
});
