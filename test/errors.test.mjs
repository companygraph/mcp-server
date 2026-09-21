// A refusal is read by a program as well as a person: the sentence stays, and beside it a code
// from a closed list and the facts the sentence names, under keys the code fixes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, CODES } from "../lib/errors.mjs";
import * as model from "../lib/model.mjs";
import { exampleSnapshot, withOwnedNameTwice } from "./helpers.mjs";

const s = exampleSnapshot();
const thrown = (fn) => {
  try { fn(); } catch (e) { return e; }
  assert.fail("nothing was thrown");
};

test("the model exports the one ModelError, and the codes are a closed list", () => {
  assert.equal(model.ModelError, ModelError);
  assert.deepEqual(CODES, ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot"]);
  const e = new ModelError("unknown_type", "a sentence");
  assert.ok(e instanceof Error);
  assert.deepEqual([e.code, e.message, e.rule, e.details], ["unknown_type", "a sentence", null, {}]);
  assert.throws(() => new ModelError("nope", "x"), /nope/);
});

test("an undeclared type names the declared ones", () => {
  const e = thrown(() => model.describeSchema(s, "person"));
  assert.equal(e.code, "unknown_type");
  assert.equal(e.rule, null);
  assert.equal(e.details.type, "person");
  assert.ok(e.details.declared.includes("skill"));
  assert.equal(thrown(() => model.listEntities(s, "person")).code, "unknown_type");
});

test("a name the type does not hold is R4, with what was asked", () => {
  const e = thrown(() => model.getEntity(s, "skill", "Knitting"));
  assert.deepEqual([e.code, e.rule, e.details], ["unknown_entity", "R4", { type: "skill", name: "Knitting" }]);
  assert.equal(thrown(() => model.findEvidence(s, "Knitting")).code, "unknown_entity");
  const byId = thrown(() => model.fetchEntity(s, "nothing/here"));
  assert.deepEqual([byId.code, byId.details], ["unknown_entity", { id: "nothing/here" }]);
});

test("a name two owners hold is R2, with every candidate as data", () => {
  const { snapshot, title } = withOwnedNameTwice();
  const ids = snapshot.entities.filter((x) => x.type === "experience" && x.name === title).map((x) => x.id).sort();
  const e = thrown(() => model.getEntity(snapshot, "experience", title));
  assert.deepEqual([e.code, e.rule, e.details.type, e.details.name], ["ambiguous_name", "R2", "experience", title]);
  assert.deepEqual(e.details.candidates.map((c) => c.id).sort(), ids);
  for (const c of e.details.candidates) assert.deepEqual(Object.keys(c), ["id", "type", "name", "owner"]);
  assert.ok(e.details.candidates.every((c) => ids.some((id) => id.startsWith(`${c.owner}/`))));
});

test("an unknown rule names the known ones, and an empty query names its argument", () => {
  const rule = thrown(() => model.describeRule(s, "R999"));
  assert.equal(rule.code, "unknown_rule");
  assert.equal(rule.details.rule, "R999");
  assert.ok(rule.details.rules.includes("R4"));
  const query = thrown(() => model.search(s, "  "));
  assert.deepEqual([query.code, query.details], ["invalid_argument", { argument: "query", reason: "empty" }]);
});

test("a snapshot that predates what a tool reads says what is missing", () => {
  const { schemaEdges, ...noEdges } = s;
  const { checks, ...noChecks } = s;
  assert.deepEqual([thrown(() => model.describeRelations(noEdges)).code, thrown(() => model.describeRelations(noEdges)).details], ["unsupported_snapshot", { missing: "schemaEdges and constraints" }]);
  assert.deepEqual(thrown(() => model.listChecks(noChecks)).details, { missing: "checks" });
  assert.deepEqual(thrown(() => model.listRules({ ...s, rules: null })).details, { missing: "rules" });
});
