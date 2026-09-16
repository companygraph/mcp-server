# CompanyGraph MCP server — design

A read-only MCP server for any CompanyGraph instance. It answers an agent's questions with the
model's own facts, from one pinned commit, through seven tools derived from the schemas the
instance declares. It knows no instance-specific type, name or fact.

Brief: `brief-mcp-server.md` of 2026-09-16, decided with the owner. Deployment of the reference
instance is a separate repository, `robertblust/mcp-blust-ch`, with its own design.

## 1. What it is for

The vision of the reference instance is "one model, true everywhere": whoever asks about the
company — a person, a search engine, an agent — reaches the same answer, because every surface
derives from one model. The surfaces that exist (a site, a CV, a LinkedIn projection, a skill
bundle) are read by people or loaded whole. None is queryable by an agent. This server is that
surface: an agent asks about a skill, an experience, a value, and gets what the model says,
verbatim, with the commit it came from.

## 2. Decisions the design rests on

- **Read-only.** No tool writes. Changes go through git and the instance's validation pass.
- **No auth.** A public model, a public server.
- **Build-time snapshot.** The model is parsed once, into a JSON document, and the server
  serves that document. Nothing is parsed at request time.
- **The parser is imported, never copied.** `companygraph-meta-model/instance`, pinned by git
  tag in `package.json` the way blust.ch pins it. `parseInstance` and `parseSchemas` are the
  only readers of Markdown in this package.
- **Schemas come from the instance.** The parser reads the model against the schemas the
  instance vendors at the same commit — `meta/core/` in the reference instance, `core/` beside
  the worked example. Never against a newer core the instance has not adopted.
- **Typed resolution (R2, R4).** A name resolves within a type. A lookup that receives a name
  without a type and finds it under more than one type refuses and names the types. Nothing
  resolves to the first match.
- **Portability.** No instance-specific type, field, person, company or fact in this package.
  The test suite runs every tool against the worked example in `companygraph/meta-model`.
- **Honesty.** The server reports what the model says. Evidence strings are verbatim. It adds
  no summary, ranking or claim of its own.
- **No surface file.** The server is a build that writes its surface, and the surface schema
  says a script-written surface has no file in the model. The script is the projection.
- **Plain ESM JavaScript, Node 22, `node --test`.** The shape of the parser it imports and of
  every other package in the family. No build step.
- **Transport:** MCP Streamable HTTP, stateless, JSON responses. A stdio entry point shares
  the same core.

## 3. Shape of the package

```
companygraph-mcp-server
├── bin/
│   ├── snapshot.mjs     write a snapshot from a model + core, local or from GitHub
│   ├── stdio.mjs        serve a model over stdio (builds the snapshot in memory)
│   └── http.mjs         serve a baked snapshot over Streamable HTTP
├── lib/
│   ├── read.mjs         directory → Map(path → text); GitHub tarball → the same map
│   ├── snapshot.mjs     files + schemas + provenance → snapshot document
│   ├── model.mjs        the seven queries over a snapshot, pure
│   ├── tools.mjs        registers the seven tools on an McpServer
│   └── server.mjs       builds the McpServer: name, title, version, instructions
├── test/
│   ├── fixtures/        gitignored; `npm run fixtures` fetches meta-model at the pinned tag
│   └── *.test.mjs
├── docs/superpowers/
├── package.json
└── README.md
```

Dependencies: `companygraph-meta-model` (git tag), `@modelcontextprotocol/server`,
`@modelcontextprotocol/node`, `zod`. Nothing else at runtime.

## 4. The snapshot

`buildSnapshot({ files, schemas, sub, core, commit, repo })` returns:

```json
{
  "commit": "c43921f7…",
  "repo": "robertblust/mental-model",
  "core": { "version": "0.25.2", "parser": "v0.25.2" },
  "root": "Robert Blust",
  "rootId": "identity",
  "types": [ { "type": "skill", "folder": "skills", "owner": null, "singular": false } ],
  "schemas": [ { "id": "core/skill", "name": "Skill Schema", "tagline": "…", "sections": [ … ] } ],
  "entities": [ { "id": "…", "type": "…", "name": "…", "tagline": "…", "fields": {}, "sections": [ … ],
                  "owner": null, "path": "model/…", "stamp": {}, "markdown": "…" } ],
  "edges": [ { "from": "…", "to": "…", "via": "…", "attrs": {} } ]
}
```

