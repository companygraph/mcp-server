# The page names the release — design

> A person who types a host into a browser reads which model the server answers from, at which commit, against which core and with which parser, and not which release of the server is answering. A client learns it in the handshake, where an external check read it today; the page and `/health`, the two places that need no client, say nothing. The server's release joins the provenance line and the health body, read from the package as the handshake already reads it.

Status: proposed. Decided on 2026-09-23 with the owner against this repository at `4c46e3b` (v0.26.0), after an external review of mcp.companygraph.io read the release from `serverInfo` and the owner asked whether the page reflected it. Both deployments, mcp.blust.ch and mcp.companygraph.io, serve this package, so the line reaches both with a re-pin.

---

## 1. The gap

`renderPage` writes a lede from the snapshot's provenance: a snapshot of the repository at its commit, parsed against the core the instance vendored, core and parser named. `/health` answers `ok` and the same provenance. Neither names the release of this package that is serving, because `provenance` is the model's and the page was written to state what the model says and nothing the package knows about itself. The handshake does name it: `createServer` reads `package.json` and hands `name` and `version` to the SDK, which is where a client, and today's external check, found 0.26.0.

So the one fact a reader of the page cannot check is whether the deployment took the release its owner pinned. A deploy's live check is a tool call and proves the protocol; the page proves the route; nothing a person can read proves the release. **What the change buys is that the page and the health body say which release is answering, from the same file the handshake reads, so the three agree by construction.**

## 2. The line

The lede's sentence ends with the server: "A snapshot of `<repo>@<commit>`, parsed at build time against the core that instance vendored, core 0.39.0 with parser v0.43.0, served by companygraph-mcp-server v0.26.0." The name and the version are the package's, read once in `lib/page.mjs` as `lib/server.mjs` reads them, and `renderPage` takes them as an option, `server: { name, version }`, defaulting to the package's own, so a test can hand it a version and a deployment never has to. The version is written with its `v`, as the tags and the pins write it, so a reader compares it with a pin by eye. It is short and breaks nowhere, so the lede's rule for a forty-character commit is untouched.

## 3. The health body

`/health` answers `{ ok, model, server: { name, version } }`. The field is additive: a caller reading `ok` and `model` reads what it read. It is there because a person with `curl` and no client can then check a deployment's release against its pin in one line, and because the README's own sentence about the deploy, that a GET proves the route and never the release, stops being true in the way that matters.

## 4. Tests

`test/page-contract.test.mjs` gains one case: the rendered page names `companygraph-mcp-server` with the version `package.json` carries, and a `renderPage` given `server: { name: "x", version: "9.9.9" }` names that instead, so the option is the seam and the default is the package. `test/http.test.mjs` gains one: `/health` carries `server.name` and `server.version` equal to the package's. In `deploy/test/`, beside the pin test that holds the installed package to the tag the deployment names, one case reads the served page and the health body from the deployment's own server and holds both to that same tag; a deployment that built green with a stale lockfile, the case the pin test was written for on 2026-09-17, would now also be visible to anyone who opened its page.

## 5. Files

`lib/page.mjs` reads the package and writes the clause; `lib/http.mjs` adds `server` to the health body; the two test files in `test/` and one in `deploy/test/`; the README's sentence on what the deploy's GET proves.

## 6. Release

One release, the next minor after whatever `main` carries when this merges. Additive: no tool, argument, answer or error moves, and `docs/INTERFACE.md` does not describe the page or the health body, so the notes carry no `Interface` heading and a deployment does nothing but re-pin. Merging, the tag and the re-pins each wait for the owner's word.

## 7. Out of scope

Naming the release in the handshake's `instructions`, which a test holds to name no commit and no version on purpose. Listing the model's entities on the page, which lists the tools and the provenance. Any change to what the page says about the model.
