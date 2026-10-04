# CompanyGraph — MCP Server

A read-only MCP server for any CompanyGraph instance. An agent connects to it and asks about the company the way a person would read the model: which types it declares, what one entity says, what evidence a profile gives for a skill. Every answer is what the model says at one commit, verbatim, and the server adds nothing of its own.

It serves a snapshot parsed at build time with the meta-model's own parser, so a new type in core appears here with no change to this package, and it knows no instance-specific type, name or fact. The reference instance runs it at `mcp.blust.ch`; the deployment is `robertblust/mcp-blust-ch`.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_types` | every type the schemas declare |
| `describe_schema` | one type's schema and its relations |
| `describe_relations` | what the schemas declare between types, whole or narrowed |
| `list_rules`, `describe_rule` | the vocabulary's conventions the model is held to, and one as written |
| `list_checks` | the checks the model's gate runs; a list, not a verdict |
| `describe_errors` | what a refused call looks like: every code and the refusal's JSON Schema |
| `list_entities` | the entities of one type or of every type, by address or by when they came into the model, paged |
| `get_entity` | one entity as structured data, by id or by type and name |
| `list_references` | the model's edges, filtered and paged |
| `find_evidence` | everything the model says about one skill, paged |
| `search` | entities by stem, by substring or by exact name |
| `fetch` | one entity's page as written, by id |
| `diagram` | part of the model as Mermaid: the concepts, a process, one entity's neighborhood, the schemas, a bounded context's map, or its aggregates |

[`docs/INTERFACE.md`](docs/INTERFACE.md) is the contract: every tool's arguments and answer with a real response, the codes of every refusal, how a list is paged, and what counts as a break. Every answer carries the model commit, the core version and the parser's tag. A name resolves within a type, and a name of an owned type within its owner, so two owners may each hold one name; a lookup that meets two refuses with every candidate's id, and an id reaches each.

The process picture is also a function a site can call at build time: `processDiagram(model, id)` from `companygraph-mcp-server/diagram` draws it from the parser's entities and edges alone, such as a site's `model.json`, so a page shows the chat's own picture at the commit the site pins.

## Running it

