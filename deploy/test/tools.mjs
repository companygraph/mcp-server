// The structural facts a snapshot has to make true, read from the snapshot itself rather than
// typed here, so the same checks run over any instance's own model instead of one deployment's.
//
// What does not move: the company-of-one resolution and the LIKE MAGIC evidence row are
// mcp.blust.ch's own facts, not a rule every instance shares, so they stay in that deployment's
// own test file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isNewer } from "companygraph-meta-model/checks";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "companygraph-mcp-server";
import { listTypes, getEntity } from "companygraph-mcp-server/model";
import { ROOT, source, snapshot } from "../build/config.mjs";

export function registerToolsTests() {
  const src = source();
  const s = snapshot();
  const parser = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/companygraph-meta-model/package.json"), "utf8"));

  // The core release and how many types it holds are facts of the pin and the model, not of
  // this file: a number typed here stops being true on the next release and fails nothing until
  // someone reads it. The snapshot carries the schemas the instance was read with, and the
  // parser that read them is never older than they are: a release of the package alone moves
  // the parser and leaves core where it is, so the two may differ, and only a core ahead of its
  // parser is wrong. `isNewer` is the checker's own comparison of two releases, the one its
  // guard refuses with.
  test("the snapshot is the pinned commit of the pinned repository", () => {
    assert.equal(s.commit, src.commit);
    assert.equal(s.repo, src.repo);
    assert.ok(!isNewer(s.core.version, parser.version), `core ${s.core.version} is newer than the parser ${parser.version} that read it`);
    assert.equal(listTypes(s).types.length, s.schemas.length);
  });

  test("every type describes and lists, and one entity of each resolves", () => {
    for (const t of listTypes(s).types) {
      if (t.count === 0) continue;
      const { entity } = getEntity(s, t.type, s.entities.find((e) => e.type === t.type).name);
      assert.equal(entity.type, t.type);
      assert.ok(Array.isArray(entity.references) && Array.isArray(entity.referencedBy));
    }
  });

  test("every tool the server lists answers, and every answer carries the commit", async (t) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const { tools } = await client.listTools();
    const types = listTypes(s).types;
    const skill = s.entities.find((e) => e.type === "skill");
    // No count is held here: the list is the server's, and a tool it gains is called like the
    // rest. One it gains that this table has no arguments for fails by name, never in silence.
    const ARGS = { list_types: {}, describe_schema: { type: types[0]?.type }, describe_relations: {}, list_rules: {},
      describe_rule: { rule: "R4" }, list_checks: {}, list_entities: { type: types.find((x) => x.count > 0)?.type },
      get_entity: { type: "identity", name: s.root }, find_evidence: skill ? { skill: skill.name } : undefined,
      search: { query: "model" }, fetch: { id: "identity" } };
    assert.ok(tools.length > 0);
    for (const name of tools.map((x) => x.name)) {
      assert.ok(name in ARGS, `${name} is served and this test has no arguments to call it with`);
      // Ruling 5: an instance that claims no skill has nothing find_evidence could be asked
      // about, so the call itself is skipped rather than made up against a name that isn't there.
      if (name === "find_evidence" && !skill) {
        await t.test("find_evidence", (t2) => t2.skip("this instance claims no skill, so find_evidence has nothing to be asked"));
        continue;
      }
      const r = await client.callTool({ name, arguments: ARGS[name] });
      assert.equal(r.isError, undefined, name);
      assert.equal(r.structuredContent.model.commit, src.commit, name);
    }
    await client.close();
  });
}
