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