- `entities` and `edges` are the parser's output, untouched, plus `markdown`: the entity's
  source file verbatim, so `fetch` can hand a client the page as written.
- `schemas` is `parseSchemas(core).entities`.
- `core.version` is read from the core's `manifest.json`, which sits in `meta/core/` in an
  instance and in `core/` in meta-model. `core.parser` is the tag `package.json` pins.
- `commit` and `repo` come from the caller. The stdio entry point reads a local directory and
  sets `commit` to what `git rev-parse HEAD` says there, or `null` outside a repository, or
  `null` when the directory has uncommitted changes, since a commit must describe what is served.

`bin/snapshot.mjs`:

```
companygraph-mcp-snapshot <model-dir> <core-dir> [--commit <sha>] [--repo owner/name] --out snapshot.json
companygraph-mcp-snapshot --github owner/name@<sha> [--sub model/ --core meta/core/] --out snapshot.json
```

The GitHub form fetches the repository tarball at the commit with no token, or with
`GITHUB_TOKEN` when set, and reads the two subtrees out of it. `lib/read.mjs` is the one place
that touches a filesystem or the network; everything below it takes maps.

## 5. The seven tools

Every response is one JSON object, returned as `structuredContent` and as the same text in
`content`, and every one carries `model: { commit, repo, core, parser }`. Names are exact.

| Tool | Input | Returns |
| --- | --- | --- |
| `list_types` | — | every type the instance's schemas declare: `type`, `name`, `tagline`, `owner`, `count` of entities |
| `describe_schema` | `type` | the schema's Frontmatter table, its Sections table with each captioned column table, Purpose and Writing rules, as parsed sections |
| `list_entities` | `type` | `id`, `name`, `tagline`, `owner` of every entity of that type, sorted by id |
| `get_entity` | `type`, `name` | the entity, its `references` (edges out: `via`, `type`, `name`, `id`, `attrs`) and `referencedBy` (edges in, the same shape with `from`) |
| `find_evidence` | `skill` | the skill entity, and every edge into it grouped by the referencing type: from a profile's table with the row's other columns as `attrs` verbatim, from an experience with its `kind`, `start`, `end` and owner |
| `search` | `query` | `results`: `id`, `title`, `url`, `type`, `matched` for every entity whose name, tagline, frontmatter, section text or table cell contains the query, case-insensitive; sorted by type then name; `total` |
| `fetch` | `id` | the entity as `get_entity` returns it, plus `title`, `text` (the source Markdown) and `url` |

`search` and `fetch` carry the field names some clients require (`id`, `title`, `text`,
`url`), so the server also works with a client that calls only those two. `url` is the file on
GitHub at the commit when `repo` is known, else absent.

**Derivation, not enumeration.** `list_types` and `describe_schema` read `snapshot.schemas`.
`find_evidence` resolves `skill` within the type `skill` and reads `edges` whose `to` is that
id; the attributes are whatever columns the profile schema declares beside the reference,
returned under their declared names. Nothing in `lib/` names a column, a kind or a person.

**Resolution and refusal.**

- `get_entity(type, name)` with no entity of that type and name is an error naming both.
- `fetch(id)` first matches an entity id. A value that is no id is tried as a name: exactly one
  type holding it resolves; more than one is a refusal that names the types found; none is an
  error. Never the first match.
- `describe_schema(type)` and `list_entities(type)` with an undeclared type are errors that
  name the declared types.

An error is returned as a tool result with `isError: true` and one sentence that names the
rule where one applies (R2, R4).

## 6. The server

`createServer(snapshot, { name, version })` returns an `McpServer`:

