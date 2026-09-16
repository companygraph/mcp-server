import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
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

async function commitOf(modelDir) {
  const transport = new StdioClientTransport({ command: "node", args: [bin, modelDir, path.join(fixtureRoot, "core"), "--sub", "model/"] });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  const r = await client.callTool({ name: "list_types", arguments: {} });
  await client.close();
  return r.structuredContent.model.commit;
}

test("a dirty tree reports no commit; a clean one reports HEAD", async () => {
  const modelDir = fs.mkdtempSync(path.join(os.tmpdir(), "stdio-dirty-"));
  fs.cpSync(path.join(fixtureRoot, "example/model"), modelDir, { recursive: true });
  const git = (...args) => execFileSync("git", ["-C", modelDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("-c", "user.email=test@example.com", "-c", "user.name=Test", "add", "-A");
  git("-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-q", "-m", "the model at one commit");
  const head = git("rev-parse", "HEAD").trim();
  assert.equal(await commitOf(modelDir), head);

  fs.appendFileSync(path.join(modelDir, "identity.md"), "\n");
  assert.equal(await commitOf(modelDir), null);
});
