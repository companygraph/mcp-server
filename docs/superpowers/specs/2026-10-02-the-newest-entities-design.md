# A list can start with the newest entity — design

> A visitor asks the chat on companygraph.io for the ten newest entities with their taglines, and the chat says it cannot: every id is a UUID version 7, which carries the moment it was made, but no tool reads that moment, and `list_entities` lists one type at a time in the order its pages sit. This lets `list_entities` list every type at once and in the order the entities came into the model, newest or oldest first, and gives every entity the moment as `created`, read from its own id. Nothing is stored that the id does not already say.

Status: proposed. Decided on 2026-10-02 with the owner against this repository at `09fe7a1` (v0.49.0), from the owner's question to the chat on companygraph.io, answered at mental-model `504554a`. Every deployment serves this package, so the order reaches each of them with a re-pin.

---

## 1. The gap

The chat answered three times, and each answer was true of the tools: `list_entities` takes one `type` and returns its entities in the order of their addresses, `search` returns a listing in its own order, and neither reads anything from an id but the id. The owner's reply, "So there is an id!", names what the tools leave unused. R18 makes every page's id permanent and, where an instance's `model/identifier.md` declares `uuidv7`, a UUID version 7, whose first 48 bits are the milliseconds since 1970 at which it was made. Every instance in the family declares it.

The moment means what a reader would want it to mean. `companygraph id` makes an id when a page is written, and `companygraph ids` gave every page written before ids existed an id from that page's first commit, so the moment in an id is when its entity came into the model, for an old page as for a new one. **What the change buys is the question "what is new in this model" answered from the model itself, in one call, with no history the server does not already hold.**

"Newest" here means created, never changed. When a page was last edited is a different question, it needs the repository's history, which a snapshot does not carry, and it is out of scope (§9).

## 2. The interface

`list_entities` changes in two ways, and every entity a tool returns gains one field.

**`type` becomes optional.** Named, it keeps the entities of that type, as today. Left out, the list holds the entities of every type, which is what a question about the whole model needs. `owner` keeps one owner's entities either way.

**`order` is a new optional argument**, one of `address`, `newest` and `oldest`. `address` is today's order, where the pages sit, and it is the default, so a call that names no order gets exactly the list it gets today. `newest` puts the latest `created` first, `oldest` the earliest. Two entities made in the same millisecond are ordered by their ids, so the order is fixed and a walk through it neither repeats nor skips, as INTERFACE.md promises of every list. The cursor stays an offset into that fixed order, so it carries nothing new, and a cursor sent back with another `order` than the call that made it is the case INTERFACE.md already names: a cursor sent back with other filters.

**`created` is a new output field** on every entity in `list_entities`, `search` and `get_entity`: the moment in the id, as an ISO 8601 time in UTC to the millisecond, `"2026-10-02T04:41:27.817Z"`. An entity whose id is not a UUID version 7 carries no `created` key, because no moment can be read from it and none is made up. `fetch` stays as it is: it returns the page as written, and the page does not write the moment. The ten newest entities with their taglines are one call:

```json
{ "tool": "list_entities", "arguments": { "order": "newest", "limit": 10 } }
```

## 3. Reading the moment

A function in `lib/model.mjs`, `createdOf(id)`, returns the moment or nothing. It answers only for an id in the canonical form, 36 characters in five groups, whose version digit, the first of the third group, is `7`; for any other id it returns nothing. The moment is the first twelve hexadecimal digits read as an integer, milliseconds since 1970, written with `Date.prototype.toISOString`. It is computed once per entity when a snapshot is loaded and kept beside the entity in memory, never written into the snapshot file, whose format is a contract of its own: the id is already there, and a second copy of what it says could only come to disagree with it.

