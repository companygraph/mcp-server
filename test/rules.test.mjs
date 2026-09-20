// The rules an instance is held to, served from the CONVENTIONS.md its core vendors. A schema
// cites them by number — R9, R12 — and says nothing of what they hold, so an agent reading
// schemas alone assumed a required list could be empty, which R9 and a check forbid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listRules, describeRule } from "../lib/model.mjs";
import { exampleSnapshot, exampleFiles, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";

const s = exampleSnapshot();
const MODEL = { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER };

test("list_rules names every rule with its title and the part of the file it stands in", () => {
  const r = listRules(s);
  assert.deepEqual(r.model, MODEL);
  assert.ok(r.tagline.startsWith("What makes a graph of Markdown files checkable."));
  assert.deepEqual(r.rules.find((x) => x.rule === "R4"), { rule: "R4", title: "An unresolvable reference is an error", part: "Structure" });
  assert.deepEqual(r.rules.find((x) => x.rule === "R9"), { rule: "R9", title: "Schema files have a fixed shape", part: "Schemas" });
  // In the file's order, which is not numeric: R13 stands in Structure, before R8.
  const order = r.rules.map((x) => x.rule);
  assert.ok(order.indexOf("R13") < order.indexOf("R8"));
  assert.equal(new Set(order).size, order.length);
});

test("describe_rule returns one rule as written, by its number in either case", () => {
  const r = describeRule(s, "R4");
  assert.equal(r.rule, "R4");
  assert.equal(r.title, "An unresolvable reference is an error");
  assert.ok(r.text.startsWith("Not a warning."));
  assert.ok(!r.text.includes("### R5"), "the rule ends where the next begins");
  assert.deepEqual(describeRule(s, "r4").text, r.text);
  assert.deepEqual(r.model, MODEL);
});

test("the last rule of a part ends at the part's end, and the last of the file at the file's", () => {
  assert.ok(!describeRule(s, "R17").text.includes("## Schemas"));
  assert.ok(describeRule(s, "R0").text.length > 0);
});

test("a number that names no rule is refused with the ones that do", () => {
  assert.throws(() => describeRule(s, "R99"), (e) => e instanceof ModelError && /R99/.test(e.message) && /R4/.test(e.message));
});

test("a core that vendors no CONVENTIONS.md says so, and is never answered with an empty list", () => {
  const { files, schemas } = exampleFiles();
  schemas.delete("CONVENTIONS.md");
  const bare = buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  assert.throws(() => listRules(bare), (e) => e instanceof ModelError && /CONVENTIONS\.md/.test(e.message));
  assert.throws(() => describeRule(bare, "R4"), (e) => e instanceof ModelError && /CONVENTIONS\.md/.test(e.message));
});
