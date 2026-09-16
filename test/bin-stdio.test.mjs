import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fixtureRoot } from "./helpers.mjs";

const bin = new URL("../bin/stdio.mjs", import.meta.url).pathname;

test("the stdio server lists seven tools and answers with the model", async () => {
  const transport = new StdioClientTransport({ command: "node", args: [bin, path.join(fixtureRoot, "example/model"), path.join(fixtureRoot, "core"), "--sub", "example/model/"] });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  const r = await client.callTool({ name: "list_types", arguments: {} });
  assert.equal(r.structuredContent.model.core, "0.25.2");
  assert.equal(r.structuredContent.types.length, 15);
  await client.close();
});
