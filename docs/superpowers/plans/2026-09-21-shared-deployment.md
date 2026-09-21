# Shared deployment implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship what every deployment of this server shares — a Terraform module, a bootstrap module, reusable workflows, the build as package commands and the generic tests — in `companygraph/mcp-server` v0.17.0; move mcp.blust.ch onto it with nothing changing; then build mcp.companygraph.io on it.

**Architecture:** The shared half lives under `deploy/` in this package and is pinned by the same tag a deployment already names for the server. A deployment keeps `source.json`, `package.json`, a `deployment.json` of its own values, its brand, a one-file Terraform root and two workflow files that only call the shared ones. `deployment.json` is the single source of a deployment's values: Terraform reads it with `jsondecode(file(…))`, the workflows with `jq`, the build commands with `JSON.parse`.

**Tech Stack:** Node 22, `node:test`, Playwright (Chromium), Terraform 1.9.8 with the `google` and `google-beta` providers (`>= 6.0, < 8.0`), GitHub Actions with Workload Identity Federation, Google Cloud Run, Firebase Hosting, the MCP Registry.

**Spec:** `docs/superpowers/specs/2026-09-21-shared-deployment-design.md` (this repository, commit `f0f4158`). Read it before any task.

## Global constraints

- **Three repositories, in this order:** `companygraph/mcp-server` (Part A), `robertblust/mcp-blust-ch` (Part B), `companygraph/mcp-companygraph-io` (Part C, created in Task 10). Part B starts only after v0.17.0 is tagged; Part C only after Part B's proof in Task 9 passes.
- **Every branch in a sibling worktree** named `<repo>-<branch>`; the clone stays on `main`. Part A's worktree exists: `~/git/companygraph/mcp-server-shared-deployment`, branch `shared-deployment`, carrying the spec.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `gh`, `gcloud` or `terraform` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **Commit messages** in the git register: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line, then `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Pull request bodies the same, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Merge with a merge commit** (`gh pr merge --merge`), only when every required check is green, and never chain a branch delete after it.
- **The owner does every owner step** (Task 11): creating the project, billing, the bootstrap apply, DNS at Hostpoint, the Registry key, approving a publish. No agent runs `gcloud projects create`, `terraform apply` locally, or touches `MCP_PRIVATE_KEY`.
- **mcp.blust.ch's `infra/bootstrap/` is never modified**, and its `terraform.tfstate` — the only copy, gitignored — is never read, moved or written.
- **Never stop a process by name or pattern.** A local server is started on a free port and stopped by its own PID.
- **No count or version of something that still moves** in any prose; the prose rules of `conventions/WRITING.md` hold for every Markdown file.

### Rulings the plan makes where the spec is silent

1. **The page CSS command resolves `@robertblust/design` from the deployment.** It ships in this package, but the design package stays the deployment's own devDependency; Node's resolution walks up from `node_modules/companygraph-mcp-server/` to the deployment's `node_modules/`, so this package gains no dependency on the family's design. Each deployment keeps its own `own.css` beside `brand.html`.
2. **Build outputs go to `dist/`.** A deployment whose model names no surface yet writes no `dist/jsonld.json` (spec §7), and a Dockerfile cannot `COPY` a file that may not exist, so the image copies the directory and the start command adds `--page-jsonld` only when the file is there.
3. **One command, `companygraph-mcp-deploy`,** with subcommands `snapshot`, `page-css`, `jsonld`, `server-json <version>`, `tag` and `serve`. It reads `source.json` and `deployment.json` from the working directory and writes into `dist/`.
4. **The workflows take no inputs.** The reusable workflows read the calling repository's `deployment.json`, so a caller is a `uses:` line and `secrets: inherit`.
5. **A shared test that cannot derive its arguments from this instance skips by name.** `find_evidence` needs a skill; an instance with none skips that call with the reason printed, never silently.

---

## Part A — `companygraph/mcp-server`

### Task 1: The Terraform module

**Files:**

- Create: `deploy/terraform/main.tf`, `deploy/terraform/run.tf`, `deploy/terraform/hosting.tf`, `deploy/terraform/budget.tf`, `deploy/terraform/outputs.tf`, `deploy/terraform/variables.tf`
- Modify: `.github/workflows/test.yml` (a `terraform` job)

**Interfaces:**

- Produces: module inputs `project`, `project_number`, `billing_account`, `region`, `domain`, `site_id`, `budget_chf`, `run_host`, `image`; outputs `service_url`, `run_host`, `hosting_url`, `dns_records`. Resource addresses inside the module are exactly mcp-blust-ch's root addresses (Task 8's `moved` blocks depend on it): `google_project_service.main`, `google_service_account.run`, `google_cloud_run_v2_service.mcp`, `google_cloud_run_v2_service_iam_member.public`, `google_firebase_project.this`, `google_firebase_hosting_site.this`, `google_firebase_hosting_version.this`, `google_firebase_hosting_release.this`, `google_firebase_hosting_custom_domain.this`, `google_billing_budget.monthly`.

