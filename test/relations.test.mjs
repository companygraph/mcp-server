// What the schemas declare about each other, served as data. An agent asked to draw the model
// read `ref? → identity` out of a table cell and an incoming reference out of a sentence, and
// the sentence was wrong. The declarations are the one copy; these tests hold the answers to
// them, against the example's core and the reference instance's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, describeSchema, describeRelations } from "../lib/model.mjs";
import { exampleSnapshot, instanceSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER };
const find = (list, from, via) => list.find((x) => x.from === from && x.via === via);

test("describe_relations serves every declared reference with its form, as data", () => {
  const r = describeRelations(s);
  assert.deepEqual(r.model, MODEL);
  assert.deepEqual(find(r.relations, "experience", "organization"),
    { from: "experience", via: "organization", to: "identity", form: "ref?", array: false, required: false, min: 0, max: 1 });
  assert.deepEqual(find(r.relations, "phase", "gate-approvers"),
    { from: "phase", via: "gate-approvers", to: "role", form: "ref", array: true, required: true, min: 1, max: null });
  assert.deepEqual(find(r.relations, "profile", "Skills.Level"),
    { from: "profile", via: "Skills.Level", to: "proficiency-level", form: "qualifier", array: false, required: true, min: 0, max: null });
  assert.deepEqual(find(r.relations, "profile", "Evidence.Experience"),
    { from: "profile", via: "Evidence.Experience", to: "experience", form: "qualifier", array: false, required: false, min: 0, max: null });
  assert.deepEqual(find(r.relations, "experience", "Achievements.Kind"),
    { from: "experience", via: "Achievements.Kind", to: "achievement-kind", form: "ref", array: false, required: false, min: 0, max: null });
});

test("ownership is served apart from references, because it is nesting and not a field", () => {
  const r = describeRelations(s);
  assert.ok(r.ownership.some((x) => x.owner === "profile" && x.owned === "experience"));
  assert.ok(r.ownership.some((x) => x.owner === "process" && x.owned === "track"));
  assert.equal(r.relations.filter((x) => x.via === "owner" && x.form === undefined).length, 0, "no owner line among the references");
  // A process's `owner` field is a reference to a role, and stays one.
  assert.equal(find(r.relations, "process", "owner").to, "role");
});

test("the forms are explained once, in the answer that uses them", () => {
  const { forms } = describeRelations(s);
  assert.deepEqual(Object.keys(forms).sort(), ["qualifier", "ref", "ref?"]);
  for (const text of Object.values(forms)) assert.ok(text.length > 20);
});

test("describe_schema carries the type's relations both ways, read from the declarations", () => {
  const role = describeSchema(s, "role").relations;
  assert.equal(role.owner, null);
  // `source` is on every type, and the declarations say so where a schema's prose may not.
  assert.deepEqual(role.references.map((x) => x.via).sort(), ["requires", "source"]);
  assert.deepEqual(role.references.find((x) => x.via === "requires"), { via: "requires", to: "skill", form: "ref", array: true, required: false, min: 0, max: null });
  const into = role.referencedBy.map((x) => `${x.from}.${x.via}`);
  for (const edge of ["profile.roles", "process.owner", "process.supported-by", "phase.owner", "phase.executed-by", "phase.gate-approvers", "phase.escalation-authority"])
    assert.ok(into.includes(edge), edge);

  const identity = describeSchema(s, "identity").relations;
  assert.ok(identity.referencedBy.some((x) => x.from === "experience" && x.via === "organization" && x.form === "ref?"));

  const process = describeSchema(s, "process").relations;
  assert.deepEqual(process.owns.sort(), ["phase", "track"]);
  assert.equal(describeSchema(s, "phase").relations.owner, "process");
});

test("every relation names declared types, in the instance's own core too", () => {
  for (const snapshot of [s, instanceSnapshot()]) {
    const r = describeRelations(snapshot);
    const types = new Set(snapshot.schemas.map((x) => x.id.slice("core/".length)));
    assert.ok(r.relations.length > 0);
    for (const x of r.relations) {
      assert.ok(types.has(x.from) && types.has(x.to), `${x.from}.${x.via} → ${x.to}`);
      assert.ok(["ref", "ref?", "qualifier"].includes(x.form), x.form);
      assert.equal(typeof x.array, "boolean");
      assert.equal(typeof x.required, "boolean");
    }
  }
});

test("a snapshot written before the declarations were kept is refused, never answered empty", () => {
  const { schemaEdges, ...old } = s;
  assert.throws(() => describeRelations(old), (e) => e instanceof ModelError && /rebuil/.test(e.message));
  assert.throws(() => describeSchema(old, "role"), (e) => e instanceof ModelError && /rebuil/.test(e.message));
});

// The deployment serves a snapshot written to a file, so what the queries read has to survive it.
test("the declarations and the rules survive the snapshot being written out and read back", async () => {
  const { listRules } = await import("../lib/model.mjs");
  const back = JSON.parse(JSON.stringify(s));
  assert.deepEqual(describeRelations(back), describeRelations(s));
  assert.deepEqual(listRules(back), listRules(s));
});

test("a type keeps the declarations it stands in, and a side keeps one half of them", () => {
  const whole = describeRelations(s);
  const role = describeRelations(s, { type: "role" });
  assert.ok(role.relations.length > 0 && role.relations.length < whole.relations.length);
  assert.ok(role.relations.every((x) => x.from === "role" || x.to === "role"));
  const declares = describeRelations(s, { type: "role", direction: "declares" });
  assert.deepEqual(declares.relations.map((x) => x.via).sort(), ["requires", "source"]);
  const into = describeRelations(s, { type: "role", direction: "declared-to" });
  assert.ok(into.relations.length > 0 && into.relations.every((x) => x.to === "role"));
  assert.equal(role.relations.length, declares.relations.length + into.relations.length);
  assert.deepEqual(describeRelations(s, { type: "role", direction: "both" }).relations, role.relations);
});

test("the other lists narrow to the type, and the explanations always arrive whole", () => {
  const whole = describeRelations(s);
  const process = describeRelations(s, { type: "process" });
  assert.deepEqual(process.ownership.map((x) => x.owned).sort(), ["phase", "track"]);
  for (const key of ["enums", "joins", "lists"]) assert.ok(process[key].every((x) => x.type === "process"), key);
  assert.deepEqual([process.forms, process.reading], [whole.forms, whole.reading]);
});

test("via keeps one field or column, among the references and the enums", () => {
  const r = describeRelations(s, { via: "Skills.Level" });
  assert.deepEqual(r.relations.map((x) => `${x.from}.${x.via}`), ["profile.Skills.Level"]);
  const kind = describeRelations(s, { via: "Also known as.Kind" });
  assert.ok(kind.enums.length >= 1 && kind.enums.every((x) => x.via === "Also known as.Kind"));
  assert.deepEqual(describeRelations(s, { via: "No.Such" }).relations, []);
});

test("a side with no type, an unknown side and an unknown type are refused by code", () => {
  const code = (args) => { try { describeRelations(s, args); } catch (e) { return [e.code, e.details.argument ?? e.details.type]; } assert.fail("not refused"); };
  assert.deepEqual(code({ direction: "declares" }), ["invalid_argument", "direction"]);
  assert.deepEqual(code({ type: "role", direction: "out" }), ["invalid_argument", "direction"]);
  assert.deepEqual(code({ type: "person" }), ["unknown_type", "person"]);
});
