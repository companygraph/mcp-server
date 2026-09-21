// Writes the examples of docs/INTERFACE.md from what the server answers over the worked example.
// Under each heading named below, the first `json` fence is replaced with the call and its
// answer; the prose around it is a person's and is never touched. An example is abbreviated by
// one rule, stated in the document: an array keeps its first two entries, a string its first 200
// characters, and `model` shows placeholder versions so that a parser re-pin is not a change to
// the document. Run by `npm run interface`; test/interface.test.mjs holds the file to it.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { exampleSnapshot, withOwnedNameTwice } from "../test/helpers.mjs";

const DDD = "skills/domain-driven-design";

// Heading text → the call shown under it. `ambiguous` runs on the fixture in which two owners
// each hold one title, which the worked example does not.
export const EXAMPLES = {
  "`list_types`": { name: "list_types", arguments: {} },
  "`describe_schema`": { name: "describe_schema", arguments: { type: "skill" } },
  "`describe_relations`": { name: "describe_relations", arguments: { type: "skill", direction: "declared-to" } },
  "`list_rules`": { name: "list_rules", arguments: {} },
  "`describe_rule`": { name: "describe_rule", arguments: { rule: "R4" } },
  "`list_checks`": { name: "list_checks", arguments: {} },
  "`describe_errors`": { name: "describe_errors", arguments: {} },
  "`list_entities`": { name: "list_entities", arguments: { type: "skill", limit: 2 } },
  "`get_entity`": { name: "get_entity", arguments: { id: DDD } },
  "`list_references`": { name: "list_references", arguments: { entity: "profiles/mira-halvorsen", direction: "in", via: "nested-in" } },
  "`find_evidence`": { name: "find_evidence", arguments: { skill: DDD } },
  "`search`": { name: "search", arguments: { query: "bounded context", limit: 2 } },
  "`fetch`": { name: "fetch", arguments: { id: DDD } },
  "A refusal": { name: "get_entity", ambiguous: true },
};

const abbreviate = (v) =>
  Array.isArray(v) ? v.slice(0, 2).map(abbreviate)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, abbreviate(x)]))
      : typeof v === "string" && v.length > 200 ? `${v.slice(0, 200)}…` : v;

async function connect(s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "interface", version: "0" });
  await client.connect(b);
  return client;
}

export async function render(text) {
  const plain = await connect(exampleSnapshot());
  const twice = withOwnedNameTwice();
  const ambiguous = await connect(twice.snapshot);
  let out = text;
  for (const [heading, example] of Object.entries(EXAMPLES)) {
    const args = example.ambiguous ? { type: "experience", name: twice.title } : example.arguments;
    const r = await (example.ambiguous ? ambiguous : plain).callTool({ name: example.name, arguments: args });
    const answer = abbreviate(r.structuredContent);
    answer.model = { ...answer.model, core: "0.0.0", parser: "v0.0.0" };
    const block = JSON.stringify({ tool: example.name, arguments: args, answer }, null, 2);
    const at = out.indexOf(`### ${heading}\n`);
    if (at < 0) throw new Error(`docs/INTERFACE.md has no heading "### ${heading}"`);
    const open = out.indexOf("```json\n", at);
    const next = out.indexOf("\n### ", at + 1);
    if (open < 0 || (next > 0 && open > next)) throw new Error(`"### ${heading}" has no json fence of its own`);
    const close = out.indexOf("\n```", open + 8);
    if (close < 0) throw new Error(`"### ${heading}" has no closing fence`);
    out = out.slice(0, open + 8) + block + out.slice(close);
  }
  await plain.close();
  await ambiguous.close();
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL("../docs/INTERFACE.md", import.meta.url);
  fs.writeFileSync(file, await render(fs.readFileSync(file, "utf8")));
}