An instance may hold entities with a moment and entities without one: an instance whose `model/identifier.md` declares a `pattern` holds none, and a model being moved from one form to the other may hold both. In `newest` and `oldest` order the entities with a moment come first in that order, and those without follow in address order, so the list still holds every entity it would hold in `address` order. Where no entity in the list carries a moment, the order cannot be what was asked for, and the call is refused with a new code, `no_creation_time`, whose message says that the ids in this list carry no time and that `address` order lists them, and whose details are `{ order, type }`, `type` null where none was named. It is refused rather than served in address order because an answer that looks newest-first and is not is the failure that looks like success.

## 4. The answer

`list_entities` keeps its shape. Its `entities` gain `created` where there is one, an optional field. Its `type` is the type named, as today, and `null` where none was named. That is a change to a required field's type, which INTERFACE.md counts as a break, so the release names it under `Interface` in its notes: a client that reads `type` from an answer to a call without one gets null. A client that names a type, which every client does today because the argument is required, sees nothing change.

`search` and `get_entity` gain `created` where there is one. Both are additive by INTERFACE.md's rule: a new output field, a new optional argument, a new error code.

The output schemas in `lib/schemas.mjs` say the same: `created` as an optional string in the ISO form on the entity shapes `list_entities`, `search` and `get_entity` return, `type` as `string | null` in the `list_entities` answer, and `no_creation_time` among the codes with its details.

## 5. The description

The tool's description in `lib/tools.mjs` says what the chat needs to find the order unaided, within the length the template allows: that `type` may be left out to list every type, that `order` takes `newest` or `oldest` to list by when entities came into the model, and that each entity carries `created`. The chat does not need a rule of its own for this; if a measured question shows it does, the rule goes into `companygraph/chat-server` in a release of its own.

## 6. Tests

`test/model.test.mjs`, which already holds the listing, gains the reading: a known UUID version 7 read to its moment, checked against a moment computed independently in the test; an id of version 4 and an id that is not a UUID read to nothing. The listing gains `newest` and `oldest` over a fixture the test builds, with two ids in one millisecond to hold the tie at the id; a fixture holding ids with and without a moment, where the ones without follow in address order; `no_creation_time` where no id carries a moment; no `type`, where the list holds every type; and a walk through `newest` in pages of two that meets every entity once.

`test/contract.test.mjs` gains a `list_entities` case with `order: "newest"` and no `type` per fixture, parsed against the schema like every other, and `no_creation_time` among the refusals it holds, and `test/describe-errors.test.mjs` finds the new code with its details. The positive control every schema has: an entity whose `created` is not an ISO time is rejected by the schema. The shared deployment tests in `deploy/test/tools.mjs` gain one `newest` call over the deployment's own snapshot, holding that its first entity's `created` is not earlier than its last's.

## 7. The interface document

`docs/INTERFACE.md`'s `list_entities` section says that `type` may be left out, names the three orders and that `address` is the default, and says where `created` comes from and what it means: the moment the id was made, which for a page written before ids existed is its first commit. It gains an example under its own heading, "`list_entities` by newest", written by `scripts/interface.mjs` from the worked example like every other. The sections on `search` and `get_entity` name `created`, and the list of codes names `no_creation_time`.

## 8. Files and release

`lib/model.mjs` gains `createdOf`, the moment kept beside each entity, and the orders in `listEntities`. `lib/schemas.mjs` and `lib/errors.mjs` gain the field, the nullable `type` and the code. `lib/tools.mjs` makes `type` optional, adds `order` and widens the description. `scripts/interface.mjs` gains the example. The test files named in §6, and `docs/INTERFACE.md`, regenerated.

One release, the next minor after whatever `main` carries when this merges, with the one break §4 names under `Interface`. The MCP hosts and `companygraph/chat-server` then re-pin. Nothing changes in the meta-model or in any instance. Merging, the tag and the re-pins each wait for the owner's word.

## 9. Out of scope

When an entity was last changed, which needs the repository's history and is a question of its own. A `since` or `until` filter, which a client answers by walking `newest` until the moment it wants. Ordering `search` by `created`, whose order is its own listing. Reading a moment from an id that is not a UUID version 7, or making one up for it.
