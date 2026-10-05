# A list carries the facts it is asked by — design

> A visitor asks the chat on blust.ch what Robert is working on today, and the chat answers in general terms and says the model does not tell. The model does: four experiences have no `end`, which the experience schema says means the period is ongoing. No tool lets a client see that without fetching every experience one at a time, because `list_entities` returns a name and a tagline and nothing a page's frontmatter states. This gives every listed entity the short facts its frontmatter states, and lets a list be kept to a day, ordered by a date and kept to a value, so "what is running", "what came last" and "which are roles" are each one call.

Status: proposed. Decided on 2026-10-05 with the owner against this repository at `7fb0bd3`, from the owner's question to the chat on blust.ch, answered at robertblust/mental-model `00423dd`. Every deployment serves this package, so the change reaches each of them with a re-pin; `companygraph/chat-server` takes it up in a release of its own, which gives the chat today's date and the rules that use these arguments.

---

## 1. The gap

The chat matched the question to the model's question "What does Robert do?", which rests on the identity and on the concept *Company of one*, and answered from those. What answers it is a fact on four other pages: `end` absent on IT Architect, CompanyGraph, GuestGraph and blust.ch. A client that wants it has to list the experiences, which says nothing about dates, and then get each of them.

Listing them is already too much for the chat. The answer to `list_entities` with `type: experience` over that model is 19,904 characters, measured over a snapshot built from the model at that commit, and the chat cuts every tool answer at 16,000, so the chat has never read Robert's whole history in one answer, and what the cut takes is the end of the list and the `page` that would have said there is more. The same answer with every single-valued frontmatter fact added is 27,375 characters, so adding the facts without a way to ask for fewer entities would make the cut worse. **What the change buys is the question answered from the facts the model states, in one call small enough to arrive whole.**

The same holds wherever core declares a date, a status or a kind: `decided` and `status` on a decision, `adopted` and `horizon` on a strategy's objectives, `kind` on an experience, which says whether a period is a role, a project, education or community work.

## 2. The facts on a listed entity

Every entity `list_entities` returns gains `fields`, an object of the frontmatter facts its type's schema declares as one value: a `date`, an `enum`, a `number`, a `string`, or a reference that is not an array, `ref` or `ref?`. Each is written as the page writes it, a date at the precision the page states, `"2026-10"`, and a reference by the name the page writes. A field the page leaves out has no key. `id`, which the entity already carries, `source` and `source-id`, which say where a page is mastered and answer no visitor's question, and `image` are left out.

Which fields those are is read from the schema's Frontmatter table, the column `Type`, when a snapshot is loaded, so a field core adds later is listed without a change here, and a field a schema declares as an array is never listed by default. That is the line between short and long: R8 keeps frontmatter for short facts, and the arrays are what make a page's facts long, such as an experience's `skills`.

`get_entity` already returns every field and stays as it is. `search` stays as it is (§8).

## 3. The arguments

Four optional arguments, each one a narrowing of the list or of its order, so a call that names none gets the list it gets today, with `fields` added.

**`fields`**, an array of field names, adds those fields beside the default ones, for the question that needs an array across a list: `{ "type": "experience", "fields": ["skills"] }`. A name no listed type declares is refused with `invalid_argument`, naming the argument.

**`on`**, a date in one of the three forms R9 allows, keeps the entities whose period holds that date. A period is a type that declares both `start` and `end`; core declares it for `experience` and for nothing else today. A date at a precision coarser than a day stands for every day it covers, `2026-10` for the month, so a period holds the date where the two overlap: its start is not after the date's last day, and its end, where there is one, is not before the date's first day. An absent `end` is still running and holds every date from its start on. The four ongoing experiences are one call:

```json
{ "tool": "list_entities", "arguments": { "type": "experience", "on": "2026-10-05" } }
```

Where `type` names a type with no period, the call is refused with `invalid_argument`, naming the types that have one. Where no type is named, the list holds only the entities of types that have one.

