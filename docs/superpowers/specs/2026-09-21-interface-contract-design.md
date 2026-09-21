# The interface is a contract — design

> A client of this server learns what a tool returns by calling it, because every tool declares
> one output field, `model`, and nothing else. A list returns everything it has, an error is a
> sentence to be parsed, two tools return the same entity in two wrappings, and a relation is
> reachable only by taking a whole entity or the whole vocabulary. The interface becomes a
> contract: every tool declares what it answers, a suite holds each answer to the declaration,
> lists are bounded and paged, errors carry codes, and one document says what may change.

Status: proposed. Decided on 2026-09-21 with the owner against this repository at `995f00f` (v0.18.0), from a client's review of the two deployments, mcp.blust.ch and mcp.companygraph.io. Both serve this package, so everything here reaches both with a re-pin.

---

## 1. The gap

Every tool registers the same output schema, a loose object requiring `model`, so a client that reads `tools/list` learns nothing about `entities`, `results` or `references` and cannot validate an answer. `list_entities` and `search` return every match in one answer, whatever the instance's size. A refused call is a sentence: the ids of an ambiguous name are inside it, comma-separated, and a client that wants them parses prose. `fetch` returns the page as written and the structured entity beside it, which is what `get_entity` returns, so nothing says which to call; `get_entity` takes a type and a name only, so an entity whose name two owners hold cannot be asked for there at all. A client that wants one entity's edges of one kind takes the whole entity, and one that wants what a single type declares takes the whole vocabulary. The descriptions run from one line to a paragraph and define their terms where they happen to use them.

The owner chose a clean break over an additive release. The package is below 1.0 and its two deployments take it by re-pinning, so this is the release in which a field can still be renamed for the price of a paragraph in the notes. **What the break buys is one shape per idea: one reference, one edge, one page, one error, used by every tool that needs it.**

## 2. Shared shapes

Four shapes recur, and each is declared once in `lib/schemas.mjs` and used wherever it appears.

An **entity reference** is `{id, type, name}`. The id is the canonical identifier, the one the parser gives the entity from where its page sits under the model, such as `skills/domain-driven-design`, and it is unique across the instance; the name is the canonical name, the page's H1, unique within its type and, for an owned type, within its owner.

An **edge** is `{from, via, to, attrs}`, where `from` and `to` are entity references, `via` is the field or `Section.Column` that drew it, or `owner` for nesting, and `attrs` is an open record of the row's other columns, a resolved qualifier arriving as an entity reference. Today an entity's edges arrive flattened, the far end's `id`, `type` and `name` spread beside `via`; the edge names both ends so the same shape serves an entity's answer and a list of edges that belong to no single entity.

A **page** is `{total, returned, hasMore, nextCursor}` and §4 says how it behaves. **Provenance** is `model`, as today: `{commit, repo, core, parser}` on every answer, errors included.

Entity content stays open where it varies by schema: `fields` is a record of frontmatter, and a section is `{heading, text, tables}` with a table as `{columns, rows}` and further keys allowed, since the parser may give a section more than this package names. Everything else is closed and required: ids, names, result arrays, edges, `page`, `model`.

## 3. The tools

| Tool | Arguments | Answer |
| --- | --- | --- |
| `list_types` | none | `types[{type, name, tagline, owner, count}]` |
| `describe_schema` | `type` | `type`, `name`, `tagline`, `sections`, `relations{owner, owns, references, referencedBy, enums, joins, lists}` |
| `describe_relations` | optional `type`, `direction`, `via` | `relations`, `ownership`, `enums`, `joins`, `lists`, `forms`, `reading` |
| `list_rules` | none | `tagline`, `rules[{rule, title, part}]` |
| `describe_rule` | `rule` | `rule`, `title`, `part`, `text` |
| `list_checks` | none | `checks[{name, rule, title}]`, `ranBy` |
| `list_entities` | `type`, optional `owner`, `limit`, `cursor` | `type`, `entities[{id, type, name, tagline, owner}]`, `page` |
| `get_entity` | `id`, or `type` and `name` | `entity{id, type, name, tagline, owner, path, url, fields, sections, references, referencedBy, referenceCounts}` |
| `list_references` | optional `entity`, `direction`, `via`, `type`, `limit`, `cursor` | `edges`, `page` |
| `find_evidence` | `skill`, an id or a canonical name | `skill`, `evidence` keyed by the drawing page's type, each entry an edge with the page's `owner` and `stamp` |
| `search` | `query`, optional `match`, `type`, `owner`, `limit`, `cursor` | `query`, `match`, `results[{id, title, type, owner, tagline, url, matched}]`, `page` |
| `fetch` | `id` | `id`, `title`, `type`, `url`, `text` |

