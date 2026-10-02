# A list can start with the newest entity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `list_entities` may leave out `type` and takes `order` (`address`, `newest`, `oldest`), and every entity in `list_entities`, `search` and `get_entity` carries `created`, the moment in its UUID version 7 id.

**Architecture:** `lib/model.mjs` gains a pure reader, `createdOf(id)`, and a per-snapshot map of every entity's moment kept in a `WeakMap` beside the snapshot, as the stems of a search by words already are. `listEntities` filters as before, then orders by address or by that moment, and refuses with one new code, `no_creation_time`, where no entity in the list has one. The schemas, the tool's input and description, the interface document, the README row and the deployment's shared test follow.

**Tech Stack:** Node 22+, `node:test`, zod 4 (`z.iso.datetime()`), `@modelcontextprotocol/client` for the contract tests, `companygraph-meta-model` (the parser, pinned by tag). No dependency is added.

**Spec:** `docs/superpowers/specs/2026-10-02-the-newest-entities-design.md`, on branch `the-newest-entities` (pull request #110). Read it before any task.

## Global Constraints

- **One repository, one branch.** Implementation runs in a fresh worktree from `main` once #110 and this plan are merged: `~/git/companygraph/mcp-server-the-newest-entities-build`, branch `the-newest-entities-build`. The clone at `~/git/companygraph/mcp-server` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u https://github.com/companygraph/mcp-server.git the-newest-entities-build`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs` after one `npm run fixtures`; the whole suite as `npm test`, which fetches the fixtures first. `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before every commit.
- **The orders** are exactly `address`, `newest`, `oldest`, declared once as `ORDERS` in `lib/model.mjs`. `address` is the default, and a call that names no order gets byte for byte the list it gets on `main`.
- **`created`** is `new Date(ms).toISOString()`, where `ms` is the first twelve hexadecimal digits of the id read as an integer, for an id matching `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i` and for no other. An entity without one carries no `created` key, never `null`.
- **`newest` is exactly `oldest` reversed:** `oldest` sorts by `created`, then by id, both ascending; `newest` by both descending. Entities without `created` follow in address order in either.
- **The refusal:** code `no_creation_time`, appended last to `CODES`; `WHEN` reads `an order by when entities came into the model, over a list whose ids carry no time`; details `{ order, type }`, `order` one of `newest`, `oldest`, `type` the type named or null. An empty list is never refused.
- **The answer's `type`** is the type named, or `null` where none was. This is the one break, named under `Interface` in the release notes, which are the owner's.
- **The snapshot file's format does not change.** No moment is written into it.
- **The tool description stays within sixty words**, contains `Returns `, `` `cursor` `` and `search`; `test/descriptions.test.mjs` holds it.
- **Commits are the Implementer's:** `git commit --author "Implementer <implementer@companygraph.io>"`, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. A first commit in a fresh worktree is preceded by `sh conventions/conventions-sync sync` once, so the seat hook runs.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, and a `Verified:` line naming what ran, before the trailers. The pull request body the same register, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, deployed or deleted by an agent.** The last task pushes, opens the pull request and stops. `package.json`'s version is not moved.
- **No count or version of something that still moves** in any prose or comment.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.

### What the fixtures give

- The worked example (`exampleSnapshot()`) holds only UUID version 7 ids, many of them made in the same millisecond, so it exercises ties at the id without a fixture of its own.
- The reference instance (`instanceSnapshot()`, pinned at `f4e8fd2`) was read by a parser older than ids, so every id is its address and none is version 7. It is the fixture that reaches `no_creation_time`.

## Review Focus

- **A list emptied by its filters with `order: "newest"`** (an owner holding nothing of the type) answers an empty page, not `no_creation_time`. Task 2 holds it.
- **An id in upper case** reads to the same moment as its lower-case form, since a UUID's hexadecimal digits are case-insensitive. Task 1 holds it.
- **A cursor from a `newest` walk** walks the same list in pages of two as in one page of two hundred, with nothing twice. Task 2 holds it.
- **`order` outside the three values through the tool** is refused as `invalid_argument` naming `order`, and called on `listEntities` directly the same. Task 2 holds both.
- **A version 4 UUID and an address standing in for an id** read to nothing, and the entity carries no `created` key at all. Task 1 holds it.

---

### Task 1: The moment every entity carries

**Files:**

- Modify: `lib/model.mjs` (beside `place`, and in `listEntities`, `search` and `serveEntity`)
- Modify: `lib/schemas.mjs` (`Entity`, `OUTPUTS.list_entities`, `OUTPUTS.search`)
- Test: `test/model.test.mjs`

**Interfaces:**

- Consumes: nothing new.
- Produces: `export const createdOf = (id) => string | null`; the module-private `createdIn(s) => Map<id, string | null>` and `withCreated(s, e) => { created } | {}`, which Task 2 uses inside `listEntities`; `created` on every served entity that has one; `Created`, the zod schema of the field, in `lib/schemas.mjs`.

- [ ] **Step 1: Write the failing tests**

In `test/model.test.mjs`, add `createdOf` to the import from `../lib/model.mjs`, then replace the existing test `"list_entities lists one type, in the order of where their pages sit"` so its key list includes `created`, and add two tests after it:

```js
test("list_entities lists one type, in the order of where their pages sit", () => {
  const r = listEntities(s, "skill");
  assert.equal(r.type, "skill");
  assert.deepEqual(r.entities.map((e) => e.id), ["skills/domain-driven-design", "skills/java-programming", "skills/product-discovery"].map((a) => idAt(s, a)));
  assert.deepEqual(Object.keys(r.entities[0]), ["id", "type", "name", "tagline", "owner", "created"]);
  assert.throws(() => listEntities(s, "person"), ModelError);
});

test("the moment a version 7 id was made is read from the id, and from no other id", () => {
  // Made with `companygraph id` on 2026-10-02; the moment is the one the id was made at.
  assert.equal(createdOf("01a0fadb-2a89-734e-85c3-2c8094ed07e6"), "2026-10-02T04:24:22.409Z");
  assert.equal(createdOf("01A0FADB-2A89-734E-85C3-2C8094ED07E6"), "2026-10-02T04:24:22.409Z");
  assert.equal(createdOf("3b241101-e2bb-4255-8caf-4136c566a962"), null, "a version 4 id");
  assert.equal(createdOf("skills/domain-driven-design"), null, "an address standing in for an id");
  assert.equal(createdOf("01a0fadb2a89734e85c32c8094ed07e6"), null, "a UUID without its hyphens");
  assert.equal(createdOf(undefined), null);
});

test("every entity a tool serves carries its moment, and one whose id has none carries no key", () => {
  const listed = listEntities(s, "skill").entities[0];
  assert.equal(listed.created, createdOf(listed.id));
  const found = search(s, "Domain-Driven Design", { match: "name" }).results[0];
  assert.equal(found.created, createdOf(found.id));
  assert.equal(getEntityById(s, DDD).entity.created, createdOf(DDD));
  const undated = instanceSnapshot();
  const first = listEntities(undated, "skill").entities[0];
  assert.equal("created" in first, false);
  assert.equal("created" in getEntityById(undated, first.id).entity, false);
  assert.equal("created" in search(undated, first.name, { match: "name" }).results[0], false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run fixtures && node --test test/model.test.mjs` Expected: FAIL, `createdOf` is not exported (a `SyntaxError` naming it).

- [ ] **Step 3: Read the moment**

In `lib/model.mjs`, directly below the `place` definition, add:

```js
// The moment a UUID version 7 was made: its first 48 bits are milliseconds since 1970. Every id
// `companygraph id` makes is one, and `companygraph ids` gave each page written before ids existed
// one from its first commit, so the moment is when the entity came into the model. Any other id,
// including an address a snapshot from an older parser stands in for one, says no moment, and
// none is made up.
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const createdOf = (id) =>
  typeof id === "string" && V7.test(id) ? new Date(Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16)).toISOString() : null;

// Every entity's moment, read once per snapshot and kept beside it, never in it: the id is
// already in the snapshot, and a second copy of what it says could only come to disagree with it.
const CREATED = new WeakMap();
const createdIn = (s) => {
  if (!CREATED.has(s)) CREATED.set(s, new Map(s.entities.map((e) => [e.id, createdOf(e.id)])));
  return CREATED.get(s);
};
// The field as an answer carries it: present with the moment, or absent, never null.
const withCreated = (s, e) => {
  const at = createdIn(s).get(e.id);
  return at ? { created: at } : {};
};
```

- [ ] **Step 4: Serve it**

In `listEntities`, change the `.map` line to:

```js
    .map((e) => ({ id: e.id, type: e.type, name: e.name, tagline: e.tagline, owner: e.owner ?? null, ...withCreated(s, e) }));
```

In `search`, change the `results.push` line to:

```js
    if (matched.length) results.push({ e, id: e.id, title: e.name, type: e.type, owner: e.owner ?? null, tagline: e.tagline, ...withCreated(s, e), url: fileUrl(s, e), matched });
```

In `serveEntity`, change the returned object's first line to:

```js
  return { ...rest, owner: e.owner ?? null, ...withCreated(s, e), sections: serveSections(sections), url: fileUrl(s, e), ...(image ? { image_url: image } : {}),
```

- [ ] **Step 5: Declare it**

In `lib/schemas.mjs`, below `Page`, add:

```js
// The moment an entity's id was made, where its id is a UUID version 7; absent, never null, where not.
export const Created = z.iso.datetime().optional();
```

Add `created: Created,` to `Entity` after `owner: z.string().nullable(),`. In `OUTPUTS.list_entities` change the entity shape to `EntityRef.extend({ tagline: z.string(), owner: z.string().nullable(), created: Created })`. In `OUTPUTS.search`'s result `z.strictObject`, add `created: Created,` after `tagline: z.string(),`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `node --test test/model.test.mjs` Expected: PASS, every test.

Run: `npm test` Expected: PASS. If `test/interface.test.mjs` fails only because the `list_entities`, `get_entity` and `search` examples in `docs/INTERFACE.md` now show `created`, run `npm run interface` and read the diff: it may add `created` lines and nothing else. Any other failure is fixed in code, not in the document.

- [ ] **Step 7: Add a schema control**

In `test/contract.test.mjs`, in the test `"every schema refuses a missing field, a wrong type and a field nobody declared"`, after the two `listed` assertions, add:

```js
  assert.ok(OUTPUTS.list_entities.safeParse(listed).success && typeof listed.entities[0].created === "string", "the example's entities carry a moment");
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [{ ...listed.entities[0], created: "yesterday" }] }).success, "a created that is not an ISO time");
  assert.ok(!OUTPUTS.list_entities.safeParse({ ...listed, entities: [{ ...listed.entities[0], created: null }] }).success, "a created that is null rather than absent");
```

Run: `node --test test/contract.test.mjs` Expected: PASS.

- [ ] **Step 8: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add lib/model.mjs lib/schemas.mjs test/model.test.mjs test/contract.test.mjs docs/INTERFACE.md
git commit --author "Implementer <implementer@companygraph.io>" -F - <<'EOF'
Every entity carries the moment its id was made

An id that is a UUID version 7 says when it was made, and every entity list_entities, search and get_entity serve now carries that moment as created, an ISO time read from the id once per snapshot and kept beside it, never in it. An id that is not version 7, such as an address an older snapshot stands in for one, says no moment, and the entity carries no created key at all.

Verified: node --test test/model.test.mjs failed on the missing export first and passes now; npm test passes; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 2: A list of every type, in the order entities came into the model

**Files:**

- Modify: `lib/model.mjs` (`listEntities`)
- Modify: `lib/errors.mjs` (`CODES`, `WHEN`)
- Modify: `lib/schemas.mjs` (`OUTPUTS.list_entities`'s `type`, `DETAILS`)
- Modify: `lib/tools.mjs` (the `list_entities` entry, its import)
- Test: `test/model.test.mjs`, `test/contract.test.mjs`, `test/describe-errors.test.mjs`, `test/arguments.test.mjs`, `test/descriptions.test.mjs`

**Interfaces:**

- Consumes: `createdIn(s)`, `withCreated(s, e)` and `createdOf(id)` from Task 1.
- Produces: `export const ORDERS = ["address", "newest", "oldest"]` in `lib/model.mjs`; `listEntities(s, type | undefined, { owner, order = "address", limit, cursor })` returning `{ type: string | null, entities, page, model }`; the code `no_creation_time` with details `{ order: "newest" | "oldest", type: string | null }`.

- [ ] **Step 1: Write the failing model tests**

In `test/model.test.mjs`, add `createdOf` to the import if Task 1 did not already, then add:

```js
// A list built from entities of the example's own type, so the order is the only thing a test
// varies: three moments, two of them in one millisecond, and one entity whose id says none.
const dated = (entries) => ({ ...s, entities: entries.map(([id, address]) => ({ id, type: "skill", name: address, tagline: "", owner: null, address, fields: {}, sections: [] })) });
const EARLY = "01a0fadb-2a89-734e-85c3-2c8094ed07e6";
const TIE_A = "01a0fadf-b1c5-7c45-b1a5-f4f9e18831f4";
const TIE_B = "01a0fadf-b1c5-7fff-8000-000000000000";
const UNDATED = "skills/written-before-ids";

test("list_entities leaves out its type to list every type, and names none in its answer", () => {
  const r = listEntities(s, undefined, { limit: 200 });
  assert.equal(r.type, null);
  assert.equal(r.page.total, s.entities.length);
  assert.ok(new Set(r.entities.map((e) => e.type)).size > 1);
  assert.deepEqual(r.entities, listEntities(s, undefined, { order: "address", limit: 200 }).entities, "address is the default");
});

test("newest and oldest order by the moment, then the id, and are each other reversed", () => {
  const t = dated([[TIE_B, "skills/b"], [UNDATED, "skills/a"], [EARLY, "skills/c"], [TIE_A, "skills/d"]]);
  assert.deepEqual(listEntities(t, "skill", { order: "oldest" }).entities.map((e) => e.id), [EARLY, TIE_A, TIE_B, UNDATED]);
  assert.deepEqual(listEntities(t, "skill", { order: "newest" }).entities.map((e) => e.id), [TIE_B, TIE_A, EARLY, UNDATED]);
  assert.deepEqual(listEntities(t, "skill").entities.map((e) => e.id), [UNDATED, TIE_B, EARLY, TIE_A], "address order is untouched");
});

test("entities whose ids say no moment follow in address order, and a list of only those is refused", () => {
  const t = dated([[EARLY, "skills/c"], ["skills/z", "skills/z"], ["skills/y", "skills/y"]]);
  assert.deepEqual(listEntities(t, "skill", { order: "newest" }).entities.map((e) => e.id), [EARLY, "skills/y", "skills/z"]);
  const none = dated([["skills/z", "skills/z"], ["skills/y", "skills/y"]]);
  assert.throws(() => listEntities(none, "skill", { order: "oldest" }), (e) => e instanceof ModelError && e.code === "no_creation_time"
    && e.details.order === "oldest" && e.details.type === "skill" && /address/.test(e.message));
  assert.throws(() => listEntities(none, undefined, { order: "newest" }), (e) => e.code === "no_creation_time" && e.details.type === null);
  assert.equal(listEntities(none, "skill").page.total, 2, "address order lists them");
});

test("a list its filters leave empty is an empty page in any order, never a refusal", () => {
  const r = listEntities(s, "skill", { owner: s.rootId, order: "newest" });
  assert.deepEqual([r.entities, r.page.total], [[], 0]);
});

test("a walk through newest meets every entity once, in the order one large page gives", () => {
  const whole = listEntities(s, undefined, { order: "newest", limit: 200 }).entities;
  const walked = [];
  let cursor;
  do {
    const r = listEntities(s, undefined, { order: "newest", limit: 2, cursor });
    walked.push(...r.entities);
    cursor = r.page.nextCursor;
  } while (cursor);
  assert.deepEqual(walked, whole);
  assert.equal(new Set(walked.map((e) => e.id)).size, s.entities.length);
  const times = walked.map((e) => e.created);
  assert.deepEqual(times, [...times].sort().reverse());
  assert.equal(walked[0].created, createdOf(walked[0].id));
});

test("an order outside the three is refused, named", () => {
  assert.throws(() => listEntities(s, "skill", { order: "latest" }), (e) => e.code === "invalid_argument" && e.details.argument === "order");
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/model.test.mjs` Expected: FAIL. The first new test fails on `requireType` refusing `undefined` as `unknown_type`; the order tests fail on the address order.

- [ ] **Step 3: Add the code**

In `lib/errors.mjs`, append `"no_creation_time"` as the last entry of `CODES`, and add to `WHEN`:

```js
  no_creation_time: "an order by when entities came into the model, over a list whose ids carry no time",
```

In `lib/schemas.mjs`, add to `DETAILS`:

```js
  no_creation_time: z.strictObject({ order: z.enum(["newest", "oldest"]), type: z.string().nullable() }),
```

and in `OUTPUTS.list_entities` change `type: z.string()` to `type: z.string().nullable()`.

- [ ] **Step 4: Order the list**

In `lib/model.mjs`, replace `listEntities` and the comment above it with:

```js
// The orders a list of entities takes. Address is where the pages sit, the order every list had
// before this one could take another, and stays the default. Newest and oldest order by the
// moment each id was made, then by the id, so the order is fixed and a cursor stays an offset;
// newest is oldest reversed.
export const ORDERS = ["address", "newest", "oldest"];

// The entities of one type, or of every type where none is named, a page at a time. An owned
// type's entities are kept to one owner where one is named, which is how a client lists one
// profile's experiences. An entity whose id says no moment follows the ones that do, in address
// order, so a list by moment still holds every entity. A list where none says one is refused,
// because an answer that looks newest-first and is not is the failure that looks like success;
// a list its filters leave empty is an empty page in any order.
export function listEntities(s, type, { owner, order = "address", limit, cursor } = {}) {
  if (type !== undefined) requireType(s, type);
  if (!ORDERS.includes(order)) throw new ModelError("invalid_argument", `order is one of ${ORDERS.join(", ")}`, { details: { argument: "order", reason: `one of ${ORDERS.join(", ")}` } });
  const held = owner === undefined ? undefined : requireId(s, owner).id;
  let chosen = s.entities.filter((e) => (type === undefined || e.type === type) && (held === undefined || e.owner === held))
    .sort((a, b) => cmp(place(a), place(b)));
  if (order !== "address") {
    const at = createdIn(s);
    const timed = chosen.filter((e) => at.get(e.id));
    if (chosen.length && !timed.length)
      throw new ModelError("no_creation_time", `the ids in this list carry no time to order by; order "address" lists them`, { details: { order, type: type ?? null } });
    const sign = order === "newest" ? -1 : 1;
    timed.sort((a, b) => sign * (cmp(at.get(a.id), at.get(b.id)) || cmp(a.id, b.id)));
    chosen = [...timed, ...chosen.filter((e) => !at.get(e.id))];
  }
  const all = chosen.map((e) => ({ id: e.id, type: e.type, name: e.name, tagline: e.tagline, owner: e.owner ?? null, ...withCreated(s, e) }));
  const { items, page } = paginate(all, { limit, cursor }, s.commit);
  return { type: type ?? null, entities: items, page, model: provenance(s) };
}
```

Two ISO times of one form compare as strings in time order, which is why `cmp` serves for both keys.

- [ ] **Step 5: Run the model tests to see them pass**

Run: `node --test test/model.test.mjs` Expected: PASS, every test.

- [ ] **Step 6: Write the failing tool tests**

In `test/arguments.test.mjs`, add to `CASES`:

```js
    ["list_entities", { order: "latest" }, "order"],
```

In `test/descriptions.test.mjs`, in `"a paged tool says how to continue, and a tool with a sibling names it"`, add:

```js
  assert.match(of("list_entities"), /`order`/);
  assert.match(of("list_entities"), /newest/);
```

In `test/contract.test.mjs`, add `import { createdOf } from "../lib/model.mjs";` and, inside the `for (const [label, s] of FIXTURES)` loop after the refusals test, add:

```js
  test(`${label}: list_entities without a type, by newest, answers in order or says the ids carry no time`, async () => {
    const client = await connect(s);
    const r = await client.callTool({ name: "list_entities", arguments: { order: "newest", limit: 200 } });
    if (s.entities.some((e) => createdOf(e.id))) {
      const a = checkAnswer("list_entities", r);
      assert.equal(a.type, null);
      const times = a.entities.map((e) => e.created).filter(Boolean);
      assert.ok(times.length > 1);
      assert.deepEqual(times, [...times].sort().reverse());
    } else {
      assert.equal(r.isError, true);
      const { error } = checkAnswer("list_entities", r);
      assert.equal(error.code, "no_creation_time");
      assert.deepEqual(error.details, { order: "newest", type: null });
      assert.equal(error.message, r.content[0].text);
      reached.add(error.code);
    }
    await client.close();
  });
```

The worked example takes the first branch and the reference instance the second, so both run and the code is reached before the test that requires every code to be.

In `test/describe-errors.test.mjs`, add `instanceSnapshot` to the import from `./helpers.mjs`, and in `"the served schema judges real refusals"`, after the `for` loop over `CASES`, add:

```js
  const undated = await connect(instanceSnapshot());
  const timeless = await undated.callTool({ name: "list_entities", arguments: { order: "oldest" } });
  assert.equal(timeless.structuredContent.error.code, "no_creation_time");
  assert.ok(whole.safeParse(timeless.structuredContent).success, "no_creation_time: the served schema refuses a real refusal");
  assert.ok(detailsOf.no_creation_time.safeParse(timeless.structuredContent.error.details).success, "no_creation_time: its details");
  await undated.close();
```

- [ ] **Step 7: Run them to see them fail**

Run: `node --test test/arguments.test.mjs test/descriptions.test.mjs test/contract.test.mjs test/describe-errors.test.mjs` Expected: FAIL. The tool's input still requires `type` and has no `order`, so `list_entities { order: "newest" }` is refused as `invalid_argument` on `type`, the description names no order, and `docs/INTERFACE.md`'s table has no `no_creation_time` row.

- [ ] **Step 8: Take the arguments**

In `lib/tools.mjs`, add `ORDERS` to the import from `./model.mjs`, and replace the `list_entities` entry with:

```js
  { name: "list_entities",
    description: "Entities in address order, or by when they came into the model. Use to browse; to find by words or name use search. Input: optional `type`, `owner` (an id or address), `order` (address, newest, oldest), `limit`, `cursor`. Returns `entities` with `id`, `type`, `name`, `tagline`, `owner`, `created`, and `page`; follow `page.nextCursor` while `page.hasMore`.",
    input: z.object({
      type: z.string().optional().describe("A type, to keep its entities; leave it out to list every type"),
      owner: z.string().optional().describe("An owner's id or address, to keep its entities"),
      order: z.enum(ORDERS).optional().describe("address, where the pages sit, by default; newest or oldest, by when each entity came into the model"),
      ...paged }),
    call: (s, { type, ...options }) => listEntities(s, type, options),
    output: OUTPUTS.list_entities },
```

- [ ] **Step 9: Add the code to the document's table**

In `docs/INTERFACE.md`, in the table under `## Refusals`, add a row after `cannot_draw`:

```markdown
| `no_creation_time` | an order by when entities came into the model, over a list whose ids carry no time | `order`: `newest` or `oldest`, `type`: the type named or null |
```

Run `npm run interface`. The examples keep two entries of every list, so the `describe_errors` example may not change; any change the script makes is to a generated example and nothing else.

- [ ] **Step 10: Run everything**

Run: `node --test test/arguments.test.mjs test/descriptions.test.mjs test/contract.test.mjs test/describe-errors.test.mjs test/model.test.mjs` Expected: PASS.

Run: `npm test` Expected: PASS.

- [ ] **Step 11: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add lib/model.mjs lib/errors.mjs lib/schemas.mjs lib/tools.mjs docs/INTERFACE.md test/model.test.mjs test/contract.test.mjs test/describe-errors.test.mjs test/arguments.test.mjs test/descriptions.test.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F - <<'EOF'
list_entities lists every type and orders by when entities came in

list_entities may leave out its type to list every type, and then names none in its answer, and takes an order: address, as before and by default, or newest and oldest by the moment each id was made, then by the id. Entities whose ids say no moment follow in address order, and a list where none does is refused with a new code, no_creation_time, rather than served in an order that only looks right.

Verified: the new tests in test/model.test.mjs failed on the address order first; node --test over the model, arguments, descriptions, contract and describe-errors tests and npm test pass; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 3: The document, the README and each deployment's own check

**Files:**

- Modify: `docs/INTERFACE.md` (`## Which tool`, `### list_entities`, a new `### list_entities by newest`, `### get_entity`, `### search`)
- Modify: `scripts/interface.mjs` (`EXAMPLES`)
- Modify: `README.md` (the `list_entities` row)
- Modify: `deploy/test/tools.mjs`
- Test: `test/interface.test.mjs` (existing, holds the document to the script), `test/deploy-tools.test.mjs` (existing, runs the deployment's tests)

**Interfaces:**

- Consumes: `list_entities` with `order` and without `type`, and `created`, from Tasks 1 and 2.
- Produces: nothing a later task uses.

- [ ] **Step 1: Write the failing example**

In `scripts/interface.mjs`, add to `EXAMPLES` after the `` "`list_entities`" `` entry:

```js
  "`list_entities` by newest": { name: "list_entities", arguments: { order: "newest", limit: 2 } },
```

Run: `npm run interface` Expected: FAIL with `docs/INTERFACE.md has no heading "### `list_entities` by newest"`.

- [ ] **Step 2: Write the prose**

In `docs/INTERFACE.md`, under `## Which tool`, change `` `list_entities` browses one type, `` to `` `list_entities` browses one type or every type, in address order or by when entities came into the model, ``.

Replace the paragraph under `### list_entities` with:

```markdown
Optional `type`, which keeps its entities and, left out, lists every type; optional `owner`, an id or an address, to keep one owner's entities; optional `order`; `limit` and `cursor`. `entities` and `page`, and `type`, the type named or null where none was. `order` is `address`, where the pages sit, by default, or `newest` or `oldest`, by `created` and then by the id, `newest` being `oldest` reversed. An entity carries `created` where its id is a UUID version 7: the moment the id was made, in ISO 8601 and UTC to the millisecond. Every id `companygraph id` makes is one, and `companygraph ids` gave each page written before ids existed one from its first commit, so `created` is when the entity came into the model. An entity whose id is not version 7 carries no `created` and, in `newest` or `oldest` order, follows the ones that do, in address order; a list where none carries one is refused as `no_creation_time`, and `address` order lists it.
```

After the `json` fence that closes the `### list_entities` example, add a heading with a fence for the script to fill. The fence holds a placeholder line, `{}`, because the script finds a fence's close as a line break followed by three backticks, which an empty fence does not have:

````markdown
### `list_entities` by newest

Every type, the entity that came into the model last first: the ten newest entities with their taglines are `{ "order": "newest", "limit": 10 }`.

```json
{}
```
````

Under `### get_entity` and `### search`, add one sentence at the end of each section's first paragraph: `` An entity carries `created` where its id is a UUID version 7, as under `list_entities`. ``

- [ ] **Step 3: Fill the example and hold the document**

Run: `npm run interface` Expected: exit 0; the new fence holds a call with `"order": "newest"` and an answer whose `type` is `null` and whose two entities carry `created`, the first not earlier than the second.

Run: `node --test test/interface.test.mjs` Expected: PASS.

- [ ] **Step 4: The README row**

In `README.md`, change the row

```markdown
| `list_entities` | the entities of one type, paged |
```

to

```markdown
| `list_entities` | the entities of one type or of every type, by address or by when they came into the model, paged |
```

- [ ] **Step 5: Each deployment holds the order against its own model**

In `deploy/test/tools.mjs`, inside `registerToolsTests`, after the test `"a search by words finds the identity by its own name over this snapshot"`, add:

```js
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
    const times = answer.entities.map((e) => e.created).filter(Boolean);
    assert.ok(times.length > 0);
    assert.ok(times[0] >= times.at(-1), `${times[0]} is not earlier than ${times.at(-1)}`);
    await client.close();
  });
```

Run: `node --test test/deploy-tools.test.mjs` Expected: PASS; the deployment built from the worked example runs the new test and it passes, not skips.

- [ ] **Step 6: Run everything**

Run: `npm test` Expected: PASS.

Run: `sh conventions/conventions-check && sh conventions/conventions-format check` Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add docs/INTERFACE.md scripts/interface.mjs README.md deploy/test/tools.mjs
git commit --author "Implementer <implementer@companygraph.io>" -F - <<'EOF'
The interface says how to list the newest entities

The interface document says that list_entities may list every type and order by created, what created means and where it comes from, and shows the newest-first call under a heading of its own, written from the worked example like every other. The README's row says the same, and each deployment now holds the newest order against the model it serves, skipping where its ids carry no time.

Verified: npm run interface wrote the new example; node --test test/interface.test.mjs and test/deploy-tools.test.mjs pass; npm test passes; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

- [ ] **Step 8: Push and open the pull request, then stop**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u https://github.com/companygraph/mcp-server.git the-newest-entities-build
gh pr create -R companygraph/mcp-server --base main --head the-newest-entities-build --title "A list can start with the newest entity" --body-file - <<'EOF'
list_entities may leave out its type to list every type, and takes an order: address, as before and by default, or newest and oldest by the moment each entity's id was made. Every entity that list_entities, search and get_entity serve carries that moment as created, read from its UUID version 7 id when the snapshot is first asked and never stored; an id that is not version 7 carries none. A list by moment where no id carries one is refused with a new code, no_creation_time. The ten newest entities with their taglines are now one call, the question the chat on companygraph.io could not answer.

The one break, for the release notes under Interface: the list_entities answer's type is null when no type was named. Every call that names a type, which every client makes today, sees nothing change.

Verified: npm test passes, the new tests having failed first; npm run interface wrote the new example; conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Report the pull request's URL and its checks. Merging, the release, its notes and the re-pins of the hosts and `companygraph/chat-server` are the owner's.
