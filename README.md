# CompanyGraph — MCP Server

A read-only MCP server for any CompanyGraph instance. An agent connects to it and asks about
the company the way a person would read the model: which types it declares, what one entity
says, what evidence a profile gives for a skill. Every answer is what the model says at one
commit, verbatim, and the server adds nothing of its own.

It serves a snapshot parsed at build time with the meta-model's own parser, so a new type in
core appears here with no change to this package, and it knows no instance-specific type, name
or fact. The reference instance runs it at `mcp.blust.ch`; the deployment is
`robertblust/mcp-blust-ch`.

## Tools

| Tool | Returns |
| --- | --- |
| `list_types` | every type the instance's schemas declare, with its tagline |
| `describe_schema(type)` | the schema's frontmatter, sections, purpose and writing rules |
| `list_entities(type)` | the canonical names and taglines of one type |
| `get_entity(type, name)` | one entity with every reference it makes and receives |
| `find_evidence(skill)` | each profile's claimed level and Evidence for the skill, and every experience that lists it |
| `search(query)` | matching entities across types |
| `fetch(id)` | one entity by the id `search` returned, with its page as written |

A name resolves within a type. A lookup without a type that finds a name under more than one
type refuses and names the types. Every answer carries the model commit, the core version and
the parser's tag.

## Running it

From an instance's root, over stdio:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core
```

A snapshot for a deployment, then the HTTP server on it:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp-snapshot --github owner/name@<sha> --out snapshot.json
npx --package github:companygraph/mcp-server companygraph-mcp-http --snapshot snapshot.json
```

The HTTP server is stateless Streamable HTTP with JSON responses on `POST /mcp`, `no-store`,
and a `/health`. `PORT` and `MCP_ALLOWED_HOSTS` come from the environment.

## Tests

`npm test` fetches `companygraph/meta-model` at the tag `package.json` pins and
`robertblust/mental-model` at a named commit into `test/fixtures/`, and runs every tool against
the worked example and the reference instance.

## License

Apache 2.0. See `LICENSE`.
