# A deployment is a thin repository over the server — design

> mcp.blust.ch is the one deployment of this server, and everything that runs it — the Terraform
> that makes the service, the workflow that builds and applies, the scripts that write its
> snapshot and its page — lives in that deployment's repository. A second deployment would
> copy all of it and change a handful of values, and from then on two copies drift. The shared
> half moves into this package and ships with its release; a deployment keeps its pins, its
> brand and the values that are its own. mcp.blust.ch moves first and is proved unchanged,
> then mcp.companygraph.io is built on the same parts.

Status: proposed. Decided on 2026-09-21 against this repository at `9c6a6f5` (v0.16.0) and against `robertblust/mcp-blust-ch` at `516d421`, whose files were read that day and are the source of every fact below about what a deployment holds.

---

## 1. The gap

A deployment of this server is about five hundred lines: a Terraform root of five files, a bootstrap root applied once by its owner, two workflows, five build scripts, a Dockerfile, a page and its tests. Read line by line, almost none of it is about the deployment. The values that are its own are few and nameable: the Google Cloud project and its number, the billing account, the region, the host and the Firebase site id, the budget's label, the state bucket, the Workload Identity provider and the two identities named after the project, the Registry name and the domain it authenticates by DNS, and one Cloud Run host copied by hand after the first apply.

A second deployment is now asked for: mcp.companygraph.io, serving `companygraph/mental-model` as mcp.blust.ch serves `robertblust/mental-model`. Copying the repository would work on the day it is copied. It fails the day either copy learns something — a header the other lacks, a lesson about `cpu_idle` recorded once — and nothing would notice, because two copies of one file are two files. **What is the same in every deployment lives here, released with the server; what is one deployment's own lives in its repository.**

## 2. What this package ships under `deploy/`

The server is already the one thing every deployment pins by tag, so the shared half ships in its release and one tag names both what answers and what runs it. A second repository for the shared half was considered and set aside: every deployment would pin two releases that must agree, and a new repository is one more to release.

**A Terraform module**, `deploy/terraform/`, holding the main root's resources as they stand in mcp-blust-ch: the enabled APIs, the runtime identity holding no role, the Cloud Run service with its scaling, `cpu_idle` and `MCP_ALLOWED_HOSTS`, public invocation, the Firebase project, site, version, release and custom domain with every path rewritten to the service and `Cache-Control: no-store`, the monthly budget with its three thresholds, the `run_host` check, and the outputs. Its inputs are `project`, `project_number`, `billing_account`, `region`, `domain`, `site_id`, `budget_chf`, `run_host` and `image`. The budget's label is derived from the domain, so mcp.blust.ch's reads as it does today.

**A bootstrap module**, `deploy/bootstrap/`, holding what CI needs before it can authenticate: the APIs it needs, the state bucket, the Workload Identity pool and provider bound to one repository, the `terraform` and `deploy` identities with their roles — among them the billing-account role the budget needs, which only a billing administrator can grant and so is granted here — the Artifact Registry repository, and the project-level override of domain-restricted sharing that lets `allUsers` invoke the service. Its inputs are `project`, `billing_account`, `region` and `repository`. It is applied once, locally, by the owner of the new deployment.

**Two reusable workflows.** `deploy.yml`, called with `workflow_call`, runs what mcp-blust-ch's does: install, snapshot, page CSS, JSON-LD, the browser the page checks need, the tests, the image and its push on `main`, then Terraform — format, validate, a plan posted to the pull request, and on `main` the apply and a live `list_types` over `/mcp` whose commit must be the pin. Its inputs are the project, its number, the region and the domain; the identities and the registry path are derived from the project, since the bootstrap names them so. `publish.yml` publishes to the MCP Registry, only on a tag and only after the `registry` environment is approved, and takes the Registry domain as its input.

**The build, as package commands**: the snapshot, `server.json`, the page's CSS, the JSON-LD and the image tag, each today a script in mcp-blust-ch's `build/`. A deployment's own values reach them from its `deployment.json`, never from a constant in the package.

**The generic tests**: that the installed server is the release `package.json` pins and the parser the one that server pins, that the snapshot is the pinned commit of the pinned repository, that every type describes and lists and every tool answers carrying the commit, that `server.json` fits the Registry and refuses a description over its limit, and that the page sits in the family's shell. Each deployment runs them over its own snapshot and its own page.

## 3. What a deployment keeps

`source.json`, the model pin. `package.json`, the server pin. `deployment.json`, the values of §1 that are this deployment's: project and number, billing account, region, domain, site id, Registry name and domain, budget. `brand.html`, the page's own wordmark. A Terraform root of one file holding its state bucket, its providers, the one module call and, for mcp.blust.ch alone, the `moved` blocks of §5. Two workflow files that only call the shared ones. The tests that only it can run. Its README, where its owner's steps are written with their exact commands.

## 4. One release, named three times

A deployment names the server's release in three places: `package.json`, the `@v…` of each workflow it calls, and the `?ref=v…` of its module source. The three are one fact written three times, and a deployment that moved one would build with one release's code and apply with another's infrastructure. The pin test, which already holds the installed server to `package.json`, also holds the two workflow refs and the module ref to it and fails naming whichever disagrees. It is the instances' three-place pin, held by a test this time instead of by memory.

## 5. mcp.blust.ch moves first, and nothing changes

It moves first because it is the deployment the parts are extracted from, and the proof that the extraction is faithful is that it changes nothing there.

