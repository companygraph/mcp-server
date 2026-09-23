// The pin a deployment carries in three places: package.json names the release, and the
// workflows and Terraform module that fetch it by tag have to name the same one.
//
// The server pin moves in package.json, and the lockfile keeps the old commit unless the
// package is installed by name; the image then runs the old server while every visible pin
// says otherwise. It happened on 2026-09-17. The installed package's own version is the one
// thing the tag cannot lie about.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHttpServer } from "companygraph-mcp-server/http";
import { ROOT, snapshot } from "../build/config.mjs";

export function registerPinTests() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const installed = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/companygraph-mcp-server/package.json"), "utf8"));

  test("the installed server is the release package.json pins", () => {
    const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
    assert.equal("v" + installed.version, tag);
  });

  // The parser is the server's dependency, not this repository's, and npm kept its old commit
  // when the server moved to a release that pins a newer one: the lockfile named server 0.2.0
  // beside parser 0.25.2. So the installed parser is held to the tag the installed server
  // declares.
  test("the installed parser is the release the installed server pins", () => {
    const parser = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/companygraph-meta-model/package.json"), "utf8"));
    const tag = installed.dependencies["companygraph-meta-model"].split("#")[1];
    assert.equal("v" + parser.version, tag);
  });

  // A pin split across package.json, a workflow and a Terraform module drifts the moment one of
  // them is edited alone: package.json moves to a release while a workflow or the module still
  // names the one it superseded, and nothing before this ran either against the other. A count
  // of two refs alone would pass on two workflow files and no module at all, which is exactly
  // the shape a deployment that forgot to re-pin its `?ref=` takes, so each kind is required on
  // its own rather than folded into one total.
  test("the server's release is named once, in package.json, the workflows and the module", () => {
    const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
    const refs = [];
    for (const dir of [".github/workflows", "infra", "infra/bootstrap"]) {
      const d = path.join(ROOT, dir);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d).filter((f) => /\.(ya?ml|tf)$/.test(f)))
        for (const m of fs.readFileSync(path.join(d, f), "utf8").matchAll(/companygraph\/mcp-server[^\s"']*?(@|\?ref=)(v[\d.]+)/g))
          refs.push({ file: `${dir}/${f}`, kind: m[1] === "@" ? "workflow" : "module", ref: m[2] });
    }
    assert.ok(refs.some((r) => r.kind === "workflow"), "a deployment names the release in at least one workflow, by @tag");
    assert.ok(refs.some((r) => r.kind === "module"), "a deployment names the release in its Terraform module, by ?ref=tag");
    for (const { file, ref } of refs) assert.equal(ref, tag, `${file} names ${ref}; package.json pins ${tag}`);
  });

  // The installed package's version is read from a file; what a deployment serves is what its
  // process answers, and the two are the same only if the image ran the package the tests read.
  // The page and the health body name the release from the package that is serving, so a
  // deployment that built green from a stale lockfile is visible to anyone who opens its page,
  // and this holds both to the tag the deployment pins.
  test("the served page and the health body name the release package.json pins", async () => {
    const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
    const server = createHttpServer(snapshot());
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    after(() => server.close());
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.server.name, "companygraph-mcp-server");
    assert.equal("v" + health.server.version, tag, `the health body names ${health.server.version}; package.json pins ${tag}`);
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes(`served by companygraph-mcp-server ${tag}.`), `the page does not say it is served by ${tag}`);
  });
}
