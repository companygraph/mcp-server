// What the schemas declare about each other, served as data. An agent asked to draw the model
// read `ref? → identity` out of a table cell and an incoming reference out of a sentence, and
// the sentence was wrong. The declarations are the one copy; these tests hold the answers to
// them, against the example's core and the reference instance's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, describeSchema, describeRelations } from "../lib/model.mjs";
import { OUTPUTS } from "../lib/schemas.mjs";
import { exampleSnapshot, instanceSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER };
const find = (list, from, via) => list.find((x) => x.from === from && x.via === via);

test("describe_relations serves every declared reference with its form, as data", () => {
  const r = describeRelations(s);
  assert.deepEqual(r.model, MODEL);
  assert.deepEqual(find(r.relations, "experience", "organization"),
    { from: "experience", via: "organization", to: "identity", form: "ref?", by: null, in: null, array: false, required: false, min: 0, max: 1 });
  assert.deepEqual(find(r.relations, "phase", "gate-approvers"),
    { from: "phase", via: "gate-approvers", to: "role", form: "ref", by: null, in: null, array: true, required: true, min: 1, max: null });
  assert.deepEqual(find(r.relations, "profile", "Skills.Level"),
    { from: "profile", via: "Skills.Level", to: "proficiency-level", form: "qualifier", by: null, in: null, array: false, required: true, min: 0, max: null });
  assert.deepEqual(find(r.relations, "profile", "Evidence.Experience"),
    { from: "profile", via: "Evidence.Experience", to: "experience", form: "qualifier", by: null, in: null, array: false, required: false, min: 0, max: null });
  assert.deepEqual(find(r.relations, "experience", "Achievements.Kind"),
    { from: "experience", via: "Achievements.Kind", to: "achievement-kind", form: "ref", by: null, in: null, array: false, required: false, min: 0, max: null });
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
  assert.deepEqual(role.references.find((x) => x.via === "requires"), { via: "requires", to: "skill", form: "ref", by: null, in: null, array: true, required: false, min: 0, max: null });
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
      assert.ok(types.has(x.from), `${x.from}.${x.via} → ${x.to}`);
      // `to` is null exactly for a reference whose type is read from its own row (`by` set),
      // never null on an ordinary declared reference.
      if (x.to === null) assert.ok(typeof x.by === "string", `${x.from}.${x.via}: to is null but by is not named`);
      else { assert.ok(types.has(x.to), `${x.from}.${x.via} → ${x.to}`); assert.equal(x.by, null); assert.equal(x.in, null); }
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

// A relation with `to: null` reads its type from its own row and may point at any type (R9's
// `by`/`in` form), so it stands on the declared-to side of every type, "role" included.
const readsAny = (x) => x.to === null && x.by !== null;

test("a type keeps the declarations it stands in, and a side keeps one half of them", () => {
  const whole = describeRelations(s);
  const role = describeRelations(s, { type: "role" });
  assert.ok(role.relations.length > 0 && role.relations.length < whole.relations.length);
  assert.ok(role.relations.every((x) => x.from === "role" || x.to === "role" || readsAny(x)));
  const declares = describeRelations(s, { type: "role", direction: "declares" });
  assert.deepEqual(declares.relations.map((x) => x.via).sort(), ["requires", "source"]);
  const into = describeRelations(s, { type: "role", direction: "declared-to" });
  assert.ok(into.relations.length > 0 && into.relations.every((x) => x.to === "role" || readsAny(x)));
  assert.equal(role.relations.length, declares.relations.length + into.relations.length);
  assert.deepEqual(describeRelations(s, { type: "role", direction: "both" }).relations, role.relations);
});

// `declares + into === both` held for "role" above, but a by/in relation stands on both sides at
// once for the type that draws it: a question may rest on another question, so `question`'s own
// Rests on.Entity is both declared by it (from: "question") and declared to it (readsAny), and
// `both` lists it once where `declares` and `into` each list it and so double-count it.
test("a question's own by/in relation is on both sides of itself, so both is not declares plus into", () => {
  const question = describeSchema(s, "question").relations;
  assert.ok(question.references.some((x) => x.via === "Rests on.Entity"), "references: question declares it");
  assert.ok(question.referencedBy.some((x) => x.from === "question" && x.via === "Rests on.Entity"), "referencedBy: question is among what it may reference");
  const both = describeRelations(s, { type: "question" });
  const declares = describeRelations(s, { type: "question", direction: "declares" });
  const into = describeRelations(s, { type: "question", direction: "declared-to" });
  assert.ok(declares.relations.some((x) => x.via === "Rests on.Entity"), "declares: from question");
  assert.ok(into.relations.some((x) => x.from === "question" && x.via === "Rests on.Entity"), "declared-to: to every type, question included");
  // `both` is the de-duplicated union of `declares` and `into`, not their sum: a relation on
  // both sides is listed there once. A count pinned to today's core would break for the wrong
  // reason the day core gains one more reference anywhere, so the union is checked by shape.
  const key = (x) => `${x.from}.${x.via}`;
  const declaredKeys = new Set(declares.relations.map(key));
  const intoKeys = new Set(into.relations.map(key));
  assert.equal(both.relations.length, new Set([...declaredKeys, ...intoKeys]).size, "both holds no relation twice");
  assert.deepEqual(new Set(both.relations.map(key)), new Set([...declaredKeys, ...intoKeys]));
  const overlap = [...declaredKeys].filter((k) => intoKeys.has(k));
  assert.deepEqual(overlap, ["question.Rests on.Entity"], "exactly one relation, question's own by/in form, stands in both sides");
});

test("the other lists narrow to the type, and the explanations always arrive whole", () => {
  const whole = describeRelations(s);
  const process = describeRelations(s, { type: "process" });
  assert.deepEqual(process.ownership.map((x) => x.owned).sort(), ["phase", "track"]);
  for (const key of ["enums", "joins", "lists"]) assert.ok(process[key].every((x) => x.type === "process"), key);
  assert.deepEqual([process.forms, process.reading], [whole.forms, whole.reading]);
  // direction enters only the relations filter: ownership, enums, joins and lists narrow with
  // type alone, so a side of relations leaves these four lists exactly as `{ type }` gives them.
  const declaredTo = describeRelations(s, { type: "process", direction: "declared-to" });
  for (const key of ["ownership", "enums", "joins", "lists"]) assert.deepEqual(declaredTo[key], process[key], key);
});

test("via keeps one field or column, among the references and the enums", () => {
  const r = describeRelations(s, { via: "Skills.Level" });
  assert.deepEqual(r.relations.map((x) => `${x.from}.${x.via}`), ["profile.Skills.Level"]);
  const kind = describeRelations(s, { via: "Also known as.Kind" });
  assert.ok(kind.enums.length >= 1 && kind.enums.every((x) => x.via === "Also known as.Kind"));
  const none = describeRelations(s, { via: "No.Such" });
  const whole = describeRelations(s);
  assert.deepEqual(none.relations, []);
  assert.deepEqual([none.joins, none.lists, none.ownership], [whole.joins, whole.lists, whole.ownership]);
});

test("a side with no type, an unknown side and an unknown type are refused by code", () => {
  const code = (args) => { try { describeRelations(s, args); } catch (e) { return [e.code, e.details.argument ?? e.details.type]; } assert.fail("not refused"); };
  assert.deepEqual(code({ direction: "declares" }), ["invalid_argument", "direction"]);
  assert.deepEqual(code({ type: "role", direction: "out" }), ["invalid_argument", "direction"]);
  assert.deepEqual(code({ type: "person" }), ["unknown_type", "person"]);
});

// core 0.40.0's `ref → by <Column> in <Owner>` form (R9): a question's "Rests on" row names its
// own type and, where owned, its own owner, so nothing here declares a target and the relation
// carries `to: null` with `by` and `in` naming the columns instead.
test("a reference whose type is read from its row carries to: null, by and in named, and no other relation does", () => {
  const { relations } = describeRelations(s);
  const rests = find(relations, "question", "Rests on.Entity");
  assert.deepEqual(rests, { from: "question", via: "Rests on.Entity", to: null, form: "ref", by: "Type", in: "Owner", array: false, required: true, min: 0, max: null });
  for (const x of relations) if (x.via !== "Rests on.Entity" || x.from !== "question") assert.deepEqual([x.by, x.in], [null, null], `${x.from}.${x.via}`);
});

test("a relation that reads its type from its row stands among what may reference every type", () => {
  const declaredTo = describeRelations(s, { type: "profile", direction: "declared-to" });
  assert.ok(declaredTo.relations.some((x) => x.from === "question" && x.via === "Rests on.Entity"));
  const declares = describeRelations(s, { type: "profile", direction: "declares" });
  assert.ok(!declares.relations.some((x) => x.via === "Rests on.Entity"), "declares is the from side, and profile draws no such reference");
  assert.deepEqual(describeSchema(s, "profile").relations.referencedBy.find((x) => x.from === "question" && x.via === "Rests on.Entity"),
    { from: "question", via: "Rests on.Entity", form: "ref", by: "Type", in: "Owner", array: false, required: true, min: 0, max: null });
});

test("describe_relations and describe_schema for question satisfy their output schemas", () => {
  assert.ok(OUTPUTS.describe_relations.safeParse(describeRelations(s)).success);
  const schema = describeSchema(s, "question");
  assert.ok(OUTPUTS.describe_schema.safeParse(schema).success);
  assert.ok(schema.relations.references.some((x) => x.via === "Rests on.Entity" && x.to === null));
});
