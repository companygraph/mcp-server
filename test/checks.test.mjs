// The checks an instance is held to, listed. A reviewer reading the schemas through this server
// could see that a rule is declared and could not see whether anything enforces it. The checker
// names every check and the rule it cites, so the list is read from it, never written here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listChecks } from "../lib/model.mjs";
import { exampleSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const s = exampleSnapshot();

test("list_checks names every check the checker runs, with the rule it cites and that rule's title", () => {
  const r = listChecks(s);
  assert.deepEqual(r.model, { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER });
  assert.ok(r.checks.length > 0);
  const resolve = r.checks.find((c) => c.name === "references resolve");
  assert.deepEqual(resolve, { name: "references resolve", rule: "R4", title: "An unresolvable reference is an error", reports: "failure" });
  assert.ok(r.checks.some((c) => c.name === "a section holds the kind of list its schema declares" && c.rule === "R16"));
  for (const c of r.checks) assert.ok(c.name && /^R\d+$/.test(c.rule) && c.title, JSON.stringify(c));
});

// A check that notes fails nothing, and an agent reading the list has to know which those are:
// the checker flags them, and the list says so rather than letting every check read as one
// that fails.
test("a check that only notes is listed as reporting a note, and every other as reporting a failure", () => {
  const { checks } = listChecks(s);
  const noting = checks.filter((c) => c.reports === "note").map((c) => c.name);
  assert.ok(noting.includes("a date that expires is noted once it has passed"), noting.join("; "));
  assert.ok(noting.includes("a seat's required skill its holder does not claim is noted"), noting.join("; "));
  for (const c of checks) assert.ok(c.reports === "note" || c.reports === "failure", JSON.stringify(c));
  assert.ok(checks.filter((c) => c.reports === "failure").length > noting.length);
});

test("the answer says who runs them, since this server does not", () => {
  assert.match(listChecks(s).ranBy, /instance/);
  assert.match(listChecks(s).ranBy, /not .*this server|never .*this server|this server .*not/);
});

test("it survives the snapshot being written out, and an older snapshot is refused by name", () => {
  assert.deepEqual(listChecks(JSON.parse(JSON.stringify(s))), listChecks(s));
  const { checks, ...old } = s;
  assert.throws(() => listChecks(old), (e) => e instanceof ModelError && /rebuil/.test(e.message));
});