- [ ] **Step 1: Copy the four resource files verbatim** from `robertblust/mcp-blust-ch` at `516d421`: `git -C ~/git/robertblust/mcp-blust-ch show 516d421:infra/run.tf > deploy/terraform/run.tf`, and the same for `hosting.tf`, `budget.tf`, `outputs.tf`.

- [ ] **Step 2: Replace the root's variables with module inputs.** In `run.tf` delete the `variable "run_host"` block (it moves to `variables.tf`). In `budget.tf` change `display_name = "mcp.blust.ch monthly"` to `display_name = "${var.domain} monthly"` and `units = "10"` to `units = tostring(var.budget_chf)`. In `outputs.tf` change the `dns_records` description to `"What the domain needs; create these at the DNS provider of ${var.domain}"`. In `run.tf`, `MCP_ALLOWED_HOSTS`'s value becomes `join(",", compact([var.domain, local.run_host]))`: with both present it is the string mcp.blust.ch runs today, so its plan does not change, and on a new deployment's first apply, where `run_host` is empty, it names the domain alone instead of a trailing empty host. Nothing else in the four files changes.

- [ ] **Step 3: Write `variables.tf`:**

```hcl
# Every value that is one deployment's own. The caller reads them from its deployment.json.
variable "project" { type = string }
variable "project_number" { type = string }
variable "billing_account" { type = string }
variable "region" { type = string }
variable "domain" { type = string }
variable "site_id" { type = string }
variable "budget_chf" { type = number }
variable "image" {
  description = "The image to run, pushed by the same workflow run"
  type        = string
}
# Cloud Run gives a service the hashed form of its URL, which is not knowable before it exists,
# and the service's own environment needs it, so it cannot be read from the service's uri:
# that is a cycle. Empty on a deployment's first apply; the check in run.tf then names it.
variable "run_host" {
  type    = string
  default = ""
}
```

- [ ] **Step 4: Write `main.tf`** — the root's `required_providers` and APIs, without backend, providers or variables:

```hcl
# The resources every deployment of the server runs. The caller holds the backend and the
# providers; this module holds what the service is.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google      = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
    google-beta = { source = "hashicorp/google-beta", version = ">= 6.0, < 8.0" }
  }
}

resource "google_project_service" "main" {
  for_each = toset([
    "run.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "billingbudgets.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}
```

- [ ] **Step 5: Hold it in CI.** Add to `.github/workflows/test.yml`:

```yaml
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.9.8
          terraform_wrapper: false
      - run: terraform -chdir=deploy/terraform init -backend=false -input=false
      - run: terraform -chdir=deploy/terraform validate
      - run: terraform fmt -check -recursive deploy
```

- [ ] **Step 6: Diff against the source.** `diff <(git -C ~/git/robertblust/mcp-blust-ch show 516d421:infra/hosting.tf) deploy/terraform/hosting.tf` prints nothing; the same for `run.tf`, `budget.tf` and `outputs.tf` prints only Step 2's lines. A resource whose arguments differ from the root's is a change in Task 8's plan.

- [ ] **Step 7: Commit.** Subject: `The service a deployment runs is a module`.

### Task 2: The bootstrap module

**Files:**

- Create: `deploy/bootstrap/main.tf`, `deploy/bootstrap/README.md`
- Modify: `.github/workflows/test.yml` (validate it too)

**Interfaces:**

- Produces: module inputs `project`, `region`, `repository`, `billing_account`; outputs `workload_identity_provider`, `terraform_service_account`, `deploy_service_account`, `registry`, `state_bucket`. The service accounts are `terraform@<project>` and `deploy@<project>` and the Artifact Registry repository is `mcp`, because Task 5's workflow derives all three from the project.

- [ ] **Step 1: Copy** `git -C ~/git/robertblust/mcp-blust-ch show 516d421:infra/bootstrap/main.tf > deploy/bootstrap/main.tf`.

- [ ] **Step 2: Make it a module.** Delete the four `variable` blocks' defaults (each becomes `variable "project" { type = string }` and likewise for `region`, `repository`, `billing_account`). Delete the `provider "google"` block: a module that configures its own provider cannot be called flexibly, so the calling root holds it, with the comment that explains `user_project_override` moved beside it (Task 10 writes that root). Everything else is unchanged.

- [ ] **Step 3: Write `deploy/bootstrap/README.md`** — what the module creates, that the owner applies it once with local state, and the root a deployment writes to call it: the `provider "google"` block with `user_project_override = true` and `billing_project`, and one `module "bootstrap"` whose `source` is `git::https://github.com/companygraph/mcp-server.git//deploy/bootstrap?ref=<tag>` and whose inputs come from `jsondecode(file("../../deployment.json"))`. The `repository` input is the deployment repository's `owner/name`.

- [ ] **Step 4: Validate in CI.** Add to the `terraform` job: `terraform -chdir=deploy/bootstrap init -backend=false -input=false` and `terraform -chdir=deploy/bootstrap validate`.

- [ ] **Step 5: Commit.** Subject: `What CI needs before it can authenticate is a module too`.

### Task 3: The build as one command

**Files:**

