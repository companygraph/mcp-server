# CompanyGraph — MCP Server

A read-only MCP server for any CompanyGraph instance. An agent connects to it and asks about the company the way a person would read the model: which types it declares, what one entity says, what evidence a profile gives for a skill. Every answer is what the model says at one commit, verbatim, and the server adds nothing of its own.

It serves a snapshot parsed at build time with the meta-model's own parser, so a new type in core appears here with no change to this package, and it knows no instance-specific type, name or fact. The reference instance runs it at `mcp.blust.ch`; the deployment is `robertblust/mcp-blust-ch`.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_types` | every type the schemas declare |
| `describe_schema` | one type's schema and its relations |
| `describe_relations` | what the schemas declare between types, whole or narrowed |
| `list_rules`, `describe_rule` | the rules the model is held to, and one as written |
| `list_checks` | the checks the model's gate runs; a list, not a verdict |
| `describe_errors` | what a refused call looks like: every code and the refusal's JSON Schema |
| `list_entities` | the entities of one type, paged |
| `get_entity` | one entity as structured data, by id or by type and name |
| `list_references` | the model's edges, filtered and paged |
| `find_evidence` | everything the model says about one skill, paged |
| `search` | entities by words, or by exact name |
| `fetch` | one entity's page as written, by id |

[`docs/INTERFACE.md`](docs/INTERFACE.md) is the contract: every tool's arguments and answer with a real response, the codes of every refusal, how a list is paged, and what counts as a break. Every answer carries the model commit, the core version and the parser's tag. A name resolves within a type, and a name of an owned type within its owner, so two owners may each hold one name; a lookup that meets two refuses with every candidate's id, and an id reaches each.

## Running it

From an instance's root, over stdio:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core
```

An entity cites its file on GitHub when `--repo owner/name` says which repository the directories belong to, and a schema and a rule cite theirs when `--core meta/core/` also says where the core sits in it; the snapshot command takes the same two, and from `--github` it knows both already.

A snapshot for a deployment, then the HTTP server on it:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp-snapshot --github owner/name@<sha> --out snapshot.json
npx --package github:companygraph/mcp-server companygraph-mcp-http --snapshot snapshot.json
```

The HTTP server is stateless Streamable HTTP with JSON responses on `POST /mcp`, `no-store`, and a `/health`. `GET /` is a page for whoever types the host into a browser: the model's own taglines, the endpoint at the address the request arrived under, every tool with what it returns, and the commit the snapshot was built from. It is rendered from the snapshot, so it says nothing this package knows about any particular instance and cannot fall out of step with what the tools answer. `--page-css file` hands the whole stylesheet to a deployment that has a design of its own, `--page-jsonld file` a structured-data block for the head, `--robots file` the rule served at `/robots.txt`, and `--page-icon file` its mark, an `.svg`, `.png` or `.ico` inlined as a data URI so the page stays one response; unset, the page carries the plain stylesheet this package ships and no icon at all, because a mark belongs to whoever deploys. Unset likewise, the page describes itself to a crawler with its ordinary tags and nothing more, and `/robots.txt` is a 404: what a crawler may read and what a subject claims to be are publishing decisions, and schema.org's vocabulary is not this package's to choose on anyone's behalf. A supplied block is parsed before it is served, so a file that is not JSON fails at startup rather than reaching a crawler. What the page guarantees in exchange is its markup — `main.shell` around the whole page, `.title` with `.r70` and `.rcl`, `.tagline`, `header > .bar > a.brand` linking the identity's own `url`, `.note` around what the model says about itself, `.lede` on the prose, and `ul.ops` of `li > .head` rows carrying `.m`, `.p` and `.s` for the paths and again, as `ul.ops.tools`, for the tools, and `.mono` on anything set in the monospace face — and changing one of those names breaks whoever styled it. `PORT` and `MCP_ALLOWED_HOSTS` come from the environment.

A host in front of the service should send every path here rather than only `/mcp`, so that `/` and `/health` are reachable and an unknown path gets this server's own 404.

The page and the sheet it ships with are held to each other by `test/page-contract.test.mjs` — every class the markup emits has a rule, every rule names a class the markup emits, and the list above says both. `test/page-render.test.mjs` opens the page in a browser and measures it, because a rule that is present and wrong is invisible to the other one: the sheet parses, the class is styled, and the page still scrolls sideways. Those two are why `playwright` is a development dependency, and the workflow installs chromium for them.

## Tests

`npm test` fetches `companygraph/meta-model` at the tag `package.json` pins and `robertblust/mental-model` at a named commit into `test/fixtures/`, and runs every tool against the worked example and the reference instance. `test/contract.test.mjs` holds every tool's answer, every refusal and every page to the schema the tool declares, and `test/interface.test.mjs` holds the document's examples to what the server answers; `npm run interface` rewrites them.

## Deployment

Every deployment needs the same infrastructure and the same build steps, so `deploy/` ships them once, in this package's own release, rather than let each deployment carry a copy that drifts from the others. Two Terraform modules do the infrastructure: `deploy/terraform` for the running service — its Cloud Run instance, Firebase site, custom domain, budget and enabled APIs — and `deploy/bootstrap` for what a deployment's own CI needs before it can authenticate, applied once, locally, by the deployment's owner. One command, `companygraph-mcp-deploy`, does the build, with a subcommand for the snapshot, the page's CSS, its JSON-LD, the registry entry and the image tag, and `serve`, the image's own start command, so a deployment's own values reach it from its `deployment.json` rather than from a constant copied into a script. `registerDeploymentTests()` holds the shared tests, run by each deployment over its own snapshot and its own page, and two reusable workflows, `deployment.yml` and `registry.yml`, are called by tag with `secrets: inherit` rather than copied in.

What a deployment keeps of its own is small, because everything shared moved into the package it pins: `source.json` for its model pin, `package.json` for its server pin, `deployment.json` for the values that are only this deployment's — project, region, domain, budget and the rest — `brand.html` for the page's own wordmark, `own.css` for the page's own layout, a Terraform root of one file holding its state bucket and the one call into the module, two workflow files that only call the shared ones, and its own tests. A deployment also carries `@robertblust/design`, `playwright` and `@modelcontextprotocol/client` itself, because the page CSS and the shared tests use them and this package depends on none of the three. `mcp.blust.ch` is the first deployment to move onto it.

A deployment names the release in three places: `package.json`, the `@v…` each of its workflows calls by, and the `?ref=v…` its module source names. A shared test holds the three to one, so a deployment that moved one place alone fails it rather than building with one release's code and applying with another's infrastructure. See the [design spec](docs/superpowers/specs/2026-09-21-shared-deployment-design.md) for why the shared half lives here rather than in a second repository, and [`deploy/bootstrap/README.md`](deploy/bootstrap/README.md) for what a new deployment's owner applies once.

## License

Apache 2.0. See `LICENSE`.
