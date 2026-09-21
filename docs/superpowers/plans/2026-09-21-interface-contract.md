# Interface contract implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server's tool interface a declared, tested and documented contract: a full output schema per tool, coded errors, bounded and paged lists, search and relation filters, a clean split of `get_entity` from `fetch`, one description template, and `docs/INTERFACE.md`.

**Architecture:** The queries stay pure functions over a snapshot in `lib/model.mjs`. Three small modules join it: `lib/errors.mjs` (the coded `ModelError`), `lib/paging.mjs` (cursor and `paginate`), `lib/schemas.mjs` (every zod shape, one output schema per tool, the error schema). `lib/tools.mjs` stays the single list of tools and gains each tool's `output`. `lib/contract.mjs` holds one sample call per tool and the parse of an answer against its schema, used by this suite and by the shared deployment tests alike.

**Tech Stack:** Node 22+, `node:test`, zod 4, `@modelcontextprotocol/server` and `/client` v2, `companygraph-meta-model` (the parser, pinned by tag).

**Spec:** `docs/superpowers/specs/2026-09-21-interface-contract-design.md` (this branch). Read it before any task.

## Global constraints

- **One repository, one branch.** The worktree exists: `~/git/companygraph/mcp-server-the-interface-is-a-contract`, branch `the-interface-is-a-contract`, carrying the spec and this plan. The clone at `~/git/companygraph/mcp-server` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test` (which fetches fixtures first and opens a browser for two page tests).
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The pull request body the same, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged or released by an agent.** The last task opens the pull request and stops.
- **No count or version of something that still moves** in any prose or comment. The paging constants (50 and 200) and the description cap (60 words) are the contract's own values and are written.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.
- **Never stop a process by name or pattern.**

### Rulings the plan makes where the spec is silent

1. **The nesting edge is `via: "nested-in"`.** `owner` is also a field some schemas declare, and a `via` names one thing; the owner decided the split after the plan ran, and the code, the glossary and `docs/INTERFACE.md` say so.
2. **`describe_relations`: `direction` without `type` is refused** as `invalid_argument`, as it is for `list_references` without `entity`. `via` narrows `relations` and `enums`, the two lists that carry a `via`.
3. **Functions a deployment's suite imports keep their arguments.** `getEntity(s, type, name)` stays positional; `getEntityById(s, id)` stands beside it and `entityBy(s, args)` is what the tool calls. `search(s, query, options)` and `listEntities(s, type, options)` take their new arguments as a trailing object. `ModelError` is still exported from `lib/model.mjs`.
4. **A schema is strict where this package builds the object and loose where the parser does.** Entities, sections, tables, enums, joins, lists and checks are spread from the parser's output, so they require their known keys and allow others; a parser release that adds a key must not make every answer fail the SDK's output validation. Everything else is `z.strictObject`, so an undeclared field fails the suite.
5. **`limit` is declared `z.number().int()` and clamped to 1–200 by the server.** A non-integer is the SDK's refusal, without a code.
6. **The ambiguity sentence says "ask for the one meant by its id"**, since `get_entity` now takes one.
7. **The document's examples are abbreviated by rule and say so:** an array is cut to its first two entries, a string to 200 characters, and `model.core` and `model.parser` are shown as `0.0.0` and `v0.0.0` so a parser re-pin does not rewrite the document. Nothing else differs from what the server answered.
8. **The version bump and the release are not in this branch.** The repository's pattern is a pull request of its own for the version after the change merges; the release notes are drafted at the end of this plan for that day.

---

### Task 0: A working tree that passes

**Files:** none changed.

- [ ] **Step 1: Install and fetch fixtures**

```sh
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/companygraph/mcp-server-the-interface-is-a-contract
git config user.email
npm ci
npm run fixtures
```

Expected: the address is `robert.blust@flatland.ch`; `npm ci` and the fixtures both exit 0; `test/fixtures/meta-model` and `test/fixtures/mental-model` exist.

- [ ] **Step 2: Run the suite as the baseline**

Run: `npm test; echo "exit $?"`

Expected: `exit 0`. If the two page tests fail for want of a browser, run `npx playwright install chromium` and run again. A failure that remains is reported before any task starts; it is not worked around.

---

### Task 1: Every refusal carries a code

**Files:**

- Create: `lib/errors.mjs`
- Modify: `lib/model.mjs` (every `throw new ModelError`)
- Test: `test/errors.test.mjs`

**Interfaces:**

- Produces: `CODES` (array of the seven code strings) and `class ModelError extends Error` with `constructor(code, message, { rule = null, details = {} } = {})` and the properties `code`, `rule`, `details`, from `lib/errors.mjs`; `lib/model.mjs` re-exports `ModelError`.

- [ ] **Step 1: Write the failing test**

Create `test/errors.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/errors.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module … lib/errors.mjs`.

- [ ] **Step 3: Write `lib/errors.mjs`**

```js
// A refusal, as a program reads it. The sentence is the message, as it always was; `code` is one
// of a closed list a client may branch on, `rule` the convention the refusal rests on where one
// does, and `details` the facts the sentence names, under keys the code fixes. The list is
// closed because a client switches on it: a code added is an additive change to the interface,
// a code renamed is a break.
export const CODES = ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot"];

export class ModelError extends Error {
  constructor(code, message, { rule = null, details = {} } = {}) {
    if (!CODES.includes(code)) throw new TypeError(`"${code}" is no error code; the codes are ${CODES.join(", ")}`);
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.rule = rule;
    this.details = details;
  }
}
```

- [ ] **Step 4: Give every throw in `lib/model.mjs` its code**

Replace the line `export class ModelError extends Error {}` with:

```js
import { ModelError } from "./errors.mjs";
export { ModelError };
```

Add beside `ref`:

```js
// An entity as a candidate: what a caller needs to pick one of several holding a name.
const candidate = (e) => ({ ...ref(e), owner: e.owner ?? null });
```

Then replace each throw, keeping its sentence word for word:

```js
// requireType
  if (!schema) throw new ModelError("unknown_type", `no schema declares "${type}"; the declared types are ${declaredTypes(s).join(", ")}`, { details: { type, declared: declaredTypes(s) } });

// resolveTyped
  if (found.length === 0) throw new ModelError("unknown_entity", `R4: "${name}" names no ${type}`, { rule: "R4", details: { type, name } });
  if (found.length > 1)
    throw new ModelError("ambiguous_name", `R2: "${name}" is the name of ${found.length} ${type} entities, one in each of their owners (${found.map((x) => x.id).join(", ")}); fetch the one meant by its id`,
      { rule: "R2", details: { type, name, candidates: found.map(candidate) } });

// relationsOf
    throw new ModelError("unsupported_snapshot", "this snapshot was written before the schemas' declarations and constraints were kept in it; rebuild it with this release to ask what the types declare about each other", { details: { missing: "schemaEdges and constraints" } });

// rulesOf
  if (!s.rules) throw new ModelError("unsupported_snapshot", "the core this instance vendors carries no CONVENTIONS.md, or the snapshot was written before its rules were kept; the rules cannot be reported", { details: { missing: "rules" } });

// describeRule
  if (!found) throw new ModelError("unknown_rule", `"${rule}" names no rule; the rules are ${rules.map((x) => x.rule).join(", ")}`, { details: { rule: String(rule ?? ""), rules: rules.map((x) => x.rule) } });

// search
  if (!q) throw new ModelError("invalid_argument", "search needs a query", { details: { argument: "query", reason: "empty" } });

// fetchEntity, the shared name (this branch of the function goes in Task 6)
      throw new ModelError("ambiguous_name",
        types.length > 1
          ? `R2: "${id}" is the name of ${named.length} entities of different types (${types.join(", ")}); ask by type with get_entity, or fetch by id (${named.map((x) => x.id).join(", ")})`
          : `R2: "${id}" is the name of ${named.length} ${types[0]} entities, one in each of their owners (${named.map((x) => x.id).join(", ")}); fetch the one meant by its id`,
        { rule: "R2", details: { type: types.length === 1 ? types[0] : null, name: id, candidates: named.map(candidate) } });
    if (named.length === 0) throw new ModelError("unknown_entity", `nothing has the id or the name "${id}"`, { details: { id } });

// listChecks
    throw new ModelError("unsupported_snapshot", "this snapshot was written before the checker's list of checks was kept in it; rebuild it with this release to ask what the instance is held to", { details: { missing: "checks" } });
```

- [ ] **Step 5: Run the new test and every test that reads a refusal**

Run: `node --test test/errors.test.mjs test/model.test.mjs test/relations.test.mjs test/rules.test.mjs test/checks.test.mjs test/constraints.test.mjs test/instance.test.mjs test/server.test.mjs; echo "exit $?"`

Expected: exit 0. The older tests match sentences, and no sentence changed.

- [ ] **Step 6: Commit**

```sh
git add lib/errors.mjs lib/model.mjs test/errors.test.mjs
git commit -F - <<'EOF'
A refusal carries a code and its facts

A client that met an ambiguous name had to take the candidate ids out of a sentence. Every refusal now carries one of a closed list of codes, the rule it rests on where one does, and the facts its sentence names as data, under keys the code fixes. The sentence is unchanged and the model still exports the error, so nothing that matched a message or imported the class has to move.

Verified: node --test on errors, model, relations, rules, checks, constraints, instance and server passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: A page and its cursor

**Files:**

- Create: `lib/paging.mjs`
- Test: `test/paging.test.mjs`

**Interfaces:**

- Consumes: `ModelError` from `lib/errors.mjs`.
- Produces: `DEFAULT_LIMIT = 50`, `MAX_LIMIT = 200`, `clampLimit(limit) → integer`, and `paginate(items, { limit, cursor } = {}, commit) → { items, page: { total, returned, hasMore, nextCursor } }`.

- [ ] **Step 1: Write the failing test**

Create `test/paging.test.mjs`:

```js
// A list is bounded and says whether more exists. The cursor is opaque to a client and carries
// the offset and the commit, because a deployment that re-pins between two pages serves another
// model and an offset into the old list would answer from the wrong one without saying so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate, clampLimit, DEFAULT_LIMIT, MAX_LIMIT } from "../lib/paging.mjs";
import { ModelError } from "../lib/errors.mjs";

const items = Array.from({ length: 137 }, (_, i) => i);
const COMMIT = "a".repeat(40);

test("the default page, and a limit clamped at both ends rather than refused", () => {
  assert.deepEqual([DEFAULT_LIMIT, MAX_LIMIT], [50, 200]);
  assert.deepEqual([clampLimit(undefined), clampLimit(0), clampLimit(-3), clampLimit(7), clampLimit(1000)], [50, 1, 1, 7, 200]);
  const first = paginate(items, {}, COMMIT);
  assert.equal(first.items.length, 50);
  assert.deepEqual({ ...first.page, nextCursor: null }, { total: 137, returned: 50, hasMore: true, nextCursor: null });
  assert.equal(typeof first.page.nextCursor, "string");
});

test("the pages of a walk are the whole list, once each, and the last says so", () => {
  const seen = [];
  let cursor, pages = 0;
  do {
    const r = paginate(items, { limit: 30, cursor }, COMMIT);
    assert.equal(r.page.total, 137);
    assert.equal(r.page.returned, r.items.length);
    assert.equal(r.page.hasMore, r.page.nextCursor !== null);
    seen.push(...r.items);
    cursor = r.page.nextCursor;
    pages++;
  } while (cursor);
  assert.deepEqual(seen, items);
  assert.equal(pages, 5);
});

test("an empty list is one empty page", () => {
  assert.deepEqual(paginate([], {}, COMMIT), { items: [], page: { total: 0, returned: 0, hasMore: false, nextCursor: null } });
});

test("a snapshot with no commit pages too, since stdio serves a working tree", () => {
  const { page } = paginate(items, { limit: 100 }, null);
  assert.equal(paginate(items, { limit: 100, cursor: page.nextCursor }, null).items.length, 37);
});

test("a cursor that does not decode, and one from another commit, are refused with the reason", () => {
  for (const bad of ["not-a-cursor", Buffer.from("[1]").toString("base64url"), Buffer.from('{"o":-1,"c":null}').toString("base64url")])
    assert.throws(() => paginate(items, { cursor: bad }, COMMIT), (e) => e instanceof ModelError && e.code === "invalid_cursor" && e.details.reason === "malformed", bad);
  const { page } = paginate(items, {}, COMMIT);
  assert.throws(() => paginate(items, { cursor: page.nextCursor }, "b".repeat(40)), (e) => e instanceof ModelError && e.code === "invalid_cursor" && e.details.reason === "other_commit");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/paging.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module … lib/paging.mjs`.

- [ ] **Step 3: Write `lib/paging.mjs`**

```js
// One page of a list. A snapshot never changes while it is served, so an offset into a list
// with a fixed order is exact, and the cursor is that offset. It carries the commit beside it
// because a deployment re-pins: the next page would then come from another model's list, and a
// client walking it would repeat and skip entries with nothing to say so. Such a cursor is
// refused. What it cannot see is a cursor sent back with other filters than the call that made
// it; the interface document says so. `lib/page.mjs` is the landing page, hence this file's name.
import { ModelError } from "./errors.mjs";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// A limit outside the range is served at the nearest bound: the page says how much came back
// and whether more exists, which tells a client more than a refusal would.
export function clampLimit(limit) {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  const n = Math.trunc(Number(limit));
  return Number.isFinite(n) ? Math.min(MAX_LIMIT, Math.max(1, n)) : DEFAULT_LIMIT;
}

const encode = (offset, commit) => Buffer.from(JSON.stringify({ o: offset, c: commit ?? null })).toString("base64url");

const malformed = () => new ModelError("invalid_cursor", "the cursor is not one this server wrote; leave it out to start from the first page", { details: { reason: "malformed" } });

function decode(cursor, commit) {
  let parsed;
  try { parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8")); } catch { throw malformed(); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || !Number.isInteger(parsed.o) || parsed.o < 0) throw malformed();
  if ((parsed.c ?? null) !== (commit ?? null))
    throw new ModelError("invalid_cursor", "the cursor was written for another commit of the model than the one now served; leave it out to start from the first page", { details: { reason: "other_commit" } });
  return parsed.o;
}

export function paginate(items, { limit, cursor } = {}, commit) {
  const size = clampLimit(limit);
  const offset = cursor === undefined || cursor === null ? 0 : decode(cursor, commit);
  const slice = items.slice(offset, offset + size);
  const end = offset + slice.length;
  const hasMore = end < items.length;
  return { items: slice, page: { total: items.length, returned: slice.length, hasMore, nextCursor: hasMore ? encode(end, commit) : null } };
}
```