From an instance's root, over stdio:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core
```

An entity cites its file on GitHub when `--repo owner/name` says which repository the directories belong to, and a schema and a rule cite theirs when `--core meta/core/` also says where the core sits in it; the snapshot command takes the same two, and from `--github` it knows both already. The packs the instance takes are read beside the core with no argument of their own: from `.companygraph/manifest.json` at the commit `--github` names, and locally from the manifest of the instance whose `<units>/core/` the core directory is.

A snapshot for a deployment, then the HTTP server on it:

```sh
npx --package github:companygraph/mcp-server companygraph-mcp-snapshot --github owner/name@<sha> --out snapshot.json
npx --package github:companygraph/mcp-server companygraph-mcp-http --snapshot snapshot.json
```

The HTTP server is stateless Streamable HTTP with JSON responses on `POST /mcp`, `no-store`, and a `/health`. `GET /` is a page for whoever types the host into a browser: the model's own taglines, the endpoint at the address the request arrived under, every tool with what it returns, the commit the snapshot was built from and the release of this package that is serving it, read from the same `package.json` the handshake reads. It is rendered from the snapshot, so it says nothing this package knows about any particular instance and cannot fall out of step with what the tools answer. `/health` answers `ok`, the same provenance under `model` and the same release under `server`, so a person with `curl` and no client can check a deployment's release against its pin in one line. `--page-css file` hands the whole stylesheet to a deployment that has a design of its own, `--page-jsonld file` a structured-data block for the head, `--robots file` the rule served at `/robots.txt`, and `--page-icon file` its mark, an `.svg`, `.png` or `.ico` inlined as a data URI so the page stays one response; unset, the page carries the plain stylesheet this package ships and no icon at all, because a mark belongs to whoever deploys. Unset likewise, the page describes itself to a crawler with its ordinary tags and nothing more, and `/robots.txt` is a 404: what a crawler may read and what a subject claims to be are publishing decisions, and schema.org's vocabulary is not this package's to choose on anyone's behalf. A supplied block is parsed before it is served, so a file that is not JSON fails at startup rather than reaching a crawler. What the page guarantees in exchange is its markup — `main.shell` around the page, `.title` with `.r70` and `.rcl`, `.tagline`, `.shell > header > .bar > a.brand` linking the identity's own `url`, in a shell of its own ahead of `main` so a design can keep the row on screen, `.note` around what the model says about itself, `.lede` on the prose, and `ul.ops` of `li > .head` rows carrying `.m`, `.p` and `.s` for the paths and again, as `ul.ops.tools`, for the tools, and `.mono` on anything set in the monospace face — and changing one of those names breaks whoever styled it. `PORT` and `MCP_ALLOWED_HOSTS` come from the environment. A request to `/mcp` whose `Host` is outside that list is refused with a 403, and so is one whose `Origin` is: a client outside a browser sends no `Origin` and passes, a page on one of the listed hosts passes, and any other page, `null` included, is refused. Unset, neither header is checked, which is the local case.

A host in front of the service should send every path here rather than only `/mcp`, so that `/` and `/health` are reachable and an unknown path gets this server's own 404.

The page and the sheet it ships with are held to each other by `test/page-contract.test.mjs` — every class the markup emits has a rule, every rule names a class the markup emits, and the list above says both. `test/page-render.test.mjs` opens the page in a browser and measures it, because a rule that is present and wrong is invisible to the other one: the sheet parses, the class is styled, and the page still scrolls sideways. Those two are why `playwright` is a development dependency, and the workflow installs chromium for them.

## Tests

`npm test` fetches `companygraph/meta-model` at the tag `package.json` pins and `robertblust/mental-model` at a named commit into `test/fixtures/`, and runs every tool against the worked example and the reference instance. `test/contract.test.mjs` holds every tool's answer, every refusal and every page to the schema the tool declares, and `test/interface.test.mjs` holds the document's examples to what the server answers; `npm run interface` rewrites them.

## Deployment

Every deployment needs the same infrastructure and the same build steps, so `deploy/` ships them once, in this package's own release, rather than let each deployment carry a copy that drifts from the others. Two Terraform modules do the infrastructure: `deploy/google/terraform` for the running service — its Cloud Run instance, Firebase site, custom domain, budget and enabled APIs — and `deploy/google/bootstrap` for what a deployment's own CI needs before it can authenticate, applied once, locally, by the deployment's owner. One command, `companygraph-mcp-deploy`, does the build, with a subcommand for the snapshot, the page's CSS, its JSON-LD, the registry entry and the image tag, and `serve`, the image's own start command, so a deployment's own values reach it from its `deployment.json` rather than from a constant copied into a script. `registerDeploymentTests()` holds the shared tests, run by each deployment over its own snapshot and its own page, and two reusable workflows, `deploy-google.yml` and `registry.yml`, are called by tag with `secrets: inherit` rather than copied in. Azure beside Google is designed in chat-server's [The servers run on two clouds](https://github.com/companygraph/chat-server/blob/main/docs/superpowers/specs/2026-09-28-the-servers-run-on-two-clouds-design.md); this package's part so far is the Google folder's name.

What a deployment keeps of its own is small, because everything shared moved into the package it pins: `source.json` for its model pin, `package.json` for its server pin, `deployment.json` for the values that are only this deployment's — project, region, domain, budget and the rest — `brand.html` for the page's own wordmark, `own.css` for the page's own layout, a Terraform root of one file holding its state bucket and the one call into the module, two workflow files that only call the shared ones, and its own tests. A deployment also carries `@robertblust/design`, `playwright` and `@modelcontextprotocol/client` itself, because the page CSS and the shared tests use them and this package depends on none of the three. The page CSS inlines the design package's faces and writes each family's license text as a comment ahead of them, so a deployment pins `@robertblust/design` v0.83.0 or later, the first release that ships those texts, and the build refuses an older one rather than serve the faces without their notice. `mcp.blust.ch` is the first deployment to move onto it.

A deployment names the release in three places: `package.json`, the `@v…` each of its workflows calls by, and the `?ref=v…` its module source names. A shared test holds the three to one, so a deployment that moved one place alone fails it rather than building with one release's code and applying with another's infrastructure. Another holds the page and the health body the deployment's own server answers to the same tag, so a deployment whose image ran an older package than every visible pin names is visible to anyone who opens its page. See the [design spec](docs/superpowers/specs/2026-09-21-shared-deployment-design.md) for why the shared half lives here rather than in a second repository, and [`deploy/google/bootstrap/README.md`](deploy/google/bootstrap/README.md) for what a new deployment's owner applies once.

An organization's KPI values are kept by its MCP host too, since the host's project, identity pool and Terraform are already there. `deploy/google/kpi` makes the bucket `kpi-reports-<project>`, private, versioned and with no deletion rule, and the account `kpi-reporter`, which may write to that bucket alone and which only the host repository's runs on `main` can act as. The reusable workflow `kpi-google.yml`, called by tag from the host's own schedule, exchanges the organization's GitHub App key (the variable `KPI_APP_ID` and the secret `KPI_APP_PRIVATE_KEY`, which the host passes by name, since `secrets: inherit` does not cross organizations) for a token, runs `bin/bypasses.mjs` from the release the host's `package.json` pins, and writes the week's Merges Past Their Checks object to `ruleset-bypasses/<ISO week>.json`. Each bypass on a default branch is classified from its pull request: behind main when every required check of the branch's rules had succeeded before the merge and the branch lacked commits main had, past its checks otherwise, including a change with no pull request, a bypassed rule other than required status checks, and a bypass whose pull request, check runs or comparison cannot be read. The object keeps `bypasses`, `past_checks` and `behind_main`, in total and per repository, and the KPI counts `past_checks`; the App needs Administration, Checks, Contents and Pull requests read. A repository the App cannot read is listed as unread and counted in no total, and the log carries counts and full names (org/repo) only.

A deployment on Azure names `"platform": "azure"` in `deployment.json` with its tenant, subscription, resource group, location, `container_registry`, `state_account`, `budget_start`, the repository's `repository_id` and `owner_id`, and the bootstrap's three client ids; `registry_name` keeps meaning the MCP Registry's name, and the deployment's own suite checks the file against its platform. Its `infra/main.tf` calls `deploy/azure/terraform` and its `infra/bootstrap/main.tf` calls `deploy/azure/bootstrap`, whose [README](deploy/azure/bootstrap/README.md) gives the owner's once-only steps, and its workflow calls `.github/workflows/deploy-azure.yml`, all at the pinned tag; the three places are held to one by the same pin test. The first apply makes the app and prints the domain's two records; once they are set, `deployment.json` gains `app_host` and `dns_ready: true`, and the second apply adds the domain with a free certificate. The environment the chat's module joins is this module's, named `apps`, and so is the thirty-day workspace `logs`.

## License

Apache 2.0. See `LICENSE`.