**`get_entity` is the structured entity and `fetch` is the page as written.** `get_entity` answers with fields, sections, tables and edges as data, for a client that reasons over the model; `fetch` answers with the Markdown source, for a client that quotes or displays it, and carries no structured copy. Each description opens by saying so and names the other. `get_entity` takes an id wherever a name could be ambiguous, and either form alone is enough; given both, the id wins and the rest is ignored. `fetch` takes an id only. The bare-name fallback it has today goes, because `search` with `match: "name"` now answers the same question with every candidate rather than a refusal.

`get_entity` caps `references` and `referencedBy` at fifty edges each, in edge order, and `referenceCounts{references, referencedBy}` carries the true totals, so a client sees when it has a part and takes the rest from `list_references`. An entity's own content is never cut.

`list_references` is the instance's edges, ownership included, filtered and paged. `entity` is an id and `direction` — `out`, `in` or `both`, default `both` — reads relative to it; without `entity`, direction has nothing to be relative to and is refused as `invalid_argument`. `via` matches the drawing field exactly, `Skills.Skill` or `owner`. `type` is the type of the far end when `entity` is given and of either end when it is not. With no argument at all it pages through every edge of the instance, which is allowed because it is bounded.

`describe_relations` takes the same idea to the schemas. `type` keeps the declarations that involve one type, `direction` — `declares`, `declared-to` or `both` — says which side of them the type stands on, and `via` keeps one field or column. `ownership`, `enums`, `joins` and `lists` narrow to the type when one is given; `forms` and `reading` always arrive whole, because they explain the terms of whatever subset is returned. It is not paged: the vocabulary is the size of the core, which an instance does not grow.

`search` has two modes. `match: "text"`, the default, is today's case-insensitive substring over name, tagline, fields, section text and table cells. `match: "name"` returns the entities whose canonical name equals the query, case-insensitive, across types unless filtered: the exact lookup, and the way to candidate ids before `get_entity`. `type` and `owner` filter either mode, `owner` being the owning entity's id. Match information has one form in both: `matched` is a list of `{where, key}`, with `where` one of `name`, `tagline`, `field`, `section`, `table` and `key` the field name or section heading, null for the first two. It replaces today's `field:source` strings, which a client had to split. A result keeps `title`, and `fetch` keeps `title` and `text`, because some clients call only these two tools and require those field names; everywhere else a name is `name`.

## 4. Paging

`list_entities`, `list_references` and `search` take `limit`, default 50 and at most 200, and `cursor`, and answer with `page`: `total` is the count after filters and before the cut, `returned` the length of this answer's array, `hasMore` whether a later page exists, and `nextCursor` the string to send back, null when there is none. A limit outside the range is clamped rather than refused, so a client asking for a thousand gets two hundred and a `page` that says more exist.

Order is fixed, since a cursor over an unstable order repeats and skips: entities by id, search results by type then name then id, edges by `from.id`, `via`, `to.id`. The cursor is opaque to a client and holds the offset and the snapshot's commit. A snapshot never changes while it is served, so an offset is exact; a deployment that re-pins between two pages serves a different model, and a cursor carrying another commit is refused as `invalid_cursor` rather than answered from the wrong list. A cursor sent with different filters than the call that produced it is not detected, and the interface document says so.

## 5. Errors

A refused call answers `isError: true`, the sentence as text, as today, and the same facts as structured content:

```json
{ "error": { "code": "ambiguous_name",
             "message": "R2: \"Discovery\" is the name of 2 phase entities, one in each of their owners; ask by id",
             "rule": "R2",
             "details": { "type": "phase", "name": "Discovery",
                          "candidates": [{ "id": "…", "type": "phase", "name": "Discovery", "owner": "…" }] } },
  "model": { "commit": "…", "repo": "…", "core": "…", "parser": "…" } }
```

The codes are a closed list, and each code fixes the keys of its `details`. `rule` is the convention the refusal rests on, `R2` or `R4`, and null where none does.

| Code | When | `details` |
| --- | --- | --- |
| `unknown_type` | no schema declares the type | `type`, `declared` |
| `unknown_entity` | an id, or a type and name, resolves to nothing | `id`, or `type` and `name` |
| `ambiguous_name` | more than one entity holds the name | `type`, `name`, `candidates`, each an entity reference with `owner` |
| `unknown_rule` | no rule has the number | `rule`, `rules` |
| `invalid_argument` | an empty query, neither id nor type and name, a direction with no entity | `argument`, `reason` |
| `invalid_cursor` | a cursor that does not decode, or one from another commit | `reason` |
| `unsupported_snapshot` | the snapshot predates what the tool reads | `missing` |