- Create: `bin/deploy.mjs`, `deploy/build/snapshot.mjs`, `deploy/build/page-css.mjs`, `deploy/build/jsonld.mjs`, `deploy/build/server-json.mjs`, `deploy/build/tag.mjs`, `deploy/build/serve.mjs`, `deploy/build/config.mjs`
- Modify: `package.json` (`bin`, `files`, `exports`)
- Test: `test/deploy-build.test.mjs`

**Interfaces:**

- Consumes: the snapshot helpers in `test/helpers.mjs` (`exampleSnapshot()`, `instanceSnapshot()`).
- Produces: bin `companygraph-mcp-deploy <snapshot|page-css|jsonld|server-json <version>|tag|serve>`, run in a deployment's root; `export function serverJson(snapshot, { name, url }, version)` and `export function jsonld(snapshot, { repository })` from `companygraph-mcp-server/deploy` (the export `./deploy` maps to `deploy/build/index.mjs`, which re-exports both). `jsonld` returns `null` when the model names no surface for the repository, else `{ "@context", "@graph" }`.

- [ ] **Step 1: Write the failing tests** in `test/deploy-build.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonld, serverJson } from "../deploy/build/index.mjs";
import { exampleSnapshot, instanceSnapshot } from "./helpers.mjs";

// The subject is read from the model: a profile carrying the identity's own name is a company
// of one, whose company and person are one name, and the subject is that person.
test("the subject is a Person where a profile shares the identity's name", () => {
  const s = instanceSnapshot();
  const repo = String(s.entities.find((e) => e.type === "surface" && /MCP server/.test(e.name))?.fields["built-by"] ?? "");
  const g = jsonld(s, { repository: repo.split("/").slice(-2).join("/") });
  assert.ok(g, "the reference instance names its MCP surface");
  assert.equal(g["@graph"].find((n) => n["@type"] === "Person")?.name, s.root);
  assert.ok(!g["@graph"].some((n) => n["@type"] === "Organization"));
});

test("the subject is an Organization otherwise, and nothing is written without a surface", () => {
  const s = exampleSnapshot();
  assert.equal(jsonld(s, { repository: "companygraph/mcp-nowhere" }), null, "no surface names this repository");
});

test("an Organization is named by the identity and addressed by its Also at", () => {
  const s = exampleSnapshot();
  // A surface for this repository, added the way a deployment's model would carry one.
  const withSurface = structuredClone(s);
  withSurface.entities.push({ type: "surface", id: "surfaces/mcp-example", name: "Example MCP server", tagline: "An example.",
    fields: { url: "https://mcp.example.test", "built-by": "https://github.com/example/mcp-example", production: "built" }, sections: [] });
  const g = jsonld(withSurface, { repository: "example/mcp-example" });
  const org = g["@graph"].find((n) => n["@type"] === "Organization");
  assert.equal(org.name, s.root);
  assert.equal(org["@id"], "https://mcp.example.test/#organization");
  assert.equal(g["@graph"].find((n) => n["@type"] === "WebAPI").provider["@id"], org["@id"]);
});

test("the registry entry is the deployment's name and host, and refuses a long description", () => {
  const s = instanceSnapshot();
  const j = serverJson(s, { name: "ch.example/model", url: "https://mcp.example.test/mcp" }, "1.2.3");
  assert.equal(j.name, "ch.example/model");
  assert.equal(j.title, s.root);
  assert.deepEqual(j.remotes, [{ type: "streamable-http", url: "https://mcp.example.test/mcp" }]);
  assert.throws(() => serverJson({ ...s, root: "x".repeat(90) }, { name: "a/b", url: "https://x/mcp" }, "1"), /100/);
});
```

- [ ] **Step 2: Run** `npm test` and read that the four new tests fail with a missing module.

- [ ] **Step 3: Write `deploy/build/config.mjs`**, the one reader of a deployment's two files:

```js
// A deployment's own values and its model pin, read from the directory the command runs in.
import fs from "node:fs";
import path from "node:path";
export const ROOT = process.cwd();
export const DIST = path.join(ROOT, "dist");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
export const source = () => read("source.json");
export const deployment = () => read("deployment.json");
export const snapshot = () => JSON.parse(fs.readFileSync(path.join(DIST, "snapshot.json"), "utf8"));
```

- [ ] **Step 4: Move the five scripts** from `robertblust/mcp-blust-ch@516d421:build/` into `deploy/build/`, each changed only where it named mcp.blust.ch or wrote outside `dist/`:
  - `snapshot.mjs`: `--out` is `path.join(DIST, "snapshot.json")`, creating `DIST` first.
  - `tag.mjs`: reads `snapshot()` from `config.mjs`.
  - `server-json.mjs`: `NAME` and `URL_` become the second argument `{ name, url }`, filled by the command from `deployment().registry_name` and `https://${deployment().domain}/mcp`; writes `dist/server.json`.
  - `page-css.mjs`: `own.css` is read from `path.join(ROOT, "own.css")`; the design package is imported as `@robertblust/design/fences` and its fonts resolved with `createRequire(path.join(ROOT, "package.json")).resolve("@robertblust/design/package.json")` — the deployment's copy (Ruling 1); writes `dist/page.css`.
  - `jsonld.mjs`: becomes the pure `jsonld(snapshot, { repository })` below, and the command writes `dist/jsonld.json` when it returns a graph and prints `no surface in the model names <repository>: no JSON-LD written` when it returns `null`.

