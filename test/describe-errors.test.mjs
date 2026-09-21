// A client that speaks only the protocol is handed a schema for every answer and none for a
// refusal: a tool declares one output schema and an error result is exempt from it, so the codes
// and the keys of their details reached nobody who had not read the document or imported the
// package. `describe_errors` serves them, written from the one schema the suite holds refusals
// to, and what it serves is held here by a validator that is not the package's own hand: the
// served JSON Schema is read back and made to judge refusals the server really gives.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { z } from "zod";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer, GLOSSARY } from "../lib/server.mjs";
import { CODES, WHEN } from "../lib/errors.mjs";
import { checkAnswer } from "../lib/contract.mjs";
import { exampleSnapshot, withOwnedNameTwice } from "./helpers.mjs";

async function connect(s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "describe-errors", version: "0" });
  await client.connect(b);
  return client;
}

const described = async (client) => checkAnswer("describe_errors", await client.callTool({ name: "describe_errors", arguments: {} }));

test("describe_errors lists every code once, in the order of the closed list, each with its sentence", async () => {
  const s = exampleSnapshot();
  const answer = await described(await connect(s));
  assert.deepEqual(answer.errors.map((x) => x.code), CODES);
  for (const x of answer.errors) assert.equal(x.when, WHEN[x.code], x.code);
  assert.equal(answer.model.commit, s.commit);
});

test("the served schema judges real refusals: it takes each and refuses a made-up code or a missing key", async () => {
  const twice = withOwnedNameTwice();
  const client = await connect(twice.snapshot);
  const answer = await described(client);
  const whole = z.fromJSONSchema(answer.schema);
  const detailsOf = Object.fromEntries(answer.errors.map((x) => [x.code, z.fromJSONSchema(x.details)]));
  const CASES = [
    ["describe_schema", { type: "person" }, "unknown_type"],
    ["fetch", { id: "nothing/here" }, "unknown_entity"],
    ["get_entity", { type: "skill", name: "Knitting" }, "unknown_entity"],
    ["get_entity", { type: "experience", name: twice.title }, "ambiguous_name"],
    ["describe_rule", { rule: "R999" }, "unknown_rule"],
    ["search", { query: " " }, "invalid_argument"],
    ["list_entities", { type: "skill", cursor: "not-a-cursor" }, "invalid_cursor"],
  ];
  for (const [name, args, code] of CASES) {
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, true, name);
    assert.equal(r.structuredContent.error.code, code, name);
    assert.ok(whole.safeParse(r.structuredContent).success, `${code}: the served schema refuses a real refusal`);
    assert.ok(detailsOf[code].safeParse(r.structuredContent.error.details).success, `${code}: its details`);
  }
  const real = (await client.callTool({ name: "fetch", arguments: { id: "nothing/here" } })).structuredContent;
  assert.equal(whole.safeParse({ ...real, error: { ...real.error, code: "made_up" } }).success, false);
  assert.equal(whole.safeParse({ ...real, error: { ...real.error, details: {} } }).success, false);
  assert.equal(detailsOf.unknown_type.safeParse({ type: "person" }).success, false, "declared is required");
});

test("the document's table says when each code is raised in the words the tool serves", () => {
  const doc = fs.readFileSync(new URL("../docs/INTERFACE.md", import.meta.url), "utf8");
  for (const code of CODES) assert.ok(doc.includes(`| \`${code}\` | ${WHEN[code]} |`), code);
});

test("the instructions name the tool, where a client first reads that a refusal carries a code", () => {
  assert.match(GLOSSARY, /`error\.code`.*describe_errors/);
});