`ModelError` moves to `lib/errors.mjs` and carries `code`, `rule` and `details`; the sentence stays its message. One limit is the SDK's and is stated rather than hidden: arguments that fail the input schema, a number where a string belongs or a value outside an enum, are refused by the SDK before this package runs, as a sentence with no code. Input schemas are therefore kept loose where a code serves better, the clamped `limit` being the case in point, and the interface document names what remains.

The SDK validates structured content against the output schema on success and skips it on an error, so the error shape is a schema of its own, exported beside the others and held by the suite.

## 6. Descriptions and terms

Every description follows one template in at most sixty words: what the tool is for, when to use it and which sibling to use instead, its inputs, the shape of its answer, its limits. The terms they lean on — id, canonical name, owner, `via`, reference, qualifier — are defined once, in a glossary paragraph appended to the server's `instructions` after the model's taglines and before the sentence about provenance, so a description uses a term without defining it again. The paragraph is this package's and names no instance fact, no commit and no version, which the existing test on the instructions already demands. `describe_relations` loses its paragraph of a description, since its answer carries `reading`, which explains the same terms beside the data.

A test holds the template's checkable half: the length cap, a description for every tool, and `get_entity` and `fetch` each naming the other. The landing page prints the tools from the same list and needs no change of its own.

## 7. Contract tests

`test/contract.test.mjs` runs over the worked example and the reference instance, through a real client on an in-memory transport, and parses every answer against that tool's exported output schema inside the test, so a failure names the field rather than surfacing as the SDK's protocol error.

Each tool has a happy case and the empty cases it can produce: a search with no hit, a type that holds no entity, a reference filter that matches nothing, each still carrying its arrays and its `page`. Each error code has a case parsed against the error schema, the ambiguous ones on the two fixtures the suite already builds — a name an identity and a profile share, a title two owners each hold — with the candidate ids asserted. Each paged tool is walked page by page at a small limit and the concatenation compared with the whole: nothing repeated, nothing missed, `hasMore` and `nextCursor` agreeing, and a cursor from another commit refused.

A schema that accepts anything passes every one of those, so each schema gets a positive control: a real answer with a required field deleted, and one with a string turned into a number, must both be rejected. A last test lists the server's tools and fails when one has no contract case, the way `server.test.mjs` already refuses a tool nobody calls.

The shared deployment tests in `deploy/test/tools.mjs` move to the new arguments and gain the same parse, over each deployment's own snapshot, so a deployment's suite holds the contract against the model it actually serves.

## 8. The interface document

`docs/INTERFACE.md` is the published contract: the glossary, the shared shapes, and for every tool its arguments, its answer's fields and one real response; the error codes with their details; the paging rules with what a cursor does not detect; and what counts as a break. **Breaking: a tool's name, an argument's name or meaning, a required output field's name or type, an error code or its details, and how an id is formed. Additive: a new tool, a new optional argument, a new output field.** Release notes name every break under a heading of their own, `Interface`, so a client's maintainer reads one section.

The examples are written by a script from the worked example and a test fails when the file differs from what the script would write, the family's rule that CI checks a committed artifact and never writes it. The README's tools table gives way to one line per tool and a pointer to the document; `lib/schemas.mjs` is exported as `companygraph-mcp-server/schemas` so a client or a deployment validates against the same objects the server registers.

## 9. Files

`lib/schemas.mjs` holds the shared shapes, one output schema per tool and the error schema. `lib/errors.mjs` holds `ModelError` and the codes. `lib/paging.mjs` holds the cursor and one `paginate` function; `lib/page.mjs` is the landing page and keeps its name. `lib/model.mjs` keeps the queries, gains `listReferences` and the filters, and throws coded errors. `lib/tools.mjs` stays the single list: name, description, input, output, call. `lib/server.mjs` gains the glossary paragraph. `scripts/interface.mjs` writes the document's examples.

## 10. Release and what breaks

One release, v0.19.0, a minor: `WORKING.md` makes a change a major when the taking repository must do more than re-pin, and a deployment does no more, since the tests that call the tools ship with the package. For a client of a deployment it breaks, and the notes say so first, under `Interface`: `fetch` takes an id only and no longer returns `entity`; `get_entity`'s edges take the edge shape, are capped, and come with counts; `search` results are paged, `total` moves into `page`, and `matched` becomes objects; `list_entities` is paged and each entry gains `type`; a refused call carries structured content. Ids are formed as before.

The two deployments re-pin in their three places after the release. Their Registry entries describe the server and not its tools, and whether they take a new version is decided at the re-pin. Merging, the tag and the re-pins each wait for the owner's word.

## 11. Out of scope

Write tools, authentication, resources and prompts, as before. Ranking in `search`, which stays a listing. Paging for `describe_relations`, `list_types`, `list_rules` and `list_checks`, whose size is the core's. Detecting a cursor reused under different filters. Codes for what the SDK refuses before a tool runs.