- [ ] **Step 4: Run the test**

Run: `node --test test/paging.test.mjs; echo "exit $?"`

Expected: exit 0.

- [ ] **Step 5: Commit**

```sh
git add lib/paging.mjs test/paging.test.mjs
git commit -F - <<'EOF'
A list is served a page at a time

A list that returns everything it has grows with the instance and nothing bounds it. One function cuts any ordered list into pages of fifty, two hundred at most, and says how many exist and whether more follow. The cursor carries the commit beside the offset, so a walk that straddles a re-pin is refused rather than answered from the other model's list.

Verified: node --test test/paging.test.mjs passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: One edge shape, and `list_references`

**Files:**

- Modify: `lib/model.mjs`, `lib/tools.mjs`, `test/server.test.mjs`
- Test: `test/references.test.mjs`

**Interfaces:**

- Consumes: `paginate` from `lib/paging.mjs`; `ModelError`.
- Produces, inside `lib/model.mjs` (module-private unless marked): `cmp(a, b)`, `edgeOf(byId, x) → { from: EntityRef, via, to: EntityRef, attrs }`, `allEdges(s) → Edge[]` in the order `from.id`, `via`, `to.id`, ownership included; `requireId(s, id) → entity`; exported `listReferences(s, { entity, direction, via, type, limit, cursor } = {}) → { edges, page, model }`. The tool `list_references`.

- [ ] **Step 1: Write the failing test**

Create `test/references.test.mjs`:

```js
// The instance's edges as a list of their own, so a client inspects one entity's relations, or
// one kind of reference, without taking whole entities. An edge names both its ends, because a
// list of edges belongs to no single entity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listReferences } from "../lib/model.mjs";
import { exampleSnapshot, instanceSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";

const s = exampleSnapshot();
const DDD = "skills/domain-driven-design";
const MIRA = "profiles/mira-halvorsen";

test("an edge names both ends, the field that drew it and the row's other columns", () => {
  const r = listReferences(s, { entity: DDD, direction: "in", via: "Skills.Skill" });
  assert.deepEqual(r.model, { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER });
  const claim = r.edges.find((x) => x.from.id === MIRA);
  assert.deepEqual(Object.keys(claim), ["from", "via", "to", "attrs"]);
  assert.deepEqual(claim.from, { id: MIRA, type: "profile", name: "Mira Halvorsen" });
  assert.deepEqual(claim.to, { id: DDD, type: "skill", name: "Domain-Driven Design" });
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  assert.ok(r.edges.every((x) => x.via === "Skills.Skill" && x.to.id === DDD));
  assert.equal(r.page.total, r.edges.length);
});

test("direction reads relative to the entity, and both is the default", () => {
  const out = listReferences(s, { entity: MIRA, direction: "out" });
  const into = listReferences(s, { entity: MIRA, direction: "in" });
  const both = listReferences(s, { entity: MIRA });
  assert.ok(out.edges.length > 0 && out.edges.every((x) => x.from.id === MIRA));
  assert.ok(into.edges.length > 0 && into.edges.every((x) => x.to.id === MIRA));
  assert.equal(both.page.total, out.page.total + into.page.total);
});

test("nesting is an edge from the owned to its owner, via owner", () => {
  const owned = s.entities.filter((e) => e.owner === MIRA).map((e) => e.id).sort();
  assert.ok(owned.length >= 1);
  const r = listReferences(s, { entity: MIRA, direction: "in", via: "owner" });
  assert.deepEqual(r.edges.map((x) => x.from.id).sort(), owned);
  assert.deepEqual(r.edges[0].attrs, {});
});

test("type is the far end's with an entity, and either end's without", () => {
  const far = listReferences(s, { entity: MIRA, direction: "out", type: "skill" });
  assert.ok(far.edges.length > 0 && far.edges.every((x) => x.to.type === "skill"));
  const either = listReferences(s, { type: "vision", limit: 200 });
  assert.ok(either.edges.length > 0 && either.edges.every((x) => x.from.type === "vision" || x.to.type === "vision"));
});

test("with no argument it pages through every edge, in one fixed order", () => {
  const nesting = s.entities.filter((e) => e.owner).length;
  const first = listReferences(s, { limit: 40 });
  assert.equal(first.page.total, s.edges.length + nesting);
  assert.equal(first.edges.length, 40);
  // Compared part by part: joined into one string, a name that is the start of another would
  // sort by whatever character the join put between them.
  const byParts = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const all = listReferences(s, { limit: 200 }).edges.map((x) => [x.from.id, x.via, x.to.id]);
  assert.deepEqual(all, [...all].sort(byParts), "sorted by from, via, to");
  const second = listReferences(s, { limit: 40, cursor: first.page.nextCursor });
  assert.deepEqual(second.edges[0], listReferences(s, { limit: 200 }).edges[40]);
});

test("a filter that matches nothing is an empty page, never an error", () => {
  const r = listReferences(s, { entity: DDD, via: "No.Such" });
  assert.deepEqual([r.edges, r.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
});

test("what cannot be answered is refused by code", () => {
  const code = (args) => { try { listReferences(s, args); } catch (e) { assert.ok(e instanceof ModelError); return [e.code, e.details]; } assert.fail("not refused"); };
  assert.deepEqual(code({ entity: "nothing/here" }), ["unknown_entity", { id: "nothing/here" }]);
  assert.equal(code({ type: "person" })[0], "unknown_type");
  assert.deepEqual(code({ direction: "out" }), ["invalid_argument", { argument: "direction", reason: "needs entity" }]);
  assert.deepEqual(code({ entity: DDD, direction: "sideways" }), ["invalid_argument", { argument: "direction", reason: "one of out, in, both" }]);
});

test("the reference instance's profile holds more edges than one page, and they walk", () => {
  const i = instanceSnapshot();
  const first = listReferences(i, { entity: "profiles/robert-blust", direction: "out" });
  assert.ok(first.page.hasMore);
  assert.equal(first.edges.length, 50);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/references.test.mjs; echo "exit $?"`

Expected: exit 1, `listReferences` is not exported.

- [ ] **Step 3: Add the edge helpers and `listReferences` to `lib/model.mjs`**

Add the import at the top, beside the errors import:

```js
import { paginate } from "./paging.mjs";
```

Add after `resolveAttrs`:

```js
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// An edge as every answer serves it: both ends named, since a list of edges belongs to no single
// entity, and an entity's own answer uses the same shape so a client reads one thing.
const edgeOf = (byId, x) => ({ from: ref(byId.get(x.from)), via: x.via, to: ref(byId.get(x.to)), attrs: resolveAttrs(byId, x.attrs) });

// Every edge of the instance in one fixed order, which is what lets a cursor be an offset. Who
// owns an entity is nesting on disk, so the parser records it as the entity's `owner` rather
// than as an edge; it is served as one, from the owned to its owner, via `owner`. A schema's own
// `owner` field draws an edge of that name too, as it always has, and the far end's type tells
// the two apart. The sort is stable, so two rows that draw the same edge keep the page's order.
const allEdges = (s) => {
  const byId = index(s);
  const nesting = s.entities.filter((e) => e.owner && byId.has(e.owner)).map((e) => ({ from: e.id, via: "owner", to: e.owner, attrs: {} }));
  return [...s.edges, ...nesting].map((x) => edgeOf(byId, x))
    .sort((a, b) => cmp(a.from.id, b.from.id) || cmp(a.via, b.via) || cmp(a.to.id, b.to.id));
};

const requireId = (s, id) => {
  const e = index(s).get(id);
  if (!e) throw new ModelError("unknown_entity", `nothing has the id "${id}"; search with match "name" finds an entity's id by its name`, { details: { id } });
  return e;
};
```

Add after `getEntity`:

```js
// The instance's edges, filtered and paged. Direction reads relative to an entity, so without
// one it has nothing to be relative to and is refused rather than ignored; `type` is the far
// end's type when an entity is given and either end's when none is.
const DIRECTIONS = ["out", "in", "both"];

export function listReferences(s, { entity, direction, via, type, limit, cursor } = {}) {
  if (direction !== undefined && !DIRECTIONS.includes(direction))
    throw new ModelError("invalid_argument", `direction is one of ${DIRECTIONS.join(", ")}`, { details: { argument: "direction", reason: `one of ${DIRECTIONS.join(", ")}` } });
  if (entity === undefined && direction !== undefined)
    throw new ModelError("invalid_argument", "direction reads relative to an entity; name one with `entity`, or leave direction out", { details: { argument: "direction", reason: "needs entity" } });
  if (entity !== undefined) requireId(s, entity);
  if (type !== undefined) requireType(s, type);
  const dir = direction ?? "both";
  const kept = allEdges(s).filter((x) => {
    if (via !== undefined && x.via !== via) return false;
    if (entity === undefined) return type === undefined || x.from.type === type || x.to.type === type;
    const out = dir !== "in" && x.from.id === entity;
    const into = dir !== "out" && x.to.id === entity;
    if (!out && !into) return false;
    return type === undefined || (out && x.to.type === type) || (into && x.from.type === type);
  });
  const { items, page } = paginate(kept, { limit, cursor }, s.commit);
  return { edges: items, page, model: provenance(s) };
}
```

An entity that references itself is one edge and appears once under `both`, which is why the first test's sum holds only where no entity does; the worked example has no such edge. If that assertion fails on a later fixture, the test is wrong and the code is right: replace the sum with a check that every edge of `both` has the entity at one end.

- [ ] **Step 4: Register the tool in `lib/tools.mjs`**

Add `listReferences` to the import from `./model.mjs`, and add this entry after `get_entity`:

```js
  { name: "list_references",
    description: "The model's edges, filtered and paged. Use to inspect one entity's relations or one kind of reference without taking whole entities. Optional `entity` (an id), `direction` (out, in, both; needs `entity`), `via`, `type` (the far end's type, or either end's without `entity`), `limit`, `cursor`. Returns `edges`, each `from`, `via`, `to`, `attrs`, and `page`.",
    input: z.object({ entity: z.string().optional(), direction: z.enum(["out", "in", "both"]).optional(), via: z.string().optional(), type: z.string().optional(), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, args) => listReferences(s, args) },
```

- [ ] **Step 5: Teach `test/server.test.mjs` the new tool**

In "the tools, by their exact names", add `"list_references"` to the expected array, in sorted position after `"list_entities"`. In "every tool returns structured content carrying the model", add `["list_references", { entity: "skills/domain-driven-design" }],` to `calls`.

- [ ] **Step 6: Run**

Run: `node --test test/references.test.mjs test/server.test.mjs test/page-contract.test.mjs; echo "exit $?"`

Expected: exit 0.

- [ ] **Step 7: Commit**

```sh
git add lib/model.mjs lib/tools.mjs test/references.test.mjs test/server.test.mjs
git commit -F - <<'EOF'
The edges are a list a client can filter

A relation was reachable only inside a whole entity, so a client that wanted one profile's skill claims took three hundred edges to read thirty. list_references serves the instance's edges as a list of their own, nesting included, filtered by entity, direction, the field that drew them and the far end's type, and paged. An edge names both its ends, which is the shape every answer takes next.

Verified: node --test on references, server and page-contract passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: `get_entity` by id, in the edge shape, with counts

**Files:**

- Modify: `lib/model.mjs` (`withReferences`, `resolveTyped`, `getEntity`, `findEvidence`), `lib/tools.mjs` (`get_entity`, `find_evidence`), `test/model.test.mjs`, `test/instance.test.mjs`, `test/errors.test.mjs`

**Interfaces:**

- Consumes: `allEdges`, `requireId`, `candidate` (Tasks 1 and 3).
- Produces: `REFERENCE_CAP = 50` (exported); `getEntity(s, type, name)` unchanged in arguments; `getEntityById(s, id)`; `entityBy(s, { id, type, name } = {})`; each returns `{ entity, model }` where `entity.references` and `entity.referencedBy` are Edge arrays of at most 50 and `entity.referenceCounts = { references, referencedBy }`; `entity.owner` is always present, `null` for none. `findEvidence(s, skill)` accepts a skill's id or name; each entry is an Edge plus `owner` and, where the page has one, `stamp`.

- [ ] **Step 1: Rewrite the tests that read the old shape**

In `test/model.test.mjs`, change the import to add `getEntityById, entityBy, REFERENCE_CAP`, and replace these tests whole:

```js
test("get_entity resolves within the type and returns references both ways, as edges", () => {
  const r = getEntity(s, "skill", "Domain-Driven Design");
  assert.equal(r.entity.id, "skills/domain-driven-design");
  assert.equal(r.entity.owner, null);
  assert.equal(r.entity.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/skills/domain-driven-design.md`);
  assert.equal(r.entity.markdown, undefined);
  const claim = r.entity.referencedBy.find((x) => x.via === "Skills.Skill" && x.from.id === "profiles/mira-halvorsen");
  assert.deepEqual(claim.from, { id: "profiles/mira-halvorsen", type: "profile", name: "Mira Halvorsen" });
  assert.deepEqual(claim.to, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design" });
  assert.deepEqual(claim.attrs.Level, { id: "proficiency-levels/competent", type: "proficiency-level", name: "Competent" });
  const row = r.entity.referencedBy.find((x) => x.via === "Evidence.Skill" && x.from.id === "profiles/mira-halvorsen");
  assert.match(row.attrs["What it shows"], /bounded contexts/);
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const source = r.entity.references.find((x) => x.via === "source");
  assert.deepEqual([source.to.type, source.to.name], ["source", "Local"]);
  assert.deepEqual(r.entity.referenceCounts, { references: r.entity.references.length, referencedBy: r.entity.referencedBy.length });
});

test("get_entity takes an id, and the tool's entry takes either and refuses neither", () => {
  assert.deepEqual(getEntityById(s, "skills/domain-driven-design"), getEntity(s, "skill", "Domain-Driven Design"));
  assert.equal(entityBy(s, { id: "identity" }).entity.id, "identity");
  assert.equal(entityBy(s, { type: "identity", name: "Beacon Systems" }).entity.id, "identity");
  assert.equal(entityBy(s, { id: "identity", type: "skill", name: "Knitting" }).entity.id, "identity", "the id wins");
  assert.throws(() => getEntityById(s, "nothing/here"), (e) => e instanceof ModelError && e.code === "unknown_entity");
  for (const args of [{}, { type: "skill" }, { name: "Domain-Driven Design" }])
    assert.throws(() => entityBy(s, args), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === "id");
});

test("get_entity serves ownership both ways, as owner", () => {
  const owned = s.entities.filter((e) => e.owner === "profiles/mira-halvorsen");
  assert.ok(owned.length >= 1);
  const profile = getEntity(s, "profile", "Mira Halvorsen").entity;
  const owns = profile.referencedBy.filter((x) => x.via === "owner");
  assert.deepEqual(owns.map((x) => x.from.id).sort(), owned.map((e) => e.id).sort());
  assert.equal(profile.references.filter((x) => x.via === "owner").length, 0);
  const exp = getEntityById(s, owned[0].id).entity;
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.references.filter((x) => x.via === "owner"),
    [{ from: { id: owned[0].id, type: owned[0].type, name: owned[0].name }, via: "owner", to: { id: "profiles/mira-halvorsen", type: "profile", name: "Mira Halvorsen" }, attrs: {} }]);
});
```

Replace the `find_evidence` test's entry lookups (`x.id === …` becomes `x.from.id === …`) and add the id form:

```js
test("find_evidence groups every edge into the skill by the referencing type, attributes verbatim", () => {
  const r = findEvidence(s, "Domain-Driven Design");
  assert.deepEqual(findEvidence(s, "skills/domain-driven-design"), r, "an id reaches the same skill");
  assert.deepEqual(r.skill, { id: "skills/domain-driven-design", type: "skill", name: "Domain-Driven Design", tagline: s.entities.find((e) => e.id === "skills/domain-driven-design").tagline });
  assert.deepEqual(Object.keys(r.evidence).sort(), ["experience", "profile", "role"]);
  const mira = r.evidence.profile.find((x) => x.from.id === "profiles/mira-halvorsen" && x.via === "Skills.Skill");
  assert.equal(mira.attrs.Level.name, "Competent");
  assert.equal(mira.owner, null);
  assert.equal(mira.to.id, "skills/domain-driven-design");
  const row = r.evidence.profile.find((x) => x.from.id === "profiles/mira-halvorsen" && x.via === "Evidence.Skill");
  assert.equal(row.attrs["What it shows"], "Split the billing domain into two bounded contexts; the seams have held under two years of change.");
  assert.equal(row.attrs.Experience.name, "Splitting the billing domain");
  const exp = r.evidence.experience.find((x) => x.from.id === "profiles/mira-halvorsen/experiences/2022-beacon-systems");
  assert.equal(exp.via, "skills");
  assert.equal(exp.owner, "profiles/mira-halvorsen");
  assert.deepEqual(exp.stamp, s.entities.find((e) => e.id === exp.from.id).stamp);
  assert.throws(() => findEvidence(s, "Knitting"), (e) => e instanceof ModelError && /R4/.test(e.message));
});
```

In the last test of the file ("a name two owners each hold…"), replace `/fetch/.test(e.message)` with `/by its id/.test(e.message)`. In `test/errors.test.mjs` nothing changes: it reads codes, not sentences.

In `test/instance.test.mjs`, add `listReferences, REFERENCE_CAP` to the import and replace "which skills are Expert, and on what evidence" whole:

```js
// The profile draws more edges than one entity answer holds, so the answer is capped and says
// by how much, and the claims are read where edges are filtered.
test("which skills are Expert, and on what evidence", () => {
  const profile = getEntity(s, "profile", "Robert Blust").entity;
  assert.equal(profile.references.length, REFERENCE_CAP);
  assert.ok(profile.referenceCounts.references > REFERENCE_CAP);
  const claims = listReferences(s, { entity: profile.id, direction: "out", via: "Skills.Skill", limit: 200 });
  assert.equal(claims.page.hasMore, false);
  const expert = claims.edges.filter((r) => r.attrs.Level.name === "Expert");
  assert.equal(expert.length, 24);
  assert.ok(expert.some((r) => r.to.name === "Agentic AI development"));
  const ev = findEvidence(s, "Agentic AI development");
  const claim = ev.evidence.profile.find((x) => x.from.id === "profiles/robert-blust" && x.via === "Skills.Skill");
  assert.equal(claim.attrs.Level.name, "Expert");
  const row = ev.evidence.profile.find((x) => x.via === "Evidence.Skill" && x.attrs["What it shows"].startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  assert.equal(row.attrs.Experience.name, "Co-Founder & Head of Technology");
  assert.ok(ev.evidence.experience.length >= 1);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/model.test.mjs test/instance.test.mjs; echo "exit $?"`

Expected: exit 1, `getEntityById` is not exported.

- [ ] **Step 3: Change `lib/model.mjs`**

Replace `withReferences` and its comment with:

```js
// An entity as an answer serves it: the page's content as data and its edges both ways, in the
// shape and the order `list_references` gives them. An entity's own content is never cut. Its
// edges are, at a cap, because one profile of the reference instance draws several hundred and
// an answer is read whole; `referenceCounts` says how many exist, so a client sees when it holds
// a part and takes the rest where edges are paged.
export const REFERENCE_CAP = 50;

const serveEntity = (s, e) => {
  const { markdown, sections, ...rest } = e;
  const edges = allEdges(s);
  const references = edges.filter((x) => x.from.id === e.id);
  const referencedBy = edges.filter((x) => x.to.id === e.id);
  return { ...rest, owner: e.owner ?? null, sections: serveSections(sections), url: fileUrl(s, e),
    references: references.slice(0, REFERENCE_CAP), referencedBy: referencedBy.slice(0, REFERENCE_CAP),
    referenceCounts: { references: references.length, referencedBy: referencedBy.length } };
};
```

`allEdges` and `requireId` are defined below `resolveAttrs` and `serveEntity` uses them at call time, so their order in the file does not matter; keep `serveEntity` where `withReferences` stood.

In `resolveTyped`, end the ambiguity sentence with `; ask for the one meant by its id` in place of `; fetch the one meant by its id`, and rewrite the comment above it to end "two are refused with every id named, and an id reaches each."

Replace `getEntity` with:

```js
// By type and name, by id, and the tool's own entry, which takes either. A name of an owned type
// may be held by two owners, and an id is what reaches one of them; given both, the id wins,
// since it cannot be ambiguous. The first keeps its arguments because a deployment's suite calls it.
export function getEntity(s, type, name) {
  return { entity: serveEntity(s, resolveTyped(s, type, name)), model: provenance(s) };
}

export function getEntityById(s, id) {
  return { entity: serveEntity(s, requireId(s, id)), model: provenance(s) };
}

export function entityBy(s, { id, type, name } = {}) {
  if (id !== undefined) return getEntityById(s, id);
  if (type !== undefined && name !== undefined) return getEntity(s, type, name);
  throw new ModelError("invalid_argument", "get_entity takes an id, or a type and a name", { details: { argument: "id", reason: "give an id, or a type and a name" } });
}
```

In `fetchEntity`, replace `entity: withReferences(s, e)` with `entity: serveEntity(s, e)`; the function is reshaped in Task 6.

Replace the body of `findEvidence` (keep its comment, and add to it the sentence "The skill is named by id or by canonical name."):

```js
export function findEvidence(s, skill) {
  const byId = index(s);
  const held = byId.get(skill);
  const e = held?.type === "skill" ? held : resolveTyped(s, "skill", skill);
  const evidence = {};
  for (const x of allEdges(s).filter((x) => x.to.id === e.id)) {
    const from = byId.get(x.from.id);
    const entry = { ...x, owner: from.owner ?? null };
    if (from.stamp) entry.stamp = from.stamp;
    (evidence[from.type] ??= []).push(entry);
  }
  return { skill: { ...ref(e), tagline: e.tagline }, evidence, model: provenance(s) };
}
```

- [ ] **Step 4: Change the two tools in `lib/tools.mjs`**

Add `entityBy` to the import and replace the `get_entity` entry's `input` and `call`:

```js
    input: z.object({ id: z.string().optional().describe("The entity's id, as any answer gives it"), type: z.string().optional(), name: z.string().optional().describe("The canonical name, the entity's H1; needs type") }),
    call: (s, args) => entityBy(s, args) },
```

In the `find_evidence` entry, change the describe text to `"The skill's id or canonical name"`.

- [ ] **Step 5: Run**

Run: `node --test test/model.test.mjs test/instance.test.mjs test/errors.test.mjs test/references.test.mjs test/server.test.mjs test/deploy-build.test.mjs; echo "exit $?"`

Expected: exit 0. `fetch`'s test still passes, since `fetchEntity` still carries `entity`.

- [ ] **Step 6: Commit**

```sh
git add lib/model.mjs lib/tools.mjs test/model.test.mjs test/instance.test.mjs
git commit -F - <<'EOF'
An entity is asked for by id, and its edges are edges

A title two owners each hold was refused by get_entity with no way to ask again there, because it took a type and a name and nothing else. It takes an id now, which cannot be ambiguous. Its references arrive in the shape list_references serves, both ends named, capped at fifty each way with the true counts beside them, since one profile of the reference instance draws several hundred. find_evidence takes the same shape and an id.

Verified: node --test on model, instance, errors, references, server and deploy-build passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: `list_entities` and `search`, filtered and paged

**Files:**

- Modify: `lib/model.mjs` (`listEntities`, `search`), `lib/tools.mjs`, `test/model.test.mjs`, `test/instance.test.mjs`
- Test: `test/search.test.mjs`

**Interfaces:**

- Consumes: `paginate`, `requireId`, `requireType`, `cmp`.
- Produces: `listEntities(s, type, { owner, limit, cursor } = {}) → { type, entities: [{ id, type, name, tagline, owner }], page, model }`; `search(s, query, { match = "text", type, owner, limit, cursor } = {}) → { query, match, results: [{ id, title, type, owner, tagline, url, matched: [{ where, key }] }], page, model }`. `total` is no longer a top-level key of `search`; it is `page.total`.

- [ ] **Step 1: Write the failing test**

Create `test/search.test.mjs`:

```js
// Two lists a client browses by: the entities of a type, and the entities a query finds. Both
// are bounded, both filter by owner, and search tells an exact name from words in a text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelError, listEntities, search } from "../lib/model.mjs";
import { exampleSnapshot, withSharedName, withOwnedNameTwice } from "./helpers.mjs";

const s = exampleSnapshot();
const MIRA = "profiles/mira-halvorsen";

test("list_entities pages, names each entry's type and keeps one owner's entities", () => {
  const all = listEntities(s, "skill");
  assert.deepEqual(Object.keys(all.entities[0]), ["id", "type", "name", "tagline", "owner"]);
  assert.deepEqual([all.entities[0].type, all.entities[0].owner], ["skill", null]);
  assert.equal(all.page.total, s.entities.filter((e) => e.type === "skill").length);
  const first = listEntities(s, "skill", { limit: 1 });
  assert.deepEqual([first.entities.length, first.page.hasMore], [1, true]);
  assert.equal(listEntities(s, "skill", { limit: 1, cursor: first.page.nextCursor }).entities[0].id, all.entities[1].id);
  const hers = listEntities(s, "experience", { owner: MIRA });
  assert.ok(hers.entities.length >= 1 && hers.entities.every((e) => e.owner === MIRA));
  assert.ok(hers.page.total < listEntities(s, "experience").page.total);
  assert.throws(() => listEntities(s, "experience", { owner: "nothing/here" }), (e) => e instanceof ModelError && e.code === "unknown_entity");
});

test("matched says where a query hit, in one form", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.equal(r.match, "text");
  const mira = r.results.find((x) => x.id === MIRA);
  assert.ok(mira.matched.some((m) => m.where === "table" && m.key === "Evidence"));
  assert.deepEqual([mira.title, mira.type, mira.owner], ["Mira Halvorsen", "profile", null]);
  const byName = search(s, "domain-driven").results.find((x) => x.id === "skills/domain-driven-design");
  assert.deepEqual(byName.matched.find((m) => m.where === "name"), { where: "name", key: null });
  for (const x of r.results) for (const m of x.matched) {
    assert.ok(["name", "tagline", "field", "section", "table"].includes(m.where));
    assert.equal(m.key === null, m.where === "name" || m.where === "tagline");
  }
  assert.equal(r.total, undefined, "the count lives in page");
  assert.equal(r.page.total, r.results.length);
});

test("match name is the exact canonical name, case-insensitive, across types", () => {
  const shared = withSharedName();
  const r = search(shared, "beacon systems", { match: "name" });
  assert.deepEqual(r.results.map((x) => x.type), ["identity", "profile"]);
  assert.ok(r.results.every((x) => x.matched.length === 1 && x.matched[0].where === "name"));
  assert.equal(search(shared, "beacon", { match: "name" }).page.total, 0, "a part of a name is no exact match");
  assert.deepEqual(search(shared, "Beacon Systems", { match: "name", type: "profile" }).results.map((x) => x.type), ["profile"]);
});

test("a title two owners hold is found under each, and owner keeps one", () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const both = search(snapshot, title, { match: "name", type: "experience" });
  assert.deepEqual(both.results.map((x) => x.owner).sort(), [...owners].sort());
  const one = search(snapshot, title, { match: "name", owner: owners[0] });
  assert.deepEqual(one.results.map((x) => x.owner), [owners[0]]);
});

test("search pages in a fixed order, and nothing found is an empty page", () => {
  const all = search(s, "a", { limit: 200 });
  // Compared part by part: joined into one string, "Foo" and "Foo Bar" would sort by the comma.
  const byParts = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const keys = all.results.map((x) => [x.type, x.title, x.id]);
  assert.deepEqual(keys, [...keys].sort(byParts));
  const first = search(s, "a", { limit: 5 });
  assert.deepEqual(first.page, { total: all.page.total, returned: 5, hasMore: true, nextCursor: first.page.nextCursor });
  assert.equal(search(s, "a", { limit: 5, cursor: first.page.nextCursor }).results[0].id, all.results[5].id);
  const none = search(s, "zzzz-nothing");
  assert.deepEqual([none.results, none.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
});

test("what search cannot take is refused by code", () => {
  assert.throws(() => search(s, "x", { match: "fuzzy" }), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === "match");
  assert.throws(() => search(s, "x", { type: "person" }), (e) => e instanceof ModelError && e.code === "unknown_type");
  assert.throws(() => search(s, "x", { owner: "nothing/here" }), (e) => e instanceof ModelError && e.code === "unknown_entity");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/search.test.mjs; echo "exit $?"`

Expected: exit 1; the first failure is the keys of a listed entity.

- [ ] **Step 3: Replace `listEntities` and `search` in `lib/model.mjs`**

```js
// The entities of one type, by id, a page at a time. An owned type's entities are kept to one
// owner where one is named, which is how a client lists one profile's experiences.
export function listEntities(s, type, { owner, limit, cursor } = {}) {
  requireType(s, type);
  if (owner !== undefined) requireId(s, owner);
  const all = s.entities.filter((e) => e.type === type && (owner === undefined || e.owner === owner))
    .map((e) => ({ id: e.id, type: e.type, name: e.name, tagline: e.tagline, owner: e.owner ?? null }))
    .sort((a, b) => cmp(a.id, b.id));
  const { items, page } = paginate(all, { limit, cursor }, s.commit);
  return { type, entities: items, page, model: provenance(s) };
}
```

```js
// Two ways to find an entity. `text` is a substring over everything an entity says, reported by
// where it hit; `name` is the exact canonical name, which is how a caller holding a name reaches
// the ids of everything that carries it, under whichever type or owner. Both are case-insensitive
// and both answer in one order, type then name then id: a listing, not a ranking.
const MATCHES = ["text", "name"];

export function search(s, query, { match = "text", type, owner, limit, cursor } = {}) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) throw new ModelError("invalid_argument", "search needs a query", { details: { argument: "query", reason: "empty" } });
  if (!MATCHES.includes(match)) throw new ModelError("invalid_argument", `match is one of ${MATCHES.join(", ")}`, { details: { argument: "match", reason: `one of ${MATCHES.join(", ")}` } });
  if (type !== undefined) requireType(s, type);
  if (owner !== undefined) requireId(s, owner);
  const hit = (text) => typeof text === "string" && text.toLowerCase().includes(q);
  const matchedIn = (e) => {
    if (match === "name") return e.name.toLowerCase() === q ? [{ where: "name", key: null }] : [];
    const matched = [];
    if (hit(e.name)) matched.push({ where: "name", key: null });
    if (hit(e.tagline)) matched.push({ where: "tagline", key: null });
    for (const [k, v] of Object.entries(e.fields)) if ([v].flat().some(hit)) matched.push({ where: "field", key: k });
    for (const sec of e.sections) {
      if (hit(sec.text)) matched.push({ where: "section", key: sec.heading });
      if (sec.tables.some((t) => t.rows.some((row) => row.some(hit)))) matched.push({ where: "table", key: sec.heading });
    }
    return matched;
  };
  const results = [];
  for (const e of s.entities) {
    if ((type !== undefined && e.type !== type) || (owner !== undefined && e.owner !== owner)) continue;
    const matched = matchedIn(e);
    if (matched.length) results.push({ id: e.id, title: e.name, type: e.type, owner: e.owner ?? null, tagline: e.tagline, url: fileUrl(s, e), matched });
  }
  results.sort((a, b) => cmp(a.type, b.type) || cmp(a.title, b.title) || cmp(a.id, b.id));
  const { items, page } = paginate(results, { limit, cursor }, s.commit);
  return { query, match, results: items, page, model: provenance(s) };
}
```

Delete the old comment above `search` ("A substring match over everything…"); the new one replaces it.

- [ ] **Step 4: Update the two older tests**

In `test/model.test.mjs`, replace the `list_entities` test's keys line with `assert.deepEqual(Object.keys(r.entities[0]), ["id", "type", "name", "tagline", "owner"]);`, and replace the `search` test whole:

```js
test("search matches name, tagline, fields, section text and cells, case-insensitive, sorted by type then name", () => {
  const r = search(s, "BOUNDED CONTEXT");
  assert.ok(r.page.total >= 1);
  const mira = r.results.find((x) => x.id === "profiles/mira-halvorsen");
  assert.ok(mira.matched.some((m) => m.where === "table" && m.key === "Evidence"));
  assert.equal(mira.title, "Mira Halvorsen");
  assert.equal(mira.url, `https://github.com/companygraph/meta-model/blob/${COMMIT}/example/model/profiles/mira-halvorsen/mira-halvorsen.md`);
  const keys = r.results.map((x) => x.type + x.title);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(search(s, "zzzz-nothing").page.total, 0);
  assert.throws(() => search(s, "  "), ModelError);
});
```

`test/instance.test.mjs` reads `search(s, "LIKE MAGIC").results` and `listEntities(s, "value").entities` only, and both still hold.

- [ ] **Step 5: Change the two tools in `lib/tools.mjs`**

```js
    // list_entities
    input: z.object({ type: z.string(), owner: z.string().optional().describe("An owner's id, to keep its entities"), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, { type, ...options }) => listEntities(s, type, options) },

    // search
    input: z.object({ query: z.string(), match: z.enum(["text", "name"]).optional(), type: z.string().optional(), owner: z.string().optional().describe("An owner's id, to keep its entities"), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, { query, ...options }) => search(s, query, options) },
```

An `undefined` option reaches the functions' defaults, since a default parameter in a destructuring applies to `undefined`.

- [ ] **Step 6: Run**

Run: `node --test test/search.test.mjs test/model.test.mjs test/instance.test.mjs test/server.test.mjs; echo "exit $?"`

Expected: exit 0.

- [ ] **Step 7: Commit**

```sh
git add lib/model.mjs lib/tools.mjs test/search.test.mjs test/model.test.mjs
git commit -F - <<'EOF'
Search tells a name from a text, and both lists are bounded

A caller holding a name had no way to the ids of everything that carries it: fetch guessed when one type held it and refused otherwise. search gains an exact mode over the canonical name, across types, beside the substring it always was, and both filter by type and by owner. What matched arrives as data in one form, where a client had strings to split. list_entities and search answer a page at a time with the count in page.

Verified: node --test on search, model, instance and server passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: `fetch` is the page as written, by id

**Files:**

- Modify: `lib/model.mjs` (`fetchEntity`), `lib/tools.mjs` (`fetch`), `test/model.test.mjs`, `test/instance.test.mjs`, `test/errors.test.mjs`

**Interfaces:**

- Produces: `fetchEntity(s, id) → { id, title, type, url, text, model }`. No `entity`, no name fallback; an unknown id is `unknown_entity` with `details.id`.

- [ ] **Step 1: Rewrite the tests**

In `test/model.test.mjs`, replace the `fetch` test whole:

```js
test("fetch is the page as written, by id, and carries no structured copy", () => {
  const r = fetchEntity(s, "skills/domain-driven-design");
  assert.deepEqual(Object.keys(r), ["id", "title", "type", "url", "text", "model"]);
  assert.deepEqual([r.title, r.type], ["Domain-Driven Design", "skill"]);
  assert.match(r.text, /^---\n/);
  assert.equal(r.text, s.entities.find((e) => e.id === r.id).markdown);
  // A name is no id. search finds the id a name belongs to, under every type that holds it.
  assert.throws(() => fetchEntity(s, "Beacon Systems"), (e) => e instanceof ModelError && e.code === "unknown_entity" && /match "name"/.test(e.message));
  assert.deepEqual(search(withSharedName(), "Beacon Systems", { match: "name" }).results.map((x) => x.id), ["identity", "profiles/beacon-systems"]);
});
```

Replace the last test of the file whole:

```js
// Core 0.31.0 lets two owners each own an entity of one name, and a lookup by type and name alone
// then meets two. Handing back the first would answer for the wrong person without saying so, so
// the lookup refuses with every candidate, and an id reaches each.
test("a name two owners each hold is refused by type and name, with every id named, and each is reached by id", () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const ids = snapshot.entities.filter((e) => e.type === "experience" && e.name === title).map((e) => e.id);
  assert.equal(ids.length, 2);
  assert.throws(() => getEntity(snapshot, "experience", title), (e) => e instanceof ModelError && /R2/.test(e.message) && ids.every((id) => e.message.includes(id)) && /by its id/.test(e.message));
  for (const id of ids) {
    assert.equal(getEntityById(snapshot, id).entity.id, id);
    assert.equal(fetchEntity(snapshot, id).id, id);
  }
  assert.ok(owners.every((o) => ids.some((id) => id.startsWith(`${o}/`))));
});
```

In `test/instance.test.mjs`, replace "the company of one…" whole:

```js
test("the company of one: the identity and the profile share a name, and each is reached by type or by id", () => {
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
  assert.deepEqual(search(s, "Robert Blust", { match: "name" }).results.map((x) => x.id), ["identity", "profiles/robert-blust"]);
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && e.code === "unknown_entity");
  assert.equal(fetchEntity(s, "profiles/robert-blust").title, "Robert Blust");
});
```

In `test/errors.test.mjs` the `fetchEntity(s, "nothing/here")` assertion already expects `{ id: "nothing/here" }` and stays.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/model.test.mjs test/instance.test.mjs; echo "exit $?"`

Expected: exit 1; `fetch` still returns `entity` and still resolves a bare name.

- [ ] **Step 3: Replace `fetchEntity` and its comment in `lib/model.mjs`**

```js
// The page as written, by id. It carries no structured copy: `get_entity` is the entity as data
// and this is its source, and an answer holding both left a caller nothing to choose by. A name
// is no id here. `search` with match "name" answers a name with every entity that carries it,
// where a fallback could only guess when one type held it and refuse when two did.
export function fetchEntity(s, id) {
  const e = requireId(s, id);
  return { id: e.id, title: e.name, type: e.type, url: fileUrl(s, e), text: e.markdown, model: provenance(s) };
}
```

- [ ] **Step 4: Run**

Run: `node --test test/model.test.mjs test/instance.test.mjs test/errors.test.mjs test/server.test.mjs; echo "exit $?"`

Expected: exit 0.

- [ ] **Step 5: Commit**

```sh
git add lib/model.mjs test/model.test.mjs test/instance.test.mjs
git commit -F - <<'EOF'
fetch is the page and get_entity is the data

fetch returned the page as written and the structured entity beside it, which is what get_entity returns, so nothing told a caller which to use. fetch now answers with the Markdown source alone, by id, and get_entity with the data. The bare-name fallback goes with it, since search by exact name answers a name with every candidate where the fallback guessed or refused.

Verified: node --test on model, instance, errors and server passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: `describe_relations` takes a type, a side and a field

**Files:**

- Modify: `lib/model.mjs` (`describeRelations`), `lib/tools.mjs`, `test/relations.test.mjs`

**Interfaces:**

- Produces: `describeRelations(s, { type, direction, via } = {})` with the same keys as today; `direction` is one of `declares`, `declared-to`, `both`.

- [ ] **Step 1: Add the failing tests to `test/relations.test.mjs`**

Append:

```js
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
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/relations.test.mjs; echo "exit $?"`

Expected: exit 1; the filtered answer equals the whole one.

- [ ] **Step 3: Replace `describeRelations` in `lib/model.mjs`**

```js
// The whole vocabulary, or the part one type stands in. `direction` says which side of a
// declaration the type is on, so it needs a type as an edge's direction needs an entity; `via`
// keeps one field or column, among the two lists that carry one. The explanations always arrive
// whole, since they explain the terms of whatever part is returned. Nothing here is paged: the
// vocabulary is the size of the core, which an instance does not grow.
const SIDES = ["declares", "declared-to", "both"];

export function describeRelations(s, { type, direction, via } = {}) {
  if (direction !== undefined && !SIDES.includes(direction))
    throw new ModelError("invalid_argument", `direction is one of ${SIDES.join(", ")}`, { details: { argument: "direction", reason: `one of ${SIDES.join(", ")}` } });
  if (type === undefined && direction !== undefined)
    throw new ModelError("invalid_argument", "direction says which side of a declaration a type stands on; name one with `type`, or leave direction out", { details: { argument: "direction", reason: "needs type" } });
  if (type !== undefined) requireType(s, type);
  const all = relationsOf(s);
  const side = direction ?? "both";
  const named = (x) => via === undefined || x.via === via;
  const own = (list) => (type === undefined ? list : list.filter((x) => x.type === type));
  return {
    relations: all.relations.filter((x) => named(x) && (type === undefined || (side !== "declared-to" && x.from === type) || (side !== "declares" && x.to === type))),
    ownership: type === undefined ? all.ownership : all.ownership.filter((x) => x.owner === type || x.owned === type),
    enums: own(all.enums).filter(named), joins: own(all.joins), lists: own(all.lists),
    forms: FORMS, reading: READING, model: provenance(s),
  };
}
```

- [ ] **Step 4: Change the tool in `lib/tools.mjs`**

```js
    input: z.object({ type: z.string().optional(), direction: z.enum(["declares", "declared-to", "both"]).optional(), via: z.string().optional() }),
    call: (s, args) => describeRelations(s, args) },
```

- [ ] **Step 5: Run**

Run: `node --test test/relations.test.mjs test/constraints.test.mjs test/server.test.mjs; echo "exit $?"`

Expected: exit 0. A type that declares a reference to itself would be counted on both sides and break the sum in the first new test; the example's `role` does not, which is why the test uses it.

- [ ] **Step 6: Commit**

```sh
git add lib/model.mjs lib/tools.mjs test/relations.test.mjs
git commit -F - <<'EOF'
The vocabulary narrows to one type, one side, one field

A client that wanted what one type declares took every declaration of every type. describe_relations keeps the declarations a named type stands in, either side of them or both, and one field or column where named; ownership, enums, joins and list kinds narrow with it, and the explanations of the terms always arrive whole.

Verified: node --test on relations, constraints and server passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: Every tool declares its answer, and a refusal is structured

**Files:**

- Create: `lib/schemas.mjs`
- Modify: `lib/tools.mjs`, `package.json` (`exports`), `test/server.test.mjs`
- Test: `test/schemas.test.mjs`

**Interfaces:**

- Consumes: `CODES`; every query's answer shape from Tasks 3 to 7.
- Produces: from `lib/schemas.mjs`, the zod schemas `Model`, `EntityRef`, `Attrs`, `Edge`, `Page`, `Table`, `Section`, `Stamp`, `Entity`, `ErrorBody`, `ErrorResult`, and `OUTPUTS`, an object keyed by tool name. Each entry of `TOOLS` gains `output`. A refused call answers `{ isError: true, content: [{ type: "text", text: message }], structuredContent: { error: { code, message, rule, details }, model } }`. Package exports `./schemas`, `./errors` and `./contract` (the last file arrives in Task 10).

- [ ] **Step 1: Write the failing test**

Create `test/schemas.test.mjs`:

```js
// Each tool declares what it answers, and the server registers exactly that. The answers here
// come from the queries directly; test/contract.test.mjs holds them through a client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPUTS, ErrorResult, Edge, Page } from "../lib/schemas.mjs";
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/schemas.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module … lib/schemas.mjs`.

- [ ] **Step 3: Write `lib/schemas.mjs`**

```js
// What every tool answers, as schemas: the one copy the server registers, the suite parses
// answers against and a client may import to validate what it received. A shape is strict where
// this package builds the object, so a field nobody declared fails the suite, and loose where
// the parser builds it — an entity, a section, a table, an enum, a join, a list kind, a check —
// so a parser release that adds a key cannot make every answer fail the SDK's own validation.
// Content that varies by schema stays open by design: an entity's fields, a row's attributes.
import { z } from "zod";
import { CODES } from "./errors.mjs";

const count = z.number().int().nonnegative();

export const Model = z.strictObject({ commit: z.string().nullable(), repo: z.string().nullable(), core: z.string(), parser: z.string() });
export const EntityRef = z.strictObject({ id: z.string(), type: z.string(), name: z.string() });
// A row's other columns, verbatim; a qualifier the parser resolved arrives as the entity it names.
export const Attrs = z.record(z.string(), z.union([z.string(), EntityRef]));
export const Edge = z.strictObject({ from: EntityRef, via: z.string(), to: EntityRef, attrs: Attrs });
export const Page = z.strictObject({ total: count, returned: count, hasMore: z.boolean(), nextCursor: z.string().nullable() });

export const Table = z.looseObject({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) });
export const Section = z.looseObject({ heading: z.string(), text: z.string(), tables: z.array(Table) });
export const Stamp = z.looseObject({ kind: z.string(), start: z.string(), end: z.string().nullable() });

export const Entity = z.looseObject({
  id: z.string(), type: z.string(), name: z.string(), tagline: z.string(), owner: z.string().nullable(),
  path: z.string(), url: z.string().nullable(), fields: z.record(z.string(), z.unknown()), sections: z.array(Section),
  stamp: Stamp.optional(),
  references: z.array(Edge), referencedBy: z.array(Edge),
  referenceCounts: z.strictObject({ references: count, referencedBy: count }),
});

const form = z.enum(["ref", "ref?", "qualifier"]);
const Relation = z.strictObject({ from: z.string(), via: z.string(), to: z.string(), form, array: z.boolean(), required: z.boolean(), min: count, max: count.nullable() });
const Enum = z.looseObject({ via: z.string(), tokens: z.array(z.string()), required: z.boolean() });
const Join = z.looseObject({ kind: z.string(), section: z.string() });
const ListKind = z.looseObject({ section: z.string(), kind: z.string(), required: z.boolean(), min: count });
const typed = (shape) => shape.extend({ type: z.string() });

const answer = (shape) => z.strictObject({ ...shape, model: Model });

export const OUTPUTS = {
  list_types: answer({ types: z.array(z.strictObject({ type: z.string(), name: z.string(), tagline: z.string(), owner: z.string().nullable(), count })) }),
  describe_schema: answer({
    type: z.string(), name: z.string(), tagline: z.string(), sections: z.array(Section),
    relations: z.strictObject({
      owner: z.string().nullable(), owns: z.array(z.string()),
      references: z.array(Relation.omit({ from: true })), referencedBy: z.array(Relation.omit({ to: true })),
      enums: z.array(Enum), joins: z.array(Join), lists: z.array(ListKind),
    }),
  }),
  describe_relations: answer({
    relations: z.array(Relation), ownership: z.array(z.strictObject({ owner: z.string(), owned: z.string() })),
    enums: z.array(typed(Enum)), joins: z.array(typed(Join)), lists: z.array(typed(ListKind)),
    forms: z.record(z.string(), z.string()), reading: z.record(z.string(), z.string()),
  }),
  list_rules: answer({ tagline: z.string(), rules: z.array(z.strictObject({ rule: z.string(), title: z.string(), part: z.string().nullable() })) }),
  describe_rule: answer({ rule: z.string(), title: z.string(), part: z.string().nullable(), text: z.string() }),
  list_checks: answer({ checks: z.array(z.looseObject({ name: z.string(), rule: z.string(), title: z.string().nullable() })), ranBy: z.string() }),
  list_entities: answer({ type: z.string(), entities: z.array(EntityRef.extend({ tagline: z.string(), owner: z.string().nullable() })), page: Page }),
  get_entity: answer({ entity: Entity }),
  list_references: answer({ edges: z.array(Edge), page: Page }),
  find_evidence: answer({
    skill: EntityRef.extend({ tagline: z.string() }),
    evidence: z.record(z.string(), z.array(Edge.extend({ owner: z.string().nullable(), stamp: Stamp.optional() }))),
  }),
  search: answer({
    query: z.string(), match: z.enum(["text", "name"]),
    results: z.array(z.strictObject({
      id: z.string(), title: z.string(), type: z.string(), owner: z.string().nullable(), tagline: z.string(), url: z.string().nullable(),
      matched: z.array(z.strictObject({ where: z.enum(["name", "tagline", "field", "section", "table"]), key: z.string().nullable() })),
    })),
    page: Page,
  }),
  fetch: answer({ id: z.string(), title: z.string(), type: z.string(), url: z.string().nullable(), text: z.string() }),
};

// A refusal. The SDK validates structured content on success and skips it on an error, so this
// shape is registered with no tool and held by the suite instead. Each code fixes its details.
const refusal = (code, details) => z.strictObject({ code: z.literal(code), message: z.string(), rule: z.string().nullable(), details });
const argument = z.strictObject({ argument: z.string(), reason: z.string() });

const DETAILS = {
  unknown_type: z.strictObject({ type: z.string(), declared: z.array(z.string()) }),
  unknown_entity: z.union([z.strictObject({ id: z.string() }), z.strictObject({ type: z.string(), name: z.string() })]),
  ambiguous_name: z.strictObject({ type: z.string(), name: z.string(), candidates: z.array(EntityRef.extend({ owner: z.string().nullable() })).min(2) }),
  unknown_rule: z.strictObject({ rule: z.string(), rules: z.array(z.string()) }),
  invalid_argument: argument,
  invalid_cursor: z.strictObject({ reason: z.enum(["malformed", "other_commit"]) }),
  unsupported_snapshot: z.strictObject({ missing: z.string() }),
};

export const ErrorBody = z.discriminatedUnion("code", CODES.map((code) => refusal(code, DETAILS[code])));
export const ErrorResult = z.strictObject({ error: ErrorBody, model: Model });
```

`EntityRef.extend(…)` on a strict object stays strict in zod 4. If `Relation.omit` or `.extend` on a strict or loose object does not keep its strictness in the installed zod, Step 5's second test fails with the offending tool named; build that shape out in full instead of deriving it.

- [ ] **Step 4: Wire `lib/tools.mjs`**

Replace the head of the file, down to and including the `run` function, with:

```js
// The tools, each a thin wrapper over one query: the arguments in, the query's answer out as
// structured content and as the same JSON in text. A refusal goes out as a tool error whose text
// is its sentence and whose structured content is the same refusal as data, under `error`, so a
// client branches on a code and reads candidates from a list. Each tool names the schema of what
// it answers, and the SDK holds every successful answer to it before it leaves.
import { z } from "zod";
import { ModelError, provenance, listTypes, describeSchema, describeRelations, listRules, describeRule, listChecks, listEntities, entityBy, listReferences, findEvidence, search, fetchEntity } from "./model.mjs";
import { OUTPUTS } from "./schemas.mjs";

const run = (s, fn) => async (args) => {
  try {
    const data = fn(args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
  } catch (err) {
    if (!(err instanceof ModelError)) throw err;
    const refusal = { error: { code: err.code, message: err.message, rule: err.rule, details: err.details }, model: provenance(s) };
    return { isError: true, content: [{ type: "text", text: err.message }], structuredContent: refusal };
  }
};
```

Delete the two old lines `const model = z.object(…)` and `const output = z.looseObject(…)`. Give every entry of `TOOLS` a last property `output: OUTPUTS.<its name>`, for example `output: OUTPUTS.list_types`. Replace `registerTools`:

```js
export function registerTools(server, s) {
  for (const tool of TOOLS)
    server.registerTool(tool.name,
      { description: tool.description, inputSchema: tool.input, outputSchema: tool.output },
      run(s, (args) => tool.call(s, args)));
}
```

- [ ] **Step 5: Export the new modules in `package.json`**

In `exports`, after `"./model"`, add:

```json
    "./schemas": "./lib/schemas.mjs",
    "./errors": "./lib/errors.mjs",
    "./contract": "./lib/contract.mjs",
```

- [ ] **Step 6: Hold the refusal's shape in `test/server.test.mjs`**

Replace "a model error is a tool error with the rule in its text":

```js
test("a refusal is a tool error: its sentence as text, and the same refusal as data", async () => {
  const client = await connect();
  const r = await client.callTool({ name: "get_entity", arguments: { type: "skill", name: "Beacon Systems" } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /R4/);
  assert.deepEqual(r.structuredContent, { error: { code: "unknown_entity", message: r.content[0].text, rule: "R4", details: { type: "skill", name: "Beacon Systems" } }, model: MODEL });
});

test("the listing carries each tool's own output schema", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  const entities = tools.find((t) => t.name === "list_entities").outputSchema;
  assert.deepEqual(entities.required.sort(), ["entities", "model", "page", "type"]);
  assert.equal(entities.additionalProperties, false);
  assert.ok(tools.every((t) => t.outputSchema.required.includes("model")));
});
```

- [ ] **Step 7: Run**

Run: `node --test test/schemas.test.mjs test/server.test.mjs test/http.test.mjs test/bin-stdio.test.mjs; echo "exit $?"`

Expected: exit 0. A tool whose real answer its schema refuses shows here as `Output validation error: Invalid structured content for tool <name>` with the path of the field; fix the schema if the field is real content, fix the query if it is not.

- [ ] **Step 8: Commit**

```sh
git add lib/schemas.mjs lib/tools.mjs package.json test/schemas.test.mjs test/server.test.mjs
git commit -F - <<'EOF'
Every tool declares what it answers

Each tool registered one output field, model, so a client reading the listing learned nothing about entities, results or edges and could not validate an answer. Every tool now names its own schema, strict where this package builds the object and open where the parser does or where content varies, and the SDK holds each successful answer to it. A refusal goes out with its code, rule and details as structured content beside the sentence, in a schema the suite holds since the SDK skips errors.

Verified: node --test on schemas, server, http and bin-stdio passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 9: One template for the descriptions, one place for the terms

**Files:**

- Modify: `lib/tools.mjs` (every `description`), `lib/server.mjs` (`GLOSSARY`, `instructionsFor`, `noteFor`), `test/server.test.mjs`
- Test: `test/descriptions.test.mjs`

**Interfaces:**

- Produces: `GLOSSARY` (string) exported from `lib/server.mjs`; `instructionsFor(s)` is the taglines, then `GLOSSARY`, then the provenance sentence.

- [ ] **Step 1: Write the failing test**

Create `test/descriptions.test.mjs`:

```js
// A description is read by a model choosing a tool, every time, so it is short and built one
// way: purpose, when to use it and which sibling instead, inputs, the answer's shape, limits.
// The terms it leans on are defined once, in the instructions, and used without ceremony.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../lib/tools.mjs";
import { GLOSSARY, instructionsFor } from "../lib/server.mjs";
import { exampleSnapshot } from "./helpers.mjs";

const words = (text) => text.split(/\s+/).filter(Boolean).length;
const of = (name) => TOOLS.find((t) => t.name === name).description;

test("every description is at most sixty words and says what comes back", () => {
  for (const t of TOOLS) {
    assert.ok(words(t.description) <= 60, `${t.name} runs to ${words(t.description)} words`);
    assert.match(t.description, /Returns /, t.name);
  }
});

test("the two retrieval tools each say when, and name the other", () => {
  assert.match(of("get_entity"), /structured/);
  assert.match(of("get_entity"), /\bfetch\b/);
  assert.match(of("fetch"), /as written/);
  assert.match(of("fetch"), /\bget_entity\b/);
});

test("a paged tool says how to continue, and a tool with a sibling names it", () => {
  for (const name of ["list_entities", "list_references", "search"]) assert.match(of(name), /`cursor`/, name);
  assert.match(of("list_entities"), /\bsearch\b/);
  assert.match(of("describe_relations"), /\bdescribe_schema\b/);
  assert.match(of("describe_schema"), /\bdescribe_relations\b/);
  assert.match(of("list_rules"), /\bdescribe_rule\b/);
});

test("the terms are defined once, in the instructions, before the sentence on provenance", () => {
  for (const term of ["id", "canonical name", "owner", "`via`", "reference", "qualifier"]) assert.ok(GLOSSARY.includes(term), term);
  const text = instructionsFor(exampleSnapshot());
  assert.ok(text.indexOf(GLOSSARY) > 0);
  assert.ok(text.indexOf(GLOSSARY) < text.indexOf("This server reports"));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/descriptions.test.mjs; echo "exit $?"`

Expected: exit 1, `GLOSSARY` is not exported.

- [ ] **Step 3: Write the descriptions in `lib/tools.mjs`**

Replace each tool's `description` with the text below, and the comment above `TOOLS` with the one given here.

```js
// Each tool as data: its name, what it does, what it takes, what it answers and the query it
// runs. The list is the single copy — `registerTools` builds the server from it and the landing
// page prints it, so a tool cannot appear in one and not the other. A description is built one
// way, in at most sixty words: purpose, when to use it and which sibling instead, inputs, the
// answer's shape, limits. It names no instance fact, and it uses the terms the instructions define.
```

```js
const DESCRIPTIONS = {
  list_types: "Every type the model's schemas declare. Use first, to learn which types exist before listing or describing one. No input. Returns `types`, each with `type`, `name`, `tagline`, `owner` (the type it nests under, or null) and `count`, the entities it holds.",
  describe_schema: "One type's schema: its sections as written and its declared relations as data. Use to learn what an entity of the type may hold; for the whole vocabulary use describe_relations. Input: `type`. Returns `sections` and `relations`: owner, owns, references both ways, enums, joins and lists.",
  describe_relations: "What the schemas declare between types: references with form and cardinality, ownership, enums, joins, list kinds. Use for a diagram or an audit; for one type's full schema use describe_schema. Optional `type`, `direction` (declares, declared-to, both; needs `type`) and `via` narrow it. Returns those lists, with `forms` and `reading` explaining every term. Not paged.",
  list_rules: "The rules the model is held to, from the CONVENTIONS.md its core vendors. Use to resolve a rule number that a schema or a refusal cites, such as R9. No input. Returns `tagline` and `rules`, each with `rule`, `title` and `part`; describe_rule gives one rule's text.",
  describe_rule: "One rule as written. Input: `rule`, a number from list_rules such as R9, in either case. Returns `rule`, `title`, `part` and `text`. An unknown number is refused with the known ones listed.",
  list_checks: "The checks the model's own gate runs, from the checker release this server was built with. Use to see which rules a script enforces and which are left to a reader. No input. Returns `checks`, each with `name`, `rule` and that rule's `title`, and `ranBy`. A list and no verdict: this server runs none of them.",
  list_entities: "The entities of one type, by id. Use to browse a type; to find an entity by words or by name use search. Input: `type`, optional `owner` (an id) to keep one owner's entities, `limit` (default 50, at most 200) and `cursor`. Returns `entities` with `id`, `type`, `name`, `tagline`, `owner`, and `page`; follow `page.nextCursor` while `page.hasMore`.",
  get_entity: "One entity as structured data: fields, sections, tables and its references both ways. Use to reason over an entity; for its page as written use fetch. Input: `id`, or `type` and `name`; an ambiguous name is refused with candidate ids. Returns `entity`. Each reference list holds at most 50 edges; `referenceCounts` gives the totals and list_references the rest.",
  list_references: "The model's edges, filtered and paged. Use to inspect one entity's relations or one kind of reference without taking whole entities. Optional `entity` (an id), `direction` (out, in, both; needs `entity`), `via`, `type` (the far end's type, or either end's without `entity`), `limit`, `cursor`. Returns `edges`, each `from`, `via`, `to`, `attrs`, and `page`.",
  find_evidence: "Everything the model says about one skill: every edge into it, grouped by the type of the page that drew it. Use to check a claimed skill against its evidence. Input: `skill`, an id or canonical name. Returns `skill` and `evidence`; a profile's claim arrives via Skills.Skill with its level, each evidence row via Evidence.Skill. Attributes are verbatim.",
  search: "Find entities by words or by exact name. `match: \"text\"` (default) is a case-insensitive substring over name, tagline, fields, sections and table cells; `match: \"name\"` is the exact canonical name, across types. Optional `type`, `owner` (an id), `limit`, `cursor`. Returns `results` with `id`, `title`, `type`, `matched`, and `page`. A listing by type then name, not a ranking.",
  fetch: "One entity's page as written. Use to quote or display the source; for structured fields and references use get_entity. Input: `id`, from search, list_entities or any reference. Returns `id`, `title`, `type`, `url` and `text`, the Markdown source. Takes no name: search with match \"name\" finds the id.",
};
```

The object above is how the plan carries the twelve strings; in `lib/tools.mjs` each string goes where it belongs, as the `description` of its own entry in `TOOLS`, and no `DESCRIPTIONS` object is added. `list_references` keeps the text it was given when it was added, repeated here so the twelve read as one set.

- [ ] **Step 4: Add the glossary to `lib/server.mjs`**

Add above `instructionsFor`, and extend the file's opening comment with the sentence "Between the two stands a glossary of the terms every tool description uses, which is this package's own and names no instance fact.":

```js
// The terms the tool descriptions lean on, defined once. A client reads the instructions when
// the connection is set up and a description every time it chooses a tool, so a definition said
// here is one the descriptions need not repeat.
export const GLOSSARY = [
  "Terms the tools use.",
  "An id identifies one entity across the whole model, and every tool that takes an entity takes its id.",
  "A canonical name is an entity's title, unique within its type and, for an owned type, within its owner, so a name alone can be ambiguous where an id cannot.",
  "An owner is the entity another is nested under.",
  "A reference is an edge from one entity to another, and `via` names the field or Section.Column that drew it, or `owner` for nesting.",
  "A qualifier is a value on a table row that describes that row's edge and draws none of its own.",
  "A list answers a page at a time: follow `page.nextCursor` while `page.hasMore`.",
  "A refused call carries `error.code` for a program beside the sentence for a reader.",
].join(" ");
```

In `instructionsFor`, put `GLOSSARY` between the taglines and the closing sentence:

```js
  return [...taglines(s), GLOSSARY,
    "This server reports what the model says at one commit, which every answer names under `model`, and adds nothing."]
    .filter(Boolean).join("\n\n");
```

`noteFor`, the landing page's paragraph, stays as it is: a page for a person in a browser does not call tools.

- [ ] **Step 5: Update the instructions assertion in `test/server.test.mjs`**

Import `GLOSSARY` from `../lib/server.mjs` and change the expected string in the first test to:

```js
  assert.equal(client.getInstructions(), `${vision.tagline}\n\n${identity.tagline}\n\n${GLOSSARY}\n\nThis server reports what the model says at one commit, which every answer names under \`model\`, and adds nothing.`);
```

- [ ] **Step 6: Run**

Run: `node --test test/descriptions.test.mjs test/server.test.mjs test/instance.test.mjs test/page-contract.test.mjs test/page-render.test.mjs; echo "exit $?"`

Expected: exit 0. A description over the cap fails by name with its word count; shorten the sentence on limits first, never the sentence on when to use the tool.

- [ ] **Step 7: Commit**

```sh
git add lib/tools.mjs lib/server.mjs test/descriptions.test.mjs test/server.test.mjs
git commit -F - <<'EOF'
The descriptions are built one way and the terms are said once

The descriptions ran from one line to a paragraph and defined their terms where they happened to use them, and nothing said when to call get_entity and when fetch. Each is now purpose, when to use it and which sibling instead, inputs, the answer's shape and limits, in at most sixty words. The terms they share are defined once in the instructions a client reads when it connects.

Verified: node --test on descriptions, server, instance, page-contract and page-render passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 10: The contract suite

**Files:**

- Create: `lib/contract.mjs`
- Test: `test/contract.test.mjs`

**Interfaces:**

- Consumes: `OUTPUTS`, `ErrorResult`, `createServer`, `CODES`.
- Produces: from `lib/contract.mjs`, `sampleCalls(s) → { [toolName]: arguments | undefined }` (undefined where the snapshot gives the tool nothing to be asked about) and `checkAnswer(name, result) → parsed structured content`, which throws an `Error` naming the tool and the fields when a call's structured content does not satisfy the tool's schema, or the error schema when `result.isError`.

- [ ] **Step 1: Write the failing test**

Create `test/contract.test.mjs`:

```js
// The interface as a client meets it: every tool called through a real client, every answer
// parsed here against the schema the tool declares, so a failure names the field rather than
// surfacing as the SDK's protocol error. Empty results, every refusal and every page are held
// the same way, on the worked example and on the reference instance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { OUTPUTS, ErrorResult } from "../lib/schemas.mjs";
import { CODES } from "../lib/errors.mjs";
import { sampleCalls, checkAnswer } from "../lib/contract.mjs";
import { exampleSnapshot, instanceSnapshot, withOwnedNameTwice } from "./helpers.mjs";

async function connect(s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "contract", version: "0" });
  await client.connect(b);
  return client;
}

const FIXTURES = [["the worked example", exampleSnapshot()], ["the reference instance", instanceSnapshot()]];
// Every code a refusal below is seen to carry, so the last test can say none went unmet.
const reached = new Set();
const EMPTY_PAGE = { total: 0, returned: 0, hasMore: false, nextCursor: null };
const LISTS = { list_entities: "entities", list_references: "edges", search: "results" };
const largestType = (s) => {
  const counts = new Map();
  for (const e of s.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

for (const [label, s] of FIXTURES) {
  test(`${label}: every tool's answer satisfies the schema it declares`, async () => {
    const client = await connect(s);
    const { tools } = await client.listTools();
    const calls = sampleCalls(s);
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(OUTPUTS).sort(), "a tool without a schema, or a schema without a tool");
    assert.deepEqual(Object.keys(calls).sort(), Object.keys(OUTPUTS).sort(), "a tool without a sample call");
    for (const { name } of tools) {
      assert.ok(calls[name] !== undefined, `${name}: this fixture gives it something to be asked about`);
      const r = await client.callTool({ name, arguments: calls[name] });
      assert.equal(r.isError, undefined, `${name}: ${r.content[0].text}`);
      assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent, name);
      checkAnswer(name, r);
    }
    await client.close();
  });

  test(`${label}: an empty result still carries its arrays and its page`, async () => {
    const client = await connect(s);
    const found = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: "zzzz-nothing-holds-this" } }));
    assert.deepEqual([found.results, found.page], [[], EMPTY_PAGE]);
    const named = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: "zzzz-nothing-holds-this", match: "name" } }));
    assert.deepEqual([named.results, named.page], [[], EMPTY_PAGE]);
    const edges = checkAnswer("list_references", await client.callTool({ name: "list_references", arguments: { entity: s.rootId, via: "No.Such" } }));
    assert.deepEqual([edges.edges, edges.page], [[], EMPTY_PAGE]);
    const owned = checkAnswer("list_entities", await client.callTool({ name: "list_entities", arguments: { type: largestType(s), owner: s.rootId } }));
    assert.deepEqual([owned.entities, owned.page], [[], EMPTY_PAGE], "the identity owns nothing of the largest type");
    const none = checkAnswer("describe_relations", await client.callTool({ name: "describe_relations", arguments: { via: "No.Such" } }));
    assert.deepEqual([none.relations, none.enums], [[], []]);
    await client.close();
  });

  test(`${label}: a walk over the pages is the whole list, at any page size`, async () => {
    const client = await connect(s);
    async function walk(name, args, limit) {
      const all = [];
      let cursor, total, pages = 0;
      do {
        const a = checkAnswer(name, await client.callTool({ name, arguments: { ...args, limit, ...(cursor ? { cursor } : {}) } }));
        assert.equal(a.page.returned, a[LISTS[name]].length, name);
        assert.ok(a.page.returned <= limit, name);
        assert.equal(a.page.hasMore, a.page.nextCursor !== null, name);
        total ??= a.page.total;
        assert.equal(a.page.total, total, name);
        all.push(...a[LISTS[name]]);
        cursor = a.page.nextCursor;
        assert.ok(++pages < 5000, "the walk ends");
      } while (cursor);
      assert.equal(all.length, total, name);
      return all;
    }
    for (const [name, args] of [["list_entities", { type: largestType(s) }], ["search", { query: "a" }], ["list_references", {}]]) {
      const small = await walk(name, args, 2);
      const large = await walk(name, args, 200);
      assert.ok(small.length > 2, `${name} spans more than one small page here`);
      assert.deepEqual(small, large, `${name}: the same list whatever the page size`);
      if (name !== "list_references") assert.equal(new Set(small.map((x) => x.id)).size, small.length, `${name}: nothing twice`);
    }
    await client.close();
  });

  test(`${label}: every refusal carries its code, its details and the sentence, in the error schema`, async () => {
    const client = await connect(s);
    const type = largestType(s);
    const other = await connect({ ...s, commit: "f".repeat(40) });
    const theirs = checkAnswer("list_entities", await other.callTool({ name: "list_entities", arguments: { type, limit: 1 } })).page.nextCursor;
    assert.equal(typeof theirs, "string");
    const CASES = [
      ["describe_schema", { type: "person" }, "unknown_type", (d) => d.type === "person" && d.declared.includes("skill")],
      ["list_entities", { type: "person" }, "unknown_type", (d) => d.type === "person"],
      ["get_entity", { type: "skill", name: "Knitting" }, "unknown_entity", (d) => d.type === "skill" && d.name === "Knitting"],
      ["get_entity", { id: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["fetch", { id: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["list_references", { entity: "nothing/here" }, "unknown_entity", (d) => d.id === "nothing/here"],
      ["find_evidence", { skill: "Knitting" }, "unknown_entity", (d) => d.name === "Knitting"],
      ["describe_rule", { rule: "R999" }, "unknown_rule", (d) => d.rule === "R999" && d.rules.includes("R4")],
      ["get_entity", {}, "invalid_argument", (d) => d.argument === "id"],
      ["search", { query: "   " }, "invalid_argument", (d) => d.argument === "query"],
      ["list_references", { direction: "out" }, "invalid_argument", (d) => d.argument === "direction"],
      ["describe_relations", { direction: "declares" }, "invalid_argument", (d) => d.argument === "direction"],
      ["list_entities", { type, cursor: "not-a-cursor" }, "invalid_cursor", (d) => d.reason === "malformed"],
      ["list_entities", { type, cursor: theirs }, "invalid_cursor", (d) => d.reason === "other_commit"],
    ];
    for (const [name, args, code, holds] of CASES) {
      const r = await client.callTool({ name, arguments: args });
      const where = `${name} ${JSON.stringify(args)}`;
      assert.equal(r.isError, true, where);
      const refusal = checkAnswer(name, r);
      assert.equal(refusal.error.code, code, where);
      reached.add(refusal.error.code);
      assert.equal(refusal.error.message, r.content[0].text, where);
      assert.ok(holds(refusal.error.details), `${where}: ${JSON.stringify(refusal.error.details)}`);
      assert.equal(refusal.model.commit, s.commit, where);
    }
    await client.close();
    await other.close();
  });
}

test("an ambiguous name is refused with every candidate's id, and each id then answers", async () => {
  const { snapshot, title, owners } = withOwnedNameTwice();
  const client = await connect(snapshot);
  const r = await client.callTool({ name: "get_entity", arguments: { type: "experience", name: title } });
  assert.equal(r.isError, true);
  const { error } = checkAnswer("get_entity", r);
  assert.deepEqual([error.code, error.rule, error.details.type, error.details.name], ["ambiguous_name", "R2", "experience", title]);
  reached.add(error.code);
  assert.deepEqual(error.details.candidates.map((c) => c.owner).sort(), [...owners].sort());
  for (const c of error.details.candidates) {
    const one = checkAnswer("get_entity", await client.callTool({ name: "get_entity", arguments: { id: c.id } }));
    assert.deepEqual([one.entity.id, one.entity.owner], [c.id, c.owner]);
  }
  await client.close();
});

test("a snapshot that predates what a tool reads is refused by code", async () => {
  const { checks, ...old } = exampleSnapshot();
  const client = await connect(old);
  const { error } = checkAnswer("list_checks", await client.callTool({ name: "list_checks", arguments: {} }));
  assert.deepEqual([error.code, error.details], ["unsupported_snapshot", { missing: "checks" }]);
  reached.add(error.code);
  await client.close();
});

// Tests in one file run in the order written, so every refusal above has been seen by now.
test("the refusals above carried every code, so a code added meets a case or fails here", () => {
  assert.deepEqual([...reached].sort(), [...CODES].sort());
});

// A schema that accepts anything passes every test above. Each one is shown a real answer with a
// required field gone, and one with a field of the wrong type, and has to refuse both.
test("every schema refuses a missing field, a wrong type and a field nobody declared", async () => {
  const s = exampleSnapshot();
  const client = await connect(s);
  const calls = sampleCalls(s);
  for (const name of Object.keys(OUTPUTS)) {
    const good = (await client.callTool({ name, arguments: calls[name] })).structuredContent;
    assert.ok(OUTPUTS[name].safeParse(good).success, name);
    for (const key of Object.keys(good)) {
      const { [key]: gone, ...rest } = good;
      assert.ok(!OUTPUTS[name].safeParse(rest).success, `${name} accepts an answer without ${key}`);
    }
    assert.ok(!OUTPUTS[name].safeParse({ ...good, model: { ...good.model, core: 7 } }).success, `${name} accepts a number for model.core`);
    assert.ok(!OUTPUTS[name].safeParse({ ...good, undeclared: true }).success, `${name} accepts a field nobody declared`);
  }
  const listed = (await client.callTool({ name: "list_entities", arguments: calls.list_entities })).structuredContent;
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [{ ...listed.entities[0], id: 7 }] }).success, "an id that is a number");
  const { id, ...nameless } = listed.entities[0];
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [nameless] }).success, "an entity without its id");
  const refused = (await client.callTool({ name: "get_entity", arguments: { id: "nothing/here" } })).structuredContent;
  assert.ok(ErrorResult.safeParse(refused).success);
  assert.ok(!ErrorResult.safeParse({ ...refused, error: { ...refused.error, code: "not_a_code" } }).success);
  const { code, ...codeless } = refused.error;
  assert.ok(!ErrorResult.safeParse({ ...refused, error: codeless }).success);
  await client.close();
});

