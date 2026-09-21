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
