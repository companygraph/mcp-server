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
import { listTypes, describeSchema, listEntities, getEntityById } from "companygraph-mcp-server/model";
import { sampleCalls, checkAnswer } from "companygraph-mcp-server/contract";
import { ROOT, source, snapshot } from "../build/config.mjs";

/** @import { SnapshotEntity } from "../../lib/snapshot.mjs" */

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
      assert.equal(describeSchema(s, t.type).type, t.type);
      assert.equal(listEntities(s, t.type).page.total, t.count, `${t.type} lists as many entities as list_types counts`);
      if (t.count === 0) continue;
      const { entity } = getEntityById(s, /** @type {SnapshotEntity} */ (s.entities.find((e) => e.type === t.type)).id);
      assert.equal(entity.type, t.type);
      assert.ok(Array.isArray(entity.references) && Array.isArray(entity.referencedBy));
    }
  });

  test("every tool the server lists answers inside its schema, and every answer carries the commit", async (t) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    assert.equal(/** @type {{ title?: string }} */ (client.getServerVersion()).title, s.root);
    const { tools } = await client.listTools();
    // No count and no argument is held here: the list is the server's and the arguments are read
    // from this snapshot by the package that declares the tools. A tool it gains with no sample
    // call fails by name, never in silence.
    const calls = /** @type {Record<string, Record<string, unknown> | undefined>} */ (sampleCalls(s));
    assert.ok(tools.length > 0);
    for (const name of tools.map((x) => x.name)) {
      assert.ok(name in calls, `${name} is served and the package ships no sample call for it`);
      // Ruling 5: the skip covers every tool whose sample call above is undefined — find_evidence
      // where the instance claims no skill, list_rules and describe_rule where its core ships no
      // rules, list_checks where the snapshot carries no checks — each skipped by name rather
      // than made up against something that isn't there.
      if (calls[name] === undefined) {
        await t.test(name, (t2) => t2.skip(`this instance gives ${name} nothing to be asked about`));
        continue;
      }
      const r = await client.callTool({ name, arguments: calls[name] });
      assert.equal(r.isError, undefined, name);
      assert.equal(checkAnswer(name, r).model.commit, src.commit, name);
    }
    await client.close();
  });

  // The mode reaches a deployment with a re-pin and nothing else, so each holds it against the
  // model it serves: the identity's own name, word by word, finds the identity.
  test("a search by words finds the identity by its own name over this snapshot", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const root = /** @type {SnapshotEntity} */ (s.entities.find((e) => e.id === s.rootId));
    const r = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: root.name, match: "words", type: root.type } }));
    assert.equal(r.match, "words");
    assert.ok(r.words.length > 0 && r.words.every((/** @type {{ stem: unknown; common: unknown }} */ w) => typeof w.stem === "string" && typeof w.common === "boolean"));
    assert.ok(r.results.some((/** @type {{ id: string }} */ x) => x.id === s.rootId));
    await client.close();
  });

  // The order reaches a deployment with a re-pin and nothing else, so each holds it against the
  // model it serves. An instance whose ids carry no time is told so, and skips rather than fails.
  test("list_entities by newest starts with the latest moment over this snapshot", async (t) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const r = await client.callTool({ name: "list_entities", arguments: { order: "newest", limit: 200 } });
    if (r.isError) {
      assert.equal(checkAnswer("list_entities", r).error.code, "no_creation_time");
      await client.close();
      return t.skip("this instance's ids carry no time");
    }
    const answer = checkAnswer("list_entities", r);
    const times = answer.entities.map((/** @type {{ created?: string }} */ e) => e.created).filter(Boolean);
    assert.ok(times.length > 1, "more than one entity carries a moment, so there is an order to hold");
    for (let i = 1; i < times.length; i++) assert.ok(times[i - 1] >= times[i], `${times[i - 1]} comes before the later ${times[i]}`);
    await client.close();
  });

  // A context map reaches a deployment with a re-pin, so each holds it against the model it
  // serves. An instance without the software pack is told so, and skips rather than fails.
  test("every bounded context draws its map, contexts only, each arrow labeled by a pattern", async (t) => {
    const contexts = s.entities.filter((e) => e.type === "bounded-context");
    if (!contexts.length) return t.skip("this instance holds no bounded context");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    for (const c of contexts) {
      const d = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape: "context", id: c.id } }));
      assert.ok(!d.error, `${c.name}: the map is drawn, not refused`);
      assert.ok(d.nodes.every((/** @type {{ type: string }} */ n) => n.type === "bounded-context"), c.name);
      for (const l of d.links) assert.match(l.label, /^(U → D · .+|partnership|shared kernel|separate ways)$/, `${c.name}: ${l.label}`);
    }
    await client.close();
  });

  // A flow and a lifecycle read tables an instance may not yet write, so a context whose aggregates
  // hold none is refused as empty and every other answers in its shape.
  test("every bounded context answers its flow and its lifecycle, or says it has nothing to draw", async (t) => {
    const contexts = s.entities.filter((e) => e.type === "bounded-context");
    if (!contexts.length) return t.skip("this instance holds no bounded context");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    for (const c of contexts) {
      for (const shape of ["flow", "lifecycle"]) {
        const d = checkAnswer("diagram", await client.callTool({ name: "diagram", arguments: { shape, id: c.id } }));
        if (d.error) assert.deepEqual([d.error.code, d.error.details.reason], ["cannot_draw", "empty"], `${c.name} ${shape}`);
        else assert.ok(d.mermaid.startsWith(shape === "flow" ? "sequenceDiagram" : "stateDiagram-v2"), `${c.name} ${shape}`);
      }
    }
    await client.close();
  });
}