- [ ] **Step 5: Write `jsonld`** in `deploy/build/jsonld.mjs`, keeping the source's comments on `sameAs` and the host's path:

```js
export function jsonld(snapshot, { repository }) {
  const byId = (id) => snapshot.entities.find((e) => e.id === id);
  const identity = byId(snapshot.rootId);
  if (!identity) throw new Error("the snapshot names no identity");
  const surface = snapshot.entities.find((e) => e.type === "surface"
    && String(e.fields?.["built-by"] ?? "").endsWith(`/${repository}`) && e.name.includes("MCP server"));
  if (!surface) return null;
  if (!surface.fields?.url) throw new Error("the model names no url for this surface");
  const origin = surface.fields.url.replace(/\/$/, "");
  if (new URL(origin).pathname !== "/")
    throw new Error(`the surface's url is ${origin}, which carries a path: this reads it as the host`);
  // A company of one: a profile carrying the identity's own name is the person the company is.
  const profile = snapshot.entities.find((e) => e.type === "profile" && e.name === snapshot.root);
  const holder = profile ?? identity;
  const alsoAt = holder.sections?.find((s) => s.heading === "Also at")?.tables?.[0];
  const home = identity.fields.url?.replace(/\/$/, "");
  const sameAs = (alsoAt?.rows ?? []).map((r) => r[alsoAt.columns.indexOf("URL")])
    .filter((u) => u && !u.startsWith(origin) && u.replace(/\/$/, "") !== home);
  if (!sameAs.length) throw new Error(`the ${profile ? "profile" : "identity"}'s Also at holds no address`);
  const kind = profile ? "Person" : "Organization";
  const subjectId = `${origin}/#${kind.toLowerCase()}`;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": kind, "@id": subjectId, name: identity.name, url: identity.fields.url, sameAs },
    { "@type": "WebAPI", "@id": `${origin}/#api`, name: surface.name, description: surface.tagline,
      url: `${origin}/mcp`, documentation: `${origin}/`, provider: { "@id": subjectId }, about: { "@id": subjectId } },
  ] };
}
```

The Person node's `@id`, keys and `sameAs` are byte for byte what mcp-blust-ch writes today; Task 9 compares them.

- [ ] **Step 6: Write `deploy/build/serve.mjs`**, the image's start command (Ruling 2):

```js
// The image's start: the server over dist/, handing it the JSON-LD only when the build wrote one.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { DIST } from "./config.mjs";
const http = createRequire(import.meta.url).resolve("../../bin/http.mjs");
const f = (n) => path.join(DIST, n);
const args = [http, "--snapshot", f("snapshot.json"), "--page-css", f("page.css"), "--page-icon", "favicon.svg",
  "--page-brand", "brand.html", "--robots", "robots.txt"];
if (fs.existsSync(f("jsonld.json"))) args.push("--page-jsonld", f("jsonld.json"));
spawn(process.execPath, args, { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 1));
```

- [ ] **Step 7: Write `bin/deploy.mjs`** dispatching the six subcommands to their modules, with `usage: companygraph-mcp-deploy <snapshot|page-css|jsonld|server-json <version>|tag|serve>` and exit 2 on anything else; `deploy/build/index.mjs` re-exporting `jsonld` and `serverJson`. In `package.json`: `"companygraph-mcp-deploy": "bin/deploy.mjs"` under `bin`, `"deploy"` under `files`, and `"./deploy": "./deploy/build/index.mjs"` and `"./deploy/tests": "./deploy/test/index.mjs"` under `exports`.

- [ ] **Step 8: Run** `npm test` and read every test pass, the four new ones included.

- [ ] **Step 9: Commit.** Subject: `A deployment's build is one command of the package`.

### Task 4: The generic tests

**Files:**

- Create: `deploy/test/index.mjs`, `deploy/test/pin.mjs`, `deploy/test/tools.mjs`, `deploy/test/page.mjs`

**Interfaces:**

- Consumes: `config.mjs` from Task 3.
- Produces: `export function registerDeploymentTests()` from `companygraph-mcp-server/deploy/tests`, registering every shared test on `node:test` when a deployment's test file calls it. The page tests import `playwright` and read `dist/`, so a deployment runs them after `page-css` and `jsonld`.

- [ ] **Step 1: `pin.mjs`** — mcp-blust-ch's two pin tests (`516d421:test/pin.test.mjs`) read from `ROOT`, plus the three-place test (spec §4):

```js
test("the server's release is named once, in package.json, the workflows and the module", () => {
  const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
  const refs = [];
  for (const dir of [".github/workflows", "infra", "infra/bootstrap"]) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((f) => /\.(ya?ml|tf)$/.test(f)))
      for (const m of fs.readFileSync(path.join(d, f), "utf8").matchAll(/companygraph\/mcp-server[^\s"']*?(?:@|\?ref=)(v[\d.]+)/g))
        refs.push({ file: `${dir}/${f}`, ref: m[1] });
  }
  assert.ok(refs.length >= 2, "a deployment names the release in its workflows and its module");
  for (const { file, ref } of refs) assert.equal(ref, tag, `${file} names ${ref}; package.json pins ${tag}`);
});
```

