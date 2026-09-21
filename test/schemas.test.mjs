// Each tool declares what it answers, and the server registers exactly that. The answers here
// come from the queries directly; test/contract.test.mjs holds them through a client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPUTS, ErrorResult, Edge, Page, Stamp } from "../lib/schemas.mjs";
import { TOOLS } from "../lib/tools.mjs";
import * as model from "../lib/model.mjs";
import { exampleSnapshot, instanceSnapshot } from "./helpers.mjs";

test("every tool has an output schema, and no schema is left without a tool", () => {
  assert.deepEqual(Object.keys(OUTPUTS).sort(), TOOLS.map((t) => t.name).sort());
  for (const t of TOOLS) assert.equal(t.output, OUTPUTS[t.name], t.name);
});

test("the queries' own answers satisfy their schemas, on both fixtures", () => {
  for (const s of [exampleSnapshot(), instanceSnapshot()]) {
    const answers = {
      list_types: model.listTypes(s), describe_schema: model.describeSchema(s, "profile"), describe_relations: model.describeRelations(s),
      list_rules: model.listRules(s), describe_rule: model.describeRule(s, "R4"), list_checks: model.listChecks(s),
      list_entities: model.listEntities(s, "experience"), get_entity: model.getEntityById(s, s.entities.find((e) => e.type === "experience").id),
      list_references: model.listReferences(s, {}), find_evidence: model.findEvidence(s, s.entities.find((e) => e.type === "skill").id),
      search: model.search(s, "a"), fetch: model.fetchEntity(s, "identity"),
    };
    assert.deepEqual(Object.keys(answers).sort(), Object.keys(OUTPUTS).sort());
    for (const [name, answer] of Object.entries(answers)) {
      const parsed = OUTPUTS[name].safeParse(JSON.parse(JSON.stringify(answer)));
      assert.ok(parsed.success, `${name}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`);
    }
  }
});

test("a closed shape refuses what it does not declare, and an open one allows it", () => {
  const ref = { id: "a", type: "t", name: "A" };
  assert.ok(Edge.safeParse({ from: ref, via: "f", to: ref, attrs: { Level: ref, Note: "x" } }).success);
  assert.ok(!Edge.safeParse({ from: ref, via: "f", to: ref, attrs: {}, extra: 1 }).success);
  assert.ok(!Edge.safeParse({ from: ref, via: "f", to: { id: "a", type: "t" }, attrs: {} }).success);
  assert.ok(!Page.safeParse({ total: 1, returned: 1, hasMore: false }).success, "nextCursor is required, null when there is none");
});

// The parser attaches a stamp when either `kind` or `start` is set, never only when both are, so
// an entity with a start and no kind, or a kind and no start, legitimately carries a stamp with
// null in the other field; a schema that required both would refuse those real answers.
test("a stamp may lack its kind or its start, since the parser attaches one when either is set", () => {
  assert.ok(Stamp.safeParse({ kind: null, start: "2020-01", end: null }).success);
  assert.ok(Stamp.safeParse({ kind: "Role", start: null, end: null }).success);
  assert.ok(!Stamp.safeParse({ kind: 7, start: "2020-01", end: null }).success);
  assert.ok(!Stamp.safeParse({ kind: "Role", start: "2020-01" }).success, "end is required");
});

test("the error schema fixes the details of each code", () => {
  const model_ = { commit: null, repo: null, core: "0.0.0", parser: "v0" };
  const err = (code, details, rule = null) => ({ error: { code, message: "m", rule, details }, model: model_ });
  assert.ok(ErrorResult.safeParse(err("unknown_type", { type: "x", declared: ["a"] })).success);
  assert.ok(ErrorResult.safeParse(err("unknown_entity", { id: "x" })).success);
  assert.ok(ErrorResult.safeParse(err("unknown_entity", { type: "t", name: "n" }, "R4")).success);
  const two = [{ id: "o/a", type: "t", name: "n", owner: "o" }, { id: "p/a", type: "t", name: "n", owner: "p" }];
  assert.ok(ErrorResult.safeParse(err("ambiguous_name", { type: "t", name: "n", candidates: two }, "R2")).success);
  assert.ok(!ErrorResult.safeParse(err("ambiguous_name", { type: "t", name: "n", candidates: two.slice(0, 1) }, "R2")).success, "one candidate is no ambiguity");
  assert.ok(!ErrorResult.safeParse(err("ambiguous_name", { type: "t", name: "n" })).success, "candidates are required");
  assert.ok(!ErrorResult.safeParse(err("invalid_cursor", { reason: "stale" })).success, "the reasons are a closed list");
  assert.ok(!ErrorResult.safeParse(err("no_such_code", {})).success);
  assert.ok(!ErrorResult.safeParse({ error: { code: "unknown_rule", message: "m", rule: null, details: { rule: "R9", rules: [] } } }).success, "model is required");
});
