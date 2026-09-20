// What the schemas constrain, served as data: how many of a reference a page may hold, the joins
// between a schema's tables and the kind of list a section holds. All of it is read by the
// parser package's `constraintsOf`, so nothing here decides what a cell or a Description means.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, describeRelations, describeSchema } from "../lib/model.mjs";
import { exampleSnapshot } from "./helpers.mjs";

const s = exampleSnapshot();
const find = (list, from, via) => list.find((x) => x.from === from && x.via === via);

test("a reference says how many of it a page may hold", () => {
  const { relations } = describeRelations(s);
  assert.deepEqual(find(relations, "phase", "gate-approvers"),
    { from: "phase", via: "gate-approvers", to: "role", form: "ref", array: true, required: true, min: 1, max: null });
  assert.deepEqual(find(relations, "phase", "owner"),
    { from: "phase", via: "owner", to: "role", form: "ref", array: false, required: true, min: 1, max: 1 });
  assert.deepEqual(find(relations, "experience", "organization"),
    { from: "experience", via: "organization", to: "identity", form: "ref?", array: false, required: false, min: 0, max: 1 });
  // A column is of a row, and nothing bounds the rows.
  assert.deepEqual(find(relations, "profile", "Skills.Level"),
    { from: "profile", via: "Skills.Level", to: "proficiency-level", form: "qualifier", array: false, required: true, min: 0, max: null });
});

test("the joins and the list kinds are served for the whole vocabulary, each naming its type", () => {
  const r = describeRelations(s);
  assert.deepEqual(r.joins.filter((j) => j.type === "profile"), [
    { type: "profile", kind: "under", section: "Evidence", under: "Skills" },
    { type: "profile", kind: "lists", section: "Evidence", column: "Experience", field: "skills", by: "Skill" },
  ]);
  assert.deepEqual(r.lists.find((l) => l.type === "phase" && l.section === "Activities"),
    { type: "phase", section: "Activities", kind: "Numbered", required: true, min: 1 });
  assert.ok(r.lists.some((l) => l.type === "role" && l.section === "What it never does" && l.kind === "Bulleted"));
});

test("what min, max, a join and a list kind mean is said once, in the answer that uses them", () => {
  const { reading } = describeRelations(s);
  assert.deepEqual(Object.keys(reading).sort(), ["lists", "min and max", "required", "under"]);
  for (const text of Object.values(reading)) assert.ok(text.length > 20);
});

test("describe_schema carries its own type's joins and lists, and the bounds both ways", () => {
  const profile = describeSchema(s, "profile").relations;
  assert.equal(profile.joins.length, 2);
  assert.deepEqual(profile.lists, []);
  const role = describeSchema(s, "role").relations;
  assert.deepEqual(role.lists, [{ section: "What it never does", kind: "Bulleted", required: true, min: 1 }]);
  assert.deepEqual(role.referencedBy.find((x) => x.from === "phase" && x.via === "gate-approvers"),
    { from: "phase", via: "gate-approvers", form: "ref", array: true, required: true, min: 1, max: null });
});

test("it survives the snapshot being written out, and an older snapshot is refused by name", () => {
  assert.deepEqual(describeRelations(JSON.parse(JSON.stringify(s))), describeRelations(s));
  const { constraints, ...old } = s;
  assert.throws(() => describeRelations(old), (e) => e instanceof ModelError && /rebuil/.test(e.message));
});