- [ ] **Step 2: `tools.mjs`** — mcp-blust-ch's `tools.test.mjs` structural tests with every instance fact read from the snapshot: the root is `s.root`, `get_entity` is `{ type: "identity", name: s.root }`, `describe_schema` is the first type `list_types` returns, `list_entities` the first type with entities, `describe_rule` is `R4`, `fetch` is `identity`, `search` is `model`, and `find_evidence` is the first entity of type `skill` — or, when the instance has none, that call is skipped with `t.skip("this instance claims no skill, so find_evidence has nothing to be asked")` (Ruling 5). The company-of-one test and the LIKE MAGIC evidence test do not move: they are mcp.blust.ch's facts.

- [ ] **Step 3: `page.mjs`** — mcp-blust-ch's `page.test.mjs` with the server built from `dist/` and the root, and the crawler test generalized: it reads `dist/jsonld.json` if present, asserts the subject node is the `Person` or `Organization` the model implies (the same rule as `jsonld`), and when the file is absent asserts the page carries no `application/ld+json` script. The mark, wordmark, phone, robots and brand-link tests move unchanged.

- [ ] **Step 4: Run the shared tests against a real deployment tree before committing.** In a scratch copy of `~/git/robertblust/mcp-blust-ch` at `516d421` (never the clone itself): `npm install ~/git/companygraph/mcp-server-shared-deployment`, write `deployment.json` from Task 8 Step 2, run `npx companygraph-mcp-deploy snapshot && npx companygraph-mcp-deploy page-css && npx companygraph-mcp-deploy jsonld`, and a test file calling `registerDeploymentTests()`. Read every test pass except the three-place test, which fails on the scratch copy's unmoved workflows — the positive control that it fires.

- [ ] **Step 5: Commit.** Subject: `The tests every deployment runs ship with the server`.

### Task 5: The reusable workflows

**Files:**

- Create: `.github/workflows/deployment.yml`, `.github/workflows/registry.yml`

**Interfaces:**

- Consumes: the calling repository's `deployment.json` (Ruling 4), and the bootstrap's naming from Task 2.
- Produces: `uses: companygraph/mcp-server/.github/workflows/deployment.yml@<tag>` with `secrets: inherit`, and the same for `registry.yml`.

- [ ] **Step 1: Write `deployment.yml`** from mcp-blust-ch's `516d421:.github/workflows/deploy.yml`, with `on: workflow_call` and a first step in each job exporting the values:

```yaml
      - run: |
          jq -r '"PROJECT=\(.project)\nPROJECT_NUMBER=\(.project_number)\nREGION=\(.region)"' deployment.json >> "$GITHUB_ENV"
      - run: |
          echo "REGISTRY=$REGION-docker.pkg.dev/$PROJECT/mcp" >> "$GITHUB_ENV"
          echo "WIF_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github" >> "$GITHUB_ENV"
```

The service accounts become `deploy@${{ env.PROJECT }}.iam.gserviceaccount.com` and `terraform@${{ env.PROJECT }}.iam.gserviceaccount.com`; the build steps become `npx companygraph-mcp-deploy snapshot`, `page-css`, `jsonld`; the tag step `$(npx companygraph-mcp-deploy tag)`; the `docker login` host `$REGION-docker.pkg.dev`; the bootstrap validate runs only `if: hashFiles('infra/bootstrap/*.tf') != ''`. The plan, the plan comment, the apply and the live `list_types` check are unchanged.

- [ ] **Step 2: Write `registry.yml`** from `516d421:.github/workflows/publish.yml` with `on: workflow_call`, the build steps as above, `npx companygraph-mcp-deploy server-json "${GITHUB_REF_NAME#v}"`, `cat dist/server.json`, and `./mcp-publisher login dns --domain "$(jq -r .registry_domain deployment.json)"`. `mcp-publisher publish` reads `server.json` from the working directory, so the step runs in `dist/`. `environment: registry` stays: it is the approval gate.

- [ ] **Step 3: Validate** both with `npx --yes @action-validator/cli .github/workflows/deployment.yml` and the same for `registry.yml`, and read that each exits 0.

- [ ] **Step 4: Commit.** Subject: `A deployment's workflows are the server's, called by tag`.

### Task 6: Release v0.17.0

**Files:**

- Modify: `package.json`, `package-lock.json`, `README.md`

- [ ] **Step 1:** `README.md` gains a section on `deploy/`: what ships, what a deployment keeps, the three places the release is named, and links to the spec and to `deploy/bootstrap/README.md`.
- [ ] **Step 2:** `package.json` version `0.17.0`; `npm install --package-lock-only`.
- [ ] **Step 3:** `npm test`, the `terraform` job's commands locally if Terraform is installed, and `sh conventions/conventions-format`, `conventions-check`, `conventions-sync check`; each exit code read on its own.
- [ ] **Step 4:** Commit (`The release is 0.17.0`), push, open the pull request with the spec and plan linked, merge when `test`, `terraform` and `conventions` are green. Tag `v0.17.0` on the merge commit, release with notes: what `deploy/` holds, that no server answer changed, and that a deployment takes it by moving onto the shared parts as mcp-blust-ch does next.