test("checkAnswer itself fails with the tool and the field named", () => {
  assert.throws(() => checkAnswer("fetch", { structuredContent: { id: "a", title: "A", type: "t", url: null, model: {} } }), /fetch[\s\S]*text/);
  assert.throws(() => checkAnswer("no_such_tool", { structuredContent: {} }), /no_such_tool/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/contract.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module … lib/contract.mjs`.

- [ ] **Step 3: Write `lib/contract.mjs`**

```js
// The contract as something to run: one call of every tool with arguments read from whatever
// snapshot is served, and the parse of a call's result against the schema its tool declares.
// This package's suite uses both over its fixtures and a deployment's suite uses both over the
// model it actually serves, so the two hold one contract and not two readings of it.
import { z } from "zod";
import { OUTPUTS, ErrorResult } from "./schemas.mjs";

// Arguments for every tool, from the snapshot alone. A tool the snapshot gives nothing to be
// asked about — `find_evidence` where no skill is claimed — maps to undefined, and the caller
// skips it by name, never in silence.
export function sampleCalls(s) {
  const held = s.entities.find((e) => e.id !== s.rootId) ?? s.entities[0];
  const skill = s.entities.find((e) => e.type === "skill");
  return {
    list_types: {}, describe_schema: { type: held.type }, describe_relations: {},
    list_rules: {}, describe_rule: { rule: s.rules?.rules[0]?.rule ?? "R4" }, list_checks: {},
    list_entities: { type: held.type }, get_entity: { id: s.rootId }, list_references: { entity: s.rootId },
    find_evidence: skill ? { skill: skill.id } : undefined,
    search: { query: s.root, match: "name" }, fetch: { id: s.rootId },
  };
}

// The structured content of one call, held to its tool's schema, or to the error schema where
// the call was refused. The message names the tool and every field at fault.
export function checkAnswer(name, result) {
  const schema = result.isError ? ErrorResult : OUTPUTS[name];
  if (!schema) throw new Error(`${name} declares no output schema`);
  const parsed = schema.safeParse(result.structuredContent);
  if (!parsed.success) throw new Error(`${name} answered outside its schema:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
```

- [ ] **Step 4: Run**

Run: `node --test test/contract.test.mjs; echo "exit $?"`

Expected: exit 0. A failure here is a finding about the interface, not about the test: a schema refusing a real answer names the field, and the fix is in `lib/schemas.mjs` where the field is real content and in `lib/model.mjs` where it is not. The small walk pages by two so that even the worked example's largest type spans several pages; if a list spans no more than one there, the walk says so by name, and the assertion is kept and the fixture's arguments widened.

- [ ] **Step 5: Commit**

```sh
git add lib/contract.mjs test/contract.test.mjs
git commit -F - <<'EOF'
A suite holds every answer to what its tool declares

A declared schema that nothing checks is a second description to drift. Every tool is called through a real client on the worked example and the reference instance and its answer parsed against its own schema, with the field named on failure; so are empty results, every refusal code with its details, an ambiguous name with its candidates, and every page of each paged list. Each schema is also shown a broken answer and has to refuse it, since a schema that accepts anything passes all the rest.

Verified: node --test test/contract.test.mjs passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 11: A deployment holds the same contract over its own model

**Files:**

- Modify: `deploy/test/tools.mjs`
- Test: `test/deploy-tools.test.mjs`

**Interfaces:**

- Consumes: `sampleCalls`, `checkAnswer` from `companygraph-mcp-server/contract` (the package's own name resolves from inside the package).

- [ ] **Step 1: Write the failing test**

The shared tests read `source.json` and `dist/snapshot.json` from the working directory, so this repository's suite has never run them. Create `test/deploy-tools.test.mjs`, which runs them the way a deployment does:

```js
// The tests this package ships for a deployment's suite, run here as a deployment runs them:
// from a directory holding its pin and its snapshot. They shipped unrun by this suite before,
// so a change to a tool's arguments could break every deployment and pass here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function deployment(commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-"));
  fs.writeFileSync(path.join(dir, "source.json"), JSON.stringify({ repo: "companygraph/meta-model", commit }));
  fs.mkdirSync(path.join(dir, "dist"));
  fs.writeFileSync(path.join(dir, "dist", "snapshot.json"), JSON.stringify(exampleSnapshot()));
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  const shared = pathToFileURL(path.join(root, "deploy", "test", "tools.mjs")).href;
  fs.writeFileSync(path.join(dir, "shared.test.mjs"), `import { registerToolsTests } from ${JSON.stringify(shared)};\nregisterToolsTests();\n`);
  const r = spawnSync(process.execPath, ["--test", "shared.test.mjs"], { cwd: dir, encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

test("the shared tools tests pass over a snapshot that is its pin", () => {
  const r = deployment(COMMIT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /every tool the server lists answers inside its schema/);
});

test("and fail over one that is not, so a pass above means something", () => {
  const r = deployment("f".repeat(40));
  assert.notEqual(r.status, 0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/deploy-tools.test.mjs; echo "exit $?"`

Expected: exit 1. The first test fails: the shared test still calls `fetch` and `search` in the old way, and its name does not match.

- [ ] **Step 3: Rewrite the two tests that call tools in `deploy/test/tools.mjs`**

Add the import:

```js
import { sampleCalls, checkAnswer } from "companygraph-mcp-server/contract";
```

Replace "every type describes and lists, and one entity of each resolves":

```js
  test("every type describes and lists, and one entity of each resolves", () => {
    for (const t of listTypes(s).types) {
      assert.equal(describeSchema(s, t.type).type, t.type);
      assert.equal(listEntities(s, t.type).page.total, t.count, `${t.type} lists as many entities as list_types counts`);
      if (t.count === 0) continue;
      const { entity } = getEntityById(s, s.entities.find((e) => e.type === t.type).id);
      assert.equal(entity.type, t.type);
      assert.ok(Array.isArray(entity.references) && Array.isArray(entity.referencedBy));
    }
  });
```

and change the model import to `import { listTypes, describeSchema, listEntities, getEntityById } from "companygraph-mcp-server/model";`. An id is used because a type's first entity may carry a title another owner also holds, which by name is refused.

Replace "every tool the server lists answers, and every answer carries the commit":

```js
  test("every tool the server lists answers inside its schema, and every answer carries the commit", async (t) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    assert.equal(client.getServerVersion().title, s.root);
    const { tools } = await client.listTools();
    // No count and no argument is held here: the list is the server's and the arguments are read
    // from this snapshot by the package that declares the tools. A tool it gains with no sample
    // call fails by name, never in silence.
    const calls = sampleCalls(s);
    assert.ok(tools.length > 0);
    for (const name of tools.map((x) => x.name)) {
      assert.ok(name in calls, `${name} is served and the package ships no sample call for it`);
      // Ruling 5: an instance that claims no skill has nothing find_evidence could be asked
      // about, so the call itself is skipped rather than made up against a name that isn't there.
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
```

- [ ] **Step 4: Run**

Run: `node --test test/deploy-tools.test.mjs test/deploy-build.test.mjs; echo "exit $?"`

Expected: exit 0. If the child cannot resolve `companygraph-mcp-server/contract`, the `exports` line of Task 8 is missing or misspelled.

- [ ] **Step 5: Commit**

```sh
git add deploy/test/tools.mjs test/deploy-tools.test.mjs
git commit -F - <<'EOF'
A deployment holds the contract over the model it serves

The tests a deployment runs over its own snapshot called the tools with arguments typed into the test, and this repository's suite never ran them, so a change to a tool could pass here and fail in every deployment. They now take their calls from the package that declares the tools and parse each answer against its schema, and the suite runs them as a deployment does, from a directory holding a pin and a snapshot, with a wrong pin shown to fail.

Verified: node --test on deploy-tools and deploy-build passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 12: The interface document

**Files:**

- Create: `docs/INTERFACE.md`, `scripts/interface.mjs`
- Modify: `package.json` (`scripts.interface`), `README.md` (the Tools section), `AGENTS.md` (one paragraph below the conventions block)
- Test: `test/interface.test.mjs`

**Interfaces:**

- Produces: `render(text) → Promise<string>` from `scripts/interface.mjs`, which rewrites the first `json` fence under each heading it knows with the real call and answer; `npm run interface` writes the file.

- [ ] **Step 1: Write the failing test**

Create `test/interface.test.mjs`:

```js
// The interface document's examples are what the server answers, not what someone remembers it
// answering: a script writes them from the worked example and this holds the committed file to
// the script. CI checks the committed copy and never writes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { render, EXAMPLES } from "../scripts/interface.mjs";
import { TOOLS } from "../lib/tools.mjs";
import { CODES } from "../lib/errors.mjs";

const file = new URL("../docs/INTERFACE.md", import.meta.url);
const text = fs.readFileSync(file, "utf8");

test("the committed examples are what the server answers; run `npm run interface` when they differ", async () => {
  assert.equal(await render(text), text);
});

test("every tool has a section with an example, and every error code a row", () => {
  for (const t of TOOLS) {
    assert.ok(text.includes(`### \`${t.name}\`\n`), `${t.name} has no section`);
    assert.ok(`\`${t.name}\`` in EXAMPLES, `${t.name} has no example call`);
  }
  for (const code of CODES) assert.ok(text.includes(`| \`${code}\` |`), `${code} has no row`);
});

test("an example is a real call: its answer is never an empty object", async () => {
  const blocks = [...(await render(text)).matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, Object.keys(EXAMPLES).length);
  for (const b of blocks) assert.ok(Object.keys(b.answer).length > 1, JSON.stringify(b.arguments));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/interface.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module … scripts/interface.mjs`.

- [ ] **Step 3: Write `scripts/interface.mjs`**

```js
// Writes the examples of docs/INTERFACE.md from what the server answers over the worked example.
// Under each heading named below, the first `json` fence is replaced with the call and its
// answer; the prose around it is a person's and is never touched. An example is abbreviated by
// one rule, stated in the document: an array keeps its first two entries, a string its first 200
// characters, and `model` shows placeholder versions so that a parser re-pin is not a change to
// the document. Run by `npm run interface`; test/interface.test.mjs holds the file to it.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../lib/server.mjs";
import { exampleSnapshot, withOwnedNameTwice } from "../test/helpers.mjs";

const DDD = "skills/domain-driven-design";

// Heading text → the call shown under it. `ambiguous` runs on the fixture in which two owners
// each hold one title, which the worked example does not.
export const EXAMPLES = {
  "`list_types`": { name: "list_types", arguments: {} },
  "`describe_schema`": { name: "describe_schema", arguments: { type: "skill" } },
  "`describe_relations`": { name: "describe_relations", arguments: { type: "skill", direction: "declared-to" } },
  "`list_rules`": { name: "list_rules", arguments: {} },
  "`describe_rule`": { name: "describe_rule", arguments: { rule: "R4" } },
  "`list_checks`": { name: "list_checks", arguments: {} },
  "`list_entities`": { name: "list_entities", arguments: { type: "skill", limit: 2 } },
  "`get_entity`": { name: "get_entity", arguments: { id: DDD } },
  "`list_references`": { name: "list_references", arguments: { entity: DDD, direction: "in", via: "Skills.Skill" } },
  "`find_evidence`": { name: "find_evidence", arguments: { skill: DDD } },
  "`search`": { name: "search", arguments: { query: "bounded context", limit: 2 } },
  "`fetch`": { name: "fetch", arguments: { id: DDD } },
  "A refusal": { name: "get_entity", ambiguous: true },
};

const abbreviate = (v) =>
  Array.isArray(v) ? v.slice(0, 2).map(abbreviate)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, abbreviate(x)]))
      : typeof v === "string" && v.length > 200 ? `${v.slice(0, 200)}…` : v;

async function connect(s) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "interface", version: "0" });
  await client.connect(b);
  return client;
}

export async function render(text) {
  const plain = await connect(exampleSnapshot());
  const twice = withOwnedNameTwice();
  const ambiguous = await connect(twice.snapshot);
  let out = text;
  for (const [heading, example] of Object.entries(EXAMPLES)) {
    const args = example.ambiguous ? { type: "experience", name: twice.title } : example.arguments;
    const r = await (example.ambiguous ? ambiguous : plain).callTool({ name: example.name, arguments: args });
    const answer = abbreviate(r.structuredContent);
    answer.model = { ...answer.model, core: "0.0.0", parser: "v0.0.0" };
    const block = JSON.stringify({ tool: example.name, arguments: args, answer }, null, 2);
    const at = out.indexOf(`### ${heading}\n`);
    if (at < 0) throw new Error(`docs/INTERFACE.md has no heading "### ${heading}"`);
    const open = out.indexOf("```json\n", at);
    const next = out.indexOf("\n### ", at + 1);
    if (open < 0 || (next > 0 && open > next)) throw new Error(`"### ${heading}" has no json fence of its own`);
    const close = out.indexOf("\n```", open + 8);
    out = out.slice(0, open + 8) + block + out.slice(close);
  }
  await plain.close();
  await ambiguous.close();
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL("../docs/INTERFACE.md", import.meta.url);
  fs.writeFileSync(file, await render(fs.readFileSync(file, "utf8")));
}
```

Add to `package.json` `scripts`: `"interface": "node scripts/interface.mjs"`.

- [ ] **Step 4: Write `docs/INTERFACE.md`**

Every `json` fence is written as `{}` and filled by the script in Step 5. The prose, in full:

````markdown
# The interface

What a client of this server may rely on: the tools, their arguments, the fields of every answer, the codes of every refusal, how a list is paged, and what counts as a break. It holds for every deployment of the package, since a deployment adds a model and no tool. The schemas it describes are the ones the server registers; a client reads them from the tool listing, or imports them from `companygraph-mcp-server/schemas`.

## Terms

An **id** identifies one entity across the whole model, such as `skills/domain-driven-design`, and every tool that takes an entity takes its id. A **canonical name** is an entity's title, unique within its type and, for an owned type, within its owner, so a name alone can be ambiguous where an id cannot. An **owner** is the entity another is nested under. A **reference** is an edge from one entity to another, and **`via`** names the field or `Section.Column` that drew it. A **qualifier** is a value on a table row that describes that row's edge and draws none of its own.

`via: "owner"` names two things. Nesting on disk is served as an edge from the owned entity to its owner; a schema's own `owner` field, a process's owner for one, draws an edge of the same name. The far end's type tells them apart.

## Shapes every tool shares

| Shape | Fields |
| --- | --- |
| entity reference | `id`, `type`, `name` |
| edge | `from` and `to`, each an entity reference; `via`; `attrs`, the row's other columns verbatim, a resolved qualifier arriving as an entity reference |
| `page` | `total`, the count after filters; `returned`; `hasMore`; `nextCursor`, null when there is none |
| `model` | `commit`, `repo`, `core`, `parser`: where the answer came from, on every answer and every refusal |

A shape this package builds is closed, and a field it does not declare fails the package's own suite. What the parser builds is open beyond its named fields: an entity, a section, a table, an enum, a join, a list kind, a check. An entity's `fields` and an edge's `attrs` vary by schema and stay open by design.

## Which tool

`get_entity` is an entity as structured data, for a client that reasons over the model. `fetch` is the same entity's page as written, the Markdown source, for a client that quotes or displays it, and carries no structured copy. `search` with `match: "name"` answers a name with every entity that carries it, which is the way from a name to an id. `list_entities` browses one type, `list_references` the edges, and `describe_schema` and `describe_relations` what the schemas declare, for one type and for all of them.

## The tools

In the examples an array is cut to its first two entries and a string to 200 characters, and `model.core` and `model.parser` show placeholder versions. Nothing else differs from what the server answered over the meta-model's worked example.

### `list_types`

No arguments. `types` holds every type the schemas declare, with its `owner` type, null where it nests under none, and the `count` of entities it holds.

```json
{}
```

### `describe_schema`

`type`. The schema's `sections` as written and its `relations` as data: `owner`, `owns`, `references`, `referencedBy`, `enums`, `joins`, `lists`.

```json
{}
```

### `describe_relations`

Optional `type`, `direction` (`declares`, `declared-to` or `both`; needs `type`) and `via`. `relations`, `ownership`, `enums`, `joins` and `lists` narrow to what was asked; `forms` and `reading` always arrive whole, since they explain the terms of whatever part is returned. Not paged: the vocabulary is the size of the core.

```json
{}
```

### `list_rules`

No arguments. `tagline`, and `rules` with each rule's number, `title` and the `part` of the file it stands in.

```json
{}
```

### `describe_rule`

`rule`, a number such as `R4`, in either case. The rule's `title`, `part` and `text` as written.

```json
{}
```

### `list_checks`

No arguments. `checks` with each check's `name`, the `rule` it cites and that rule's `title`, and `ranBy`, which says who runs them. A list and no verdict.

```json
{}
```

### `list_entities`

`type`; optional `owner`, an id, to keep one owner's entities; `limit` and `cursor`. `entities` in id order, and `page`.

```json
{}
```

### `get_entity`

`id`, or `type` and `name`; given both, the id wins. The entity's `fields`, `sections` and tables, and its edges both ways. `references` and `referencedBy` hold at most 50 edges each, in the order `list_references` gives them; `referenceCounts` holds the true totals, and `list_references` pages the rest. An entity's own content is never cut.

```json
{}
```

### `list_references`

Optional `entity`, an id; `direction` (`out`, `in` or `both`, relative to the entity, which it needs); `via`, matched exactly; `type`, the far end's type with an entity and either end's without; `limit` and `cursor`. With no argument it pages through every edge of the model. Edges are ordered by `from.id`, then `via`, then `to.id`.

```json
{}
```

### `find_evidence`

`skill`, an id or a canonical name. Every edge into the skill, under `evidence`, keyed by the type of the page that drew it; each entry is an edge with that page's `owner` and, where it has one, its `stamp`.

```json
{}
```

### `search`

`query`; optional `match`, `type`, `owner`, `limit` and `cursor`. `match: "text"`, the default, is a case-insensitive substring over name, tagline, fields, section text and table cells. `match: "name"` is the exact canonical name, case-insensitive, across types. `matched` says where each result hit: `where` is one of `name`, `tagline`, `field`, `section` or `table`, and `key` the field or section heading, null for the first two. Results are ordered by type, then name, then id: a listing, not a ranking. A result's name is under `title`, as it is for `fetch`, because some clients call only these two tools and require that field.

```json
{}
```

### `fetch`

`id`, and nothing else: a name is no id. `text` is the page's Markdown source and `url` its file at the commit, null where the repository is not known.

```json
{}
```

## Paging

`list_entities`, `list_references` and `search` take `limit`, 50 by default and 200 at most, and `cursor`. A limit outside the range is served at the nearest bound and not refused. Follow `page.nextCursor` while `page.hasMore`. The order of each list is fixed and a served model never changes, so a walk neither repeats nor skips.

A cursor is opaque. It belongs to one commit of the model: sent after the deployment moved to another, it is refused as `invalid_cursor` with the reason `other_commit`, and the walk starts again. What is not detected is a cursor sent with other filters than the call that produced it; the answer is then a page of the wrong list, so a client keeps its arguments unchanged for the length of a walk.

## Refusals

A refused call is a tool error. Its text is a sentence for a reader, and its structured content is the same refusal for a program: `error.code`, `error.message`, `error.rule`, the convention it rests on or null, and `error.details`, whose keys the code fixes. `model` stands beside `error`.

| Code | When | `details` |
| --- | --- | --- |
| `unknown_type` | no schema declares the type | `type`, `declared` |
| `unknown_entity` | an id, or a type and name, resolves to nothing | `id`, or `type` and `name` |
| `ambiguous_name` | more than one entity of the type holds the name | `type`, `name`, `candidates`: entity references, each with `owner` |
| `unknown_rule` | no rule has the number | `rule`, `rules` |
| `invalid_argument` | an empty query, neither id nor type and name, a direction with nothing to be relative to | `argument`, `reason` |
| `invalid_cursor` | a cursor this server did not write, or one from another commit | `reason`: `malformed` or `other_commit` |
| `unsupported_snapshot` | the snapshot predates what the tool reads | `missing` |

One kind of refusal carries no code. Arguments that fail a tool's input schema, a number where a string belongs or a value outside an enumeration, are refused by the MCP SDK before this package runs, as a sentence alone.

### A refusal

```json
{}
```

## What counts as a break

**Breaking: a tool's name; an argument's name or meaning; a required output field's name or type; an error code or the keys of its details; the order of a paged list; how an id is formed.** Additive: a new tool, a new optional argument, a new output field, a new error code. Below 1.0 a minor release may break; every release that does names each break in its notes under a heading of its own, `Interface`, and a release that leaves the interface alone says so there in one line.
````

- [ ] **Step 5: Fill the examples and check the form**

```sh
npm run interface; echo "exit $?"
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
```

Expected: each exit 0. If `conventions-format` reports the generated fences, run `sh conventions/conventions-format fix`, then `npm run interface` again, and confirm `git diff --stat` shows the file stable across a second run of both; two tools that each rewrite the other's output are a finding to report, not to loop on.

- [ ] **Step 6: Point the README at the document**

In `README.md`, replace the Tools table and the paragraph under it with:

```markdown
## Tools

| Tool | Purpose |
| --- | --- |
| `list_types` | every type the schemas declare |
| `describe_schema` | one type's schema and its relations |
| `describe_relations` | what the schemas declare between types, whole or narrowed |
| `list_rules`, `describe_rule` | the rules the model is held to, and one as written |
| `list_checks` | the checks the model's gate runs; a list, not a verdict |
| `list_entities` | the entities of one type, paged |
| `get_entity` | one entity as structured data, by id or by type and name |
| `list_references` | the model's edges, filtered and paged |
| `find_evidence` | everything the model says about one skill |
| `search` | entities by words, or by exact name |
| `fetch` | one entity's page as written, by id |

[`docs/INTERFACE.md`](docs/INTERFACE.md) is the contract: every tool's arguments and answer with a real response, the codes of every refusal, how a list is paged, and what counts as a break. Every answer carries the model commit, the core version and the parser's tag. A name resolves within a type, and a name of an owned type within its owner, so two owners may each hold one name; a lookup that meets two refuses with every candidate's id, and an id reaches each.
```

In the Tests section of `README.md`, add the sentence: "`test/contract.test.mjs` holds every tool's answer, every refusal and every page to the schema the tool declares, and `test/interface.test.mjs` holds the document's examples to what the server answers; `npm run interface` rewrites them."

Below the conventions block of `AGENTS.md`, add the paragraph: "A change to a tool's arguments or answer is a change to `lib/schemas.mjs`, to `docs/INTERFACE.md` and, where it breaks, to the release notes' `Interface` section, in the same pull request. `npm run interface` rewrites the document's examples after any change to an answer or to the pinned meta-model's worked example."

- [ ] **Step 7: Run**

Run: `node --test test/interface.test.mjs; echo "exit $?"` then `sh conventions/conventions-check; echo "exit $?"` and `sh conventions/conventions-format; echo "exit $?"`

Expected: each exit 0.

- [ ] **Step 8: Commit**

```sh
git add docs/INTERFACE.md scripts/interface.mjs package.json README.md AGENTS.md test/interface.test.mjs
git commit -F - <<'EOF'
The interface is written down, with what counts as a break

A client's maintainer had the tool listing and the source to learn the interface from, and nothing said which changes they could rely on not happening. docs/INTERFACE.md gives every tool's arguments and answer with a real response, the refusal codes, the paging rules with what a cursor does not detect, and the line between a break and an addition. Its examples are written by a script from the worked example and a test holds the committed file to it.

Verified: node --test test/interface.test.mjs, conventions-check and conventions-format pass.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 13: The whole suite, then the pull request

**Files:** none changed unless a finding requires it.

- [ ] **Step 1: Run everything**

```sh
export PATH=/opt/homebrew/bin:$PATH
npm test; echo "exit $?"
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
sh conventions/conventions-sync check; echo "exit $?"
```

Expected: each exit 0. Read the test summary: the count of failed is zero and no test is skipped that was not skipped in Task 0's baseline.

- [ ] **Step 2: Read the diff for what should not be there**

Run: `git diff origin/main --stat` and `git diff origin/main -- lib | grep -n "withReferences\|const output\|\.total\b"`

Expected: `withReferences` and `const output` have no remaining use; `.total` appears only as `page.total` or inside `lib/paging.mjs`.

- [ ] **Step 3: Read the repository's last two merged pull requests for the register**

Run: `gh pr list --state merged --limit 2 --json number,title,body`

- [ ] **Step 4: Push and open the pull request**

```sh
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin the-interface-is-a-contract
gh pr create --title "The interface is a contract" --body-file - <<'EOF'
A client's review of the two deployments found the interface undeclared: every tool registered one output field, a list returned all it had, a refusal was a sentence to parse, fetch and get_entity returned the same entity in two wrappings, and a relation came only with a whole entity or the whole vocabulary. The owner chose a clean break while the package is below 1.0, and this is it.

Every tool now declares the schema of its answer and the SDK holds each answer to it; a refusal carries a code from a closed list, the rule it rests on and its facts as data, candidates included. list_entities, search and the new list_references answer a page at a time behind a cursor bound to the commit. search tells an exact name from words in a text and filters by type and owner, describe_relations narrows to a type, a side and a field, get_entity takes an id and is the data where fetch is the page. The descriptions are built one way and the terms they share are defined once in the instructions.

What breaks for a client is listed in docs/INTERFACE.md's terms and will lead the release notes: fetch takes an id only and returns no entity; get_entity's edges name both ends, are capped at fifty each way and come with counts; search results are paged, total moves into page and matched becomes objects; list_entities is paged; a refusal carries structured content. Ids are formed as before. mcp-blust-ch's own suite asserts two of the old shapes and changes those assertions when it re-pins; mcp-companygraph-io re-pins alone. The version and the release follow in a pull request of their own.

Verified: npm test, conventions-check, conventions-format and conventions-sync check pass locally.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: Report the checks and stop**

Run: `gh pr checks --watch; echo "exit $?"`

Expected: `test`, `terraform` and `conventions / conventions` green. Report the pull request's number and the checks to the owner. Merging is the owner's word.

---

## After the merge, on the owner's word

Not tasks of this plan. The repository's pattern is a pull request of its own that sets `package.json` and `package-lock.json` to the next minor after the version `main` carries that day, then its tag and a GitHub Release. The number is read then and not written here: another release took the one this plan first named while the plan was still running. The notes, drafted for that day:

> **Interface.** This release breaks the tool interface, once, to give it a contract; `docs/INTERFACE.md` is that contract from here on. `fetch` takes an id only and answers with `id`, `title`, `type`, `url` and `text`; it no longer resolves a name and no longer returns `entity`. `get_entity` takes `id`, or `type` and `name`; its `references` and `referencedBy` are edges naming both ends (`from`, `via`, `to`, `attrs`), capped at fifty each way, with the totals under `referenceCounts`. `find_evidence` entries take the same edge shape, so an entry's page is `from.id` where it was `id`. `list_entities` and `search` answer a page at a time: `limit`, `cursor`, and `page` in the answer; `search`'s `total` is now `page.total` and `matched` holds `{where, key}` objects where it held strings. A refused call carries `error.code`, `error.rule` and `error.details` as structured content beside its sentence. Ids are formed as before.
>
> **New.** `list_references` serves the model's edges filtered by entity, direction, `via` and type. `search` takes `match: "name"` for an exact canonical name across types, and `type` and `owner` filters. `describe_relations` takes `type`, `direction` and `via`. Every tool declares its full output schema, exported as `companygraph-mcp-server/schemas`, and `companygraph-mcp-server/contract` lets a deployment hold its own model to them.
>
> **Taking it.** Re-pin in the usual three places. The shared deployment tests move with the package. A deployment whose own suite calls `fetchEntity` with a name, or reads `id` on a `findEvidence` entry, changes those assertions: the first to `search(s, name, { match: "name" })`, the second to `from.id`.

Then the two re-pins, each its own pull request in its own repository: `robertblust/mcp-blust-ch` (the three places, the lockfile by installing the package by name, and the two assertions in `test/instance.test.mjs`) and `companygraph/mcp-companygraph-io` (the three places and the lockfile).
