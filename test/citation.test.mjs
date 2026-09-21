// An answer that quotes a page says where the page is: an entity's `url` is its file at the
// served commit. A schema and a rule are quoted as often, and they are files too, in the core
// the instance vendors at that same commit, so they are cited the same way. The address is the
// instance's own copy and never the meta-model's, since the two may differ and the server
// answers from the first.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describeSchema, listRules, describeRule, listTypes } from "../lib/model.mjs";
import { OUTPUTS } from "../lib/schemas.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";
import { exampleSnapshot, instanceSnapshot, exampleFiles, fixtureRoot, instanceRoot, COMMIT, INSTANCE_COMMIT, PARSER } from "./helpers.mjs";

const FIXTURES = [
  ["the worked example", exampleSnapshot(), fixtureRoot, `https://github.com/companygraph/meta-model/blob/${COMMIT}/core/`],
  ["the reference instance", instanceSnapshot(), instanceRoot, `https://github.com/robertblust/mental-model/blob/${INSTANCE_COMMIT}/meta/core/`],
];

for (const [label, s, root, base] of FIXTURES) {
  test(`${label}: every schema cites the file it was read from, at the served commit`, () => {
    const types = listTypes(s).types;
    assert.ok(types.length > 0);
    for (const { type } of types) {
      const file = s.schemas.find((x) => x.id === `core/${type}`).path;
      assert.equal(describeSchema(s, type).url, `${base}${file}`, type);
      // The address names a real file: the one on disk the fixture's core was read from.
      assert.ok(fs.existsSync(path.join(root, s.core.path, file)), file);
    }
  });

  test(`${label}: the rules cite the conventions file beside the schemas`, () => {
    assert.equal(listRules(s).url, `${base}CONVENTIONS.md`);
    assert.equal(describeRule(s, "R4").url, `${base}CONVENTIONS.md`);
    assert.ok(fs.existsSync(path.join(root, s.core.path, "CONVENTIONS.md")));
  });
}

test("the snapshot keeps where the core sits, with its slash, and null where nobody said", () => {
  const { files, schemas } = exampleFiles();
  const build = (core) => buildSnapshot({ files, schemas, sub: "example/model/", core, commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  assert.equal(build("core").core.path, "core/");
  assert.equal(build("core/").core.path, "core/");
  assert.equal(build("").core.path, "", "a core at the repository's root is a place, not an unknown");
  assert.equal(build(undefined).core.path, null);
  assert.equal(describeSchema(build(""), "skill").url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/skill-schema.md`);
});

test("where the repository, the commit or the core's place is unknown the address is null, never a guess", () => {
  const s = exampleSnapshot();
  const { path: _, ...older } = s.core;
  for (const unknown of [{ ...s, repo: null }, { ...s, commit: null }, { ...s, core: older }]) {
    const schema = describeSchema(unknown, "skill");
    assert.equal(schema.url, null);
    assert.equal(listRules(unknown).url, null);
    assert.equal(describeRule(unknown, "R4").url, null);
    assert.ok(OUTPUTS.describe_schema.safeParse(JSON.parse(JSON.stringify(schema))).success, "null is inside the declared schema");
  }
});

test("the three answers declare url, and a missing one is refused", () => {
  const s = exampleSnapshot();
  for (const [name, answer] of [["describe_schema", describeSchema(s, "skill")], ["list_rules", listRules(s)], ["describe_rule", describeRule(s, "R4")]]) {
    const whole = JSON.parse(JSON.stringify(answer));
    assert.ok(OUTPUTS[name].safeParse(whole).success, name);
    const { url, ...without } = whole;
    assert.equal(typeof url, "string", name);
    assert.ok(!OUTPUTS[name].safeParse(without).success, `${name} accepts an answer without url`);
    assert.ok(!OUTPUTS[name].safeParse({ ...whole, url: 7 }).success, `${name} accepts a number for url`);
  }
});