---

## Part B — `robertblust/mcp-blust-ch`

### Task 7: Record the answers before the move

**Files:**

- Create (scratchpad, not the repository): `before/`

- [ ] **Step 1:** Over `https://mcp.blust.ch/mcp`, save the `result` of `list_types`, `describe_schema` for `concept`, `get_entity` for `{ "type": "identity", "name": "Robert Blust" }`, and the page's HTML (`curl -s https://mcp.blust.ch/`), each to its own file in the session's scratchpad `before/`. Record the `serverInfo.version` from `initialize`.

### Task 8: mcp.blust.ch moves onto the shared parts

**Files:**

- Create: `deployment.json`, `own.css` (moved from `build/own.css`)
- Modify: `package.json`, `package-lock.json`, `infra/main.tf`, `.github/workflows/deploy.yml`, `.github/workflows/publish.yml`, `Dockerfile`, `.gitignore`, `test/*.test.mjs`
- Delete: `build/`, `infra/run.tf`, `infra/hosting.tf`, `infra/budget.tf`, `infra/outputs.tf`
- Never touch: `infra/bootstrap/`

- [ ] **Step 1:** Worktree `~/git/robertblust/mcp-blust-ch-onto-the-shared-parts`, branch `onto-the-shared-parts`.

- [ ] **Step 2: `deployment.json`**, from the root's variable defaults and the constants of `build/`:

```json
{
  "project": "blust-ch-mcp",
  "project_number": "38003987140",
  "billing_account": "011DEB-4A45A0-3A52BB",
  "region": "europe-west6",
  "domain": "mcp.blust.ch",
  "site_id": "mcp-blust-ch",
  "repository": "robertblust/mcp-blust-ch",
  "registry_name": "ch.blust/mental-model",
  "registry_domain": "blust.ch",
  "budget_chf": 10,
  "run_host": "mcp-6nrmpez2aq-oa.a.run.app"
}
```

- [ ] **Step 3: `infra/main.tf`** becomes the backend, the providers, one module call and the moves:

```hcl
terraform {
  required_version = ">= 1.9"
  required_providers {
    google      = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
    google-beta = { source = "hashicorp/google-beta", version = ">= 6.0, < 8.0" }
  }
  backend "gcs" {
    bucket = "blust-ch-mcp-tfstate"
    prefix = "infra"
  }
}

locals { d = jsondecode(file("${path.module}/../deployment.json")) }
variable "image" { type = string }

provider "google" {
  project = local.d.project
  region  = local.d.region
}
provider "google-beta" {
  project = local.d.project
  region  = local.d.region
}

module "mcp" {
  source          = "git::https://github.com/companygraph/mcp-server.git//deploy/terraform?ref=v0.17.0"
  project         = local.d.project
  project_number  = local.d.project_number
  billing_account = local.d.billing_account
  region          = local.d.region
  domain          = local.d.domain
  site_id         = local.d.site_id
  budget_chf      = local.d.budget_chf
  run_host        = local.d.run_host
  image           = var.image
}

output "service_url" { value = module.mcp.service_url }
output "run_host" { value = module.mcp.run_host }
output "hosting_url" { value = module.mcp.hosting_url }
output "dns_records" { value = module.mcp.dns_records }

# The resources were declared in this root until the module held them. A move renames an
# address in the state; without it Terraform would destroy each and create it again.
moved {
  from = google_project_service.main
  to   = module.mcp.google_project_service.main
}
moved {
  from = google_service_account.run
  to   = module.mcp.google_service_account.run
}
moved {
  from = google_cloud_run_v2_service.mcp
  to   = module.mcp.google_cloud_run_v2_service.mcp
}
moved {
  from = google_cloud_run_v2_service_iam_member.public
  to   = module.mcp.google_cloud_run_v2_service_iam_member.public
}
moved {
  from = google_firebase_project.this
  to   = module.mcp.google_firebase_project.this
}
moved {
  from = google_firebase_hosting_site.this
  to   = module.mcp.google_firebase_hosting_site.this
}
moved {
  from = google_firebase_hosting_version.this
  to   = module.mcp.google_firebase_hosting_version.this
}
moved {
  from = google_firebase_hosting_release.this
  to   = module.mcp.google_firebase_hosting_release.this
}
moved {
  from = google_firebase_hosting_custom_domain.this
  to   = module.mcp.google_firebase_hosting_custom_domain.this
}
moved {
  from = google_billing_budget.monthly
  to   = module.mcp.google_billing_budget.monthly
}
```

Delete `run.tf`, `hosting.tf`, `budget.tf`, `outputs.tf`. Run `terraform -chdir=infra init -backend=false` and `validate` if Terraform is installed; otherwise the pull request's `terraform` job is the first to run them.