**`by`**, the name of a date field, orders the list by that field instead of by creation, with `order` saying the direction: `newest` puts the latest date first, `oldest` the earliest, and `address`, the default, is refused beside `by` because it is no direction. A date compares by its first day, so `2026-10` sorts with `2026-10-01`; two equal dates are ordered by their ids, so the order is fixed and a cursor stays an offset. An entity without the field follows the ones that have it, in address order. A field that is not a date of a listed type is refused with `invalid_argument`. The latest role is one call: `{ "type": "experience", "where": { "kind": "Role" }, "by": "start", "order": "newest", "limit": 1 }`.

**`where`**, an object of field names and values, keeps the entities whose single-valued field equals the value, ignoring case; several fields must all match. A reference matches by the name its page writes, so `{ "kind": "Role" }` keeps the roles and `{ "status": "Standing" }` the decisions in force. A name that is not a single-valued field of a listed type is refused with `invalid_argument`, and a value that is not a string is refused the same way. `where` does not reach arrays, a missing field or a range; `on` is the one range a list takes, because a period is the one range core declares.

## 4. The answer

`list_entities` keeps its shape, and its `entities` gain `fields`, which is additive by INTERFACE.md's rule, as are four optional arguments and refusals under an existing code. The output schema in `lib/schemas.mjs` gives `fields` as an object of strings or numbers, or arrays of them where `fields` asked for one, and the input schema in `lib/tools.mjs` the four arguments.

The cursor stays an offset into the list the call's arguments make, and a cursor sent back with other arguments is refused as it is today. A list `on`, `by` or `where` keeps or orders is still a whole list: `page.total` counts what it kept.

## 5. The description

The tool's description says what a client needs to find these unaided: that each entity carries the short facts of its frontmatter in `fields`; that `on` keeps the periods that hold a date, `by` with `order` sorts by a date and `where` keeps a value; and that a list too long for its reader is narrowed by these and `limit` rather than read whole. The chat's own rules for when to use them go into `companygraph/chat-server`.

## 6. Tests

`test/model.test.mjs` holds the listing and gains each argument over a fixture the test builds: `fields` with a date, an enum, a single reference and a string present and an array, `id`, `source` and `source-id` absent; `fields: ["skills"]` adding the array, and an unknown name refused. `on` over periods with an end, without one and with dates at the three precisions, holding that `2026-10` start holds `2026-10-05`, that a period ended `2026-09` does not, and that a period starting after the date does not; a type with no period refused; no type named keeping only periods. `by` newest and oldest with a tie held at the id and an entity without the field last; `by` with `address` refused; a field that is not a date refused. `where` on an enum and on a reference by name, case ignored, two fields at once, and a field that is an array refused. A walk through a `where` list in pages of one returns every kept entity once.

`test/contract.test.mjs` gains a `list_entities` case per fixture with `on`, `by` and `where`, parsed against the output schema, and the refusals among those it holds. The positive control: an entity whose `fields` holds an object is rejected by the schema. The shared deployment tests in `deploy/test/tools.mjs` gain one call over the deployment's own snapshot holding that every listed entity carries `fields` and none of them carries `id`, `source` or `source-id` inside it.

## 7. Files and release

`lib/model.mjs` reads the single-valued fields per type when a snapshot loads and gains the four arguments in `listEntities`. `lib/schemas.mjs` and `lib/tools.mjs` gain the field and the arguments, `scripts/interface.mjs` an example, "`list_entities` on a date", and `docs/INTERFACE.md` the section, regenerated. The tests named in §6.

One release, the next minor after whatever `main` carries when this merges: every change is additive. The MCP hosts and `companygraph/chat-server` then re-pin. Nothing changes in the meta-model or in any instance. Merging, the tag and the re-pins each wait for the owner's word.

## 8. Out of scope

The same facts on `search`, whose answer is a listing of matches and which a client follows with `list_entities` once it knows the type. A filter on arrays, on a missing field or on a range other than a period. Ranges on a type that dates itself with other names than `start` and `end`, such as a strategic objective's `adopted` and `horizon`; `by` orders by them, and a range over them waits for a question that needs it.