- `name`: the package name. `version`: the package version.
- `title`: the identity's H1 (`snapshot.root`).
- `instructions`: the vision's tagline, then the identity's tagline, then one fixed sentence:
  "This server reports what the model says at commit … (core …) and adds nothing." A model
  without a vision entity gets the identity's tagline alone.

Tool descriptions are fixed strings about what a tool does; nothing in them is an instance
fact.

## 7. Transports

**stdio.** `companygraph-mcp <model-dir> <core-dir>` builds the snapshot in memory and serves
it over `StdioServerTransport`. This is the local form: `npx --package
github:companygraph/mcp-server companygraph-mcp ./model ./meta/core` from an instance's root.

**HTTP.** `companygraph-mcp-http --snapshot snapshot.json [--port 8080]` serves:

- `POST /mcp`: a fresh `NodeStreamableHTTPServerTransport` per request with
  `sessionIdGenerator: undefined` and `enableJsonResponse: true`, connected to the one server.
  `Cache-Control: no-store` on every response.
- `GET /mcp` and `DELETE /mcp`: `405`, since there is no session and no stream.
- `GET /healthz`: `200` with `model` as the tools report it.
- Host validation: `MCP_ALLOWED_HOSTS`, a comma-separated list, turns on the SDK's DNS
  rebinding protection with those hostnames. Unset, no validation, for local runs.

The port is `PORT` or the flag, which is what Cloud Run sets.

## 8. Tests

`npm test` runs `node --test test/`. `npm run fixtures` fetches `companygraph/meta-model` at
the tag `package.json` pins into `test/fixtures/meta-model/` and `robertblust/mental-model` at
a named commit into `test/fixtures/mental-model/`, and is the pretest step; the folder is
gitignored because the package does not ship its example and an instance is content, not a
dependency. CI has the network.

- **Snapshot:** built from `example/model` against `core/`, carries the core version from the
  manifest, every entity has `markdown`, and the entity and edge counts equal what the parser
  returns on its own.
- **Every tool against the example:** `list_types` names every schema; `describe_schema` on
  each; `list_entities` on each type; `get_entity` on one entity of each type, with references
  both ways; `find_evidence` on a skill two profiles claim, with the columns verbatim; `search`
  for a word in a tagline and a word in a table cell; `fetch` by id.
- **Refusals, on an in-memory fixture:** an identity and a profile sharing a name make
  `fetch(name)` refuse and name both types; `get_entity("skill", <a value's name>)` is the R4
  error; an unknown type names the declared types.
- **The reference instance, real values:** the fixtures also hold `robertblust/mental-model`
  at one commit named in the test helper, and a suite runs the queries and the server against
  it: the counts its site publishes, the identity and profile that share one name and the
  refusal that pair earns, the Expert skills and one Evidence cell verbatim, an experience by
  search and by name, the values. A change to those values is a change to the fixture commit.
- **Portability:** a test greps `lib/` and `bin/` for the names of the example's and the
  instance's entities and for the instance's domain and repository, and fails on a hit.
- **Transports:** the HTTP handler answers `initialize` and `tools/list` with a JSON body, no
  session header, `Cache-Control: no-store`; a request with a Host outside
  `MCP_ALLOWED_HOSTS` is refused; `GET /mcp` is `405`. The stdio binary answers `tools/list`
  with seven tools.

## 9. Family membership

The repository takes the conventions recipe from its first commit: `AGENTS.md`, the
`CLAUDE.md` adapter, `conventions.json` at the current tag, the `conventions / conventions`
workflow, a `protect-main` ruleset requiring it beside the test job, README title
"CompanyGraph — MCP Server". Its row in `REPOSITORIES.md` is a pull request to
`robertblust/conventions`. Commits and pull request bodies are prose ending `Verified: …`.
Releases are tags `v<version>` on `main`, the version in `package.json` moving with them.

## 10. Out of scope

Write tools, authentication, sessions, SSE, resources and prompts, any commit to
`companygraph/meta-model` or `robertblust/mental-model`, and the deployment, which is
`robertblust/mcp-blust-ch`. One proposal for meta-model, recorded rather than made: shipping
`example/` in the package's `files` would let this suite run without a fetch.