Its Terraform root keeps its backend and its state and gains one `moved` block per resource, from its address in the root to the same resource inside the module. Terraform then reads the move as a rename of the address, not the destruction of one resource and the creation of another. A plan cannot read zero changes on any pull request, because the image tag carries the repository's own commit and every build plans the service's image anew; that one change is the deploy, and it is expected. **The pull request's own plan must read `0 to add, 1 to change, 0 to destroy` beside the moves, the one change must be the Cloud Run service, and inside it only `image` may differ — and it does not merge otherwise.** Anything else the move got wrong shows there as a second change or as a destruction. The plan is posted to the pull request as it is today, so the proof is on the page a reviewer reads.

After the deploy, its live answers are compared with the answers recorded before the move: `list_types`, `describe_schema` for a type with an enum, `get_entity` for one entity, and the page's HTML and JSON-LD. The model commit, the core, the parser tag and every answer's content must be the same.

**Its bootstrap does not move.** It was applied once, it has not changed since, and its state is a file that exists only in its owner's local clone. It holds the credentials CI deploys with, and a move there applied wrong would lock the deployment out of its own pipeline. It stays as it is, and the bootstrap module is exercised by the second deployment. Its owner is advised to keep a second copy of that state file, which is outside this design.

## 6. The Cloud Run host stays an input

`MCP_ALLOWED_HOSTS` must name the service's own run.app host, and Cloud Run gave mcp.blust.ch the hashed form of its URL rather than the deterministic one, so the host is not knowable before the service exists. It cannot be read from the service's own `uri` either: that value is inside the resource whose environment needs it, and Terraform refuses the cycle. So `run_host` stays an input, held by the check that names the real host when it disagrees.

For a new deployment this makes the first apply two applies. A failing `check` warns rather than stops an apply, so the first runs with `run_host` empty, creates the service, and its warning names the host the service was given; the deploy then fails where it should, at the live `list_types`, because the server refuses a host it was not told. That host is written into `deployment.json`, and the second deploy passes both. This is what happened to mcp.blust.ch by hand; here it is a written step.

## 7. The page's subject is read from the model

The JSON-LD describes the subject the model is about, and which kind of thing that is follows from the model rather than from a setting. Where a profile carries the identity's own name — a company of one, whose company and person are one name — the subject is a `Person` with the profile's addresses, as mcp.blust.ch's is today. Otherwise it is an `Organization`, named by the identity, with the addresses from its `## Also at`. The `WebAPI` it provides is the endpoint in both.

The surface that says where the page is published is found as it is now, by its `built-by` naming the deployment's repository. Where the model names no such surface, the JSON-LD step writes none and says why, rather than failing the build or guessing a host. That is the state of a deployment before it is reachable, which §8 relies on.

## 8. mcp.companygraph.io

**Names.** Repository `companygraph/mcp-companygraph-io`, public, merge commits only, no wiki. Google Cloud project `companygraph-io-mcp` under the flatland.ch organization, on the billing account mcp.blust.ch uses. Firebase site `mcp-companygraph-io`. Host `mcp.companygraph.io`. Registry name `io.companygraph/mental-model`, authenticated by DNS on `companygraph.io`, with the description `CompanyGraph: Written once, read by both`, the identity and the vision joined by a colon as mcp.blust.ch's is.

**Budget.** CHF 10 a month, warning at 50, 90 and 100 percent, to whoever administers the billing account.

**Pins.** The server at the release that ships §2, and `companygraph/mental-model` at its `main` on the day it is built.

**The owner's steps**, each written in the repository's README with its exact command, in this order:

1. Create the project and link the billing account.
2. Enable `cloudbilling.googleapis.com` on the project by hand, once: the bootstrap's own read of the billing account needs it before Terraform can enable anything.
3. Apply the bootstrap locally, which needs Terraform installed. It grants `terraform` the billing-account role itself, since the owner applying it is the billing administrator.
4. Merge the repository's first pull request. Its first deploy fails at the live check, and the `run_host` warning names the service's host; write that host into `deployment.json` and merge again (§6).
5. At Hostpoint, set the records Terraform outputs for `mcp` — replacing the default record the name resolves to today — and publish the Registry's TXT record at the apex of `companygraph.io`.
6. Generate the Registry's Ed25519 key with OpenSSL 3 and store it as the `MCP_PRIVATE_KEY` secret of the `registry` environment.
7. Approve the `registry` run when the first publish is ready.

The protect-main ruleset requires `conventions / conventions` from the start and `build` once it has reported on `main`, as mcp-blust-ch's does.

**The order after it answers.** The first deploy serves the model with a page that carries no JSON-LD, because the model names no surface for it yet (§7). Once `list_types` answers over `/mcp`, `companygraph/mental-model` gains `model/surfaces/mcp-companygraph-io-mcp-server.md` with `production: built` and `built-by` naming the deployment's repository. The deployment re-pins to that commit and redeploys, and the page gains the `Organization`. The model says a surface exists only once anyone can reach it, at every commit.

**Family.** A row in `conventions/REPOSITORIES.md` and its paragraph on what pins what, and the deployment's node and edges on the organization profile's diagram, follow the go-live.

## 9. Verification

Every pull request in both deployments runs the shared workflow: the build, every test including the three-place pin test, and a Terraform plan posted to the pull request. Every merge to `main` applies and then asks the live service for `list_types`, whose commit must be the pin. mcp.blust.ch's move adds §5's two proofs: the plan whose one change is the image before it merges, and the live comparison after it deploys. mcp.companygraph.io adds `describe_schema` for `concept` over `/mcp`, whose enums and whose `model.repo`, `companygraph/mental-model`, say that the answer is this instance's.

## 10. Not done here

mcp.blust.ch's bootstrap, which stays a copy of its own (§5). Anything the server answers: no tool, no answer and no snapshot field changes. The page's design, which stays the family's shell with each deployment's wordmark. A third deployment, which this makes a matter of one thin repository and its owner's steps, and which nothing here plans.