- [ ] **Step 4: The build and the image.** `package.json`: server `github:companygraph/mcp-server#v0.17.0`, installed by name, then `npm update companygraph-meta-model` and read both lockfile entries (the transitive-parser hazard); scripts become `"snapshot": "companygraph-mcp-deploy snapshot"` and likewise `page-css`, `jsonld`, `server-json`, and `"test": "node --test 'test/*.test.mjs'"`. `git mv build/own.css own.css`, then delete `build/`. `.gitignore` gains `dist/`. The `Dockerfile` copies `dist/`, `favicon.svg`, `brand.html` and `robots.txt`, and its `CMD` is `["node", "node_modules/.bin/companygraph-mcp-deploy", "serve"]`.

- [ ] **Step 5: The workflows.** `.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
  pull_request:
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false
jobs:
  deploy:
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    uses: companygraph/mcp-server/.github/workflows/deployment.yml@v0.17.0
    secrets: inherit
```

`publish.yml` the same with `on: push: tags: ["v*"]`, `permissions: contents: read` and `uses: …/registry.yml@v0.17.0`. The required status check keeps its name only if the job id matches the ruleset's: read the ruleset's contexts first (`gh api repos/robertblust/mcp-blust-ch/rulesets`), and name the caller's job so the reported check is the one it requires.

- [ ] **Step 6: The tests.** `test/shared.test.mjs` calls `registerDeploymentTests()`. `test/instance.test.mjs` keeps what only this instance can assert, moved from `516d421:test/tools.test.mjs` and `server-json.test.mjs`: the root is `Robert Blust`, the company of one refuses a bare name, the LIKE MAGIC evidence, and `serverJson` with `ch.blust/mental-model`, title `Robert Blust` and description `Robert Blust: One model, true everywhere`. Delete the moved test files.

- [ ] **Step 7: Run** `npm ci`, the three build commands, `npx playwright install chromium`, `npm test`; read every test pass, the three-place pin test included. Diff `dist/jsonld.json` against the JSON-LD built from `516d421` in Task 4's scratch copy: identical.

- [ ] **Step 8:** Commit (`The deployment runs on the server's shared parts`), push, open the pull request.

- [ ] **Step 9: The plan is the gate.** Read the `terraform` job's plan comment on the pull request. It must say `Plan: 0 to add, 1 to change, 0 to destroy`, list exactly the ten moves of Step 3, and its one change must be `module.mcp.google_cloud_run_v2_service.mcp` with `image` as the only attribute changing. Anything else — a second change, any destroy, an attribute beside `image` — stops the task: fix the module or the root in Part A or here, never merge past it.

- [ ] **Step 10:** Merge when `build`, `terraform` and `conventions` are green and Step 9 holds. Watch the deploy run on `main` to its end.

### Task 9: mcp.blust.ch answers as it did

- [ ] **Step 1:** Ask the same four things as Task 7 over `https://mcp.blust.ch/mcp` into `after/`.
- [ ] **Step 2:** `diff -r before after` shows only `serverInfo.version` (0.16.0 → 0.17.0). The model commit, core, parser tag, every tool result and the page's HTML and JSON-LD are identical.
- [ ] **Step 3:** If anything else differs, stop and report it before Part C; it is a defect of the extraction.

---

## Part C — `companygraph/mcp-companygraph-io`

### Task 10: The repository

**Files (all new):** `source.json`, `package.json`, `deployment.json`, `brand.html`, `own.css`, `favicon.svg`, `robots.txt`, `Dockerfile`, `.gitignore`, `infra/main.tf`, `infra/bootstrap/main.tf`, `.github/workflows/deploy.yml`, `.github/workflows/publish.yml`, `test/shared.test.mjs`, `test/instance.test.mjs`, `README.md`, and the conventions member files.

- [ ] **Step 1: Create** `gh repo create companygraph/mcp-companygraph-io --public --disable-wiki`, then `gh api -X PATCH repos/companygraph/mcp-companygraph-io -F allow_squash_merge=false -F allow_rebase_merge=false -F allow_merge_commit=true`. Clone to `~/git/companygraph/mcp-companygraph-io`, work in a worktree on branch `the-deployment`.

- [ ] **Step 2: `deployment.json`**, `project_number` left `""` until the owner's Task 11 Step 1 gives it, and `run_host` `""` (spec §6):

```json
{
  "project": "companygraph-io-mcp",
  "project_number": "",
  "billing_account": "011DEB-4A45A0-3A52BB",
  "region": "europe-west6",
  "domain": "mcp.companygraph.io",
  "site_id": "mcp-companygraph-io",
  "repository": "companygraph/mcp-companygraph-io",
  "registry_name": "io.companygraph/mental-model",
  "registry_domain": "companygraph.io",
  "budget_chf": 10,
  "run_host": ""
}
```

- [ ] **Step 3: The pins and the brand.** `source.json`: `{ "repo": "companygraph/mental-model", "commit": "…" }` with the commit from `gh api repos/companygraph/mental-model/commits/main --jq .sha`, read on the day. `package.json` as mcp-blust-ch's after Task 8, `name` `mcp-companygraph-io`. `brand.html`: companygraph.io's lockup, copied from `companygraph.github.io/index.html` (the `<svg>` of `.brand` and `<b>Company<span>Graph</span></b>`). `favicon.svg`: companygraph.io's. `own.css`: mcp-blust-ch's with the `.rb` and `.plate` rules replaced by companygraph.io's `.brand svg` stroke rules. `robots.txt`, `Dockerfile`, `.gitignore` as mcp-blust-ch's after Task 8.

- [ ] **Step 4: Terraform.** `infra/main.tf` as mcp-blust-ch's after Task 8, with `bucket = "companygraph-io-mcp-tfstate"` and no `moved` blocks. `infra/bootstrap/main.tf`: the provider block with `user_project_override = true` and `billing_project`, and one `module "bootstrap"` from `deploy/bootstrap?ref=v0.17.0` fed from `../../deployment.json`, with local state.

- [ ] **Step 5: Workflows and tests** as mcp-blust-ch's after Task 8. `test/instance.test.mjs` asserts the root is `CompanyGraph`, that `serverJson` gives `io.companygraph/mental-model`, title `CompanyGraph` and description `CompanyGraph: Written once, read by both`, and that `get_entity` for the product `CompanyGraph Core` resolves.

- [ ] **Step 6: `README.md`** — title `mcp.companygraph.io`, what it serves, and the owner's steps of Task 11 with every command written out.

- [ ] **Step 7: Conventions.** `sh ~/git/robertblust/conventions/conventions/conventions-sync sync` from the new repository writes the vendored files at the family's current release; a `conventions.yml` calling `robertblust/conventions/.github/workflows/check.yml@` at the tag `conventions.json` then names, exactly as `mcp-blust-ch`'s own `conventions.yml` reads.

- [ ] **Step 8: Run** `npm ci`, the build commands, `npm test`: every test passes, the page's JSON-LD test asserting that no JSON-LD is served (spec §7, no surface yet). Commit (`The deployment of CompanyGraph's own model`), push, open the pull request. `conventions` must be green; `build` passes; `terraform` fails at authentication until Task 11 — expected, and said in the pull request.

- [ ] **Step 9: Ruleset.** `protect-main` on `main`, requiring `conventions / conventions`, as mcp-blust-ch's (read its ruleset with `gh api` and create the same).

### Task 11: The owner's steps

These are the owner's. The agent writes each command into the README, reports it, and waits.

1. `gcloud projects create companygraph-io-mcp --organization=14986580178` and `gcloud billing projects link companygraph-io-mcp --billing-account=011DEB-4A45A0-3A52BB`; the project number (`gcloud projects describe companygraph-io-mcp --format='value(projectNumber)'`) goes into `deployment.json` in a commit on the pull request.
2. `gcloud services enable cloudbilling.googleapis.com --project companygraph-io-mcp`.
3. `brew install terraform`, then `terraform -chdir=infra/bootstrap init && terraform -chdir=infra/bootstrap apply`, and a second copy of the resulting state file somewhere safe.
4. Merge the pull request. The first deploy fails at the live check; its `run_host` warning names the host. Write it into `deployment.json` and merge that.
5. At Hostpoint: the records `terraform output dns_records` names for `mcp.companygraph.io`, replacing the default record, and the Registry's TXT record at the apex of `companygraph.io`.
6. `openssl genpkey -algorithm Ed25519 -out key.pem`, the public half into the TXT record, the private key as `MCP_PRIVATE_KEY` in the repository's `registry` environment.
7. After Task 12, tag `v1.0.0` and approve the `registry` run.

### Task 12: Live, then the surface

- [ ] **Step 1:** Over `https://mcp.companygraph.io/mcp`, `list_types` answers with `model.repo` `companygraph/mental-model` and the pinned commit; `describe_schema` for `concept` carries the cardinality enum. Add `build` to `protect-main`'s required checks.
- [ ] **Step 2:** In `companygraph/mental-model`, write `model/surfaces/mcp-companygraph-io-mcp-server.md` mirroring `robertblust/mental-model`'s `model/surfaces/mcp-blust-ch-mcp-server.md`: `production: built`, `built-by: https://github.com/companygraph/mcp-companygraph-io`, `url: https://mcp.companygraph.io`, and its sections in this instance's first person, "we". The entry is decided with the owner as every entry of that instance was. Pull request, merged when green.
- [ ] **Step 3:** Re-pin `source.json` to that merge commit, pull request, merge; the deploy writes the JSON-LD. Over the live page, the `Organization` is `CompanyGraph` with `https://github.com/companygraph` in its `sameAs`.

### Task 13: The family

- [ ] **Step 1:** `robertblust/conventions`: a `REPOSITORIES.md` row for `companygraph/mcp-companygraph-io` (title `mcp.companygraph.io`), and in *What pins what*, that it pins `companygraph/mental-model` by commit and the server by tag, as mcp-blust-ch does. A pull request; its release and any member re-sync are the owner's call.
- [ ] **Step 2:** `companygraph/.github`: the deployment's node and its two edges on the profile's diagram, with the labels mcp-blust-ch's edges carry. A pull request, merged when green.

---

## Not in this plan

mcp.blust.ch's bootstrap. Anything the server answers. A third deployment.
