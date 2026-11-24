import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tagOf, pinOf, installedPackage, installedParser, SERVER, PARSER } from "../lib/pin.mjs";

test("a pin names its tag from git by its ref and from npm by its version", () => {
  assert.equal(tagOf("github:companygraph/mcp-server#v0.75.3"), "v0.75.3");
  assert.equal(tagOf("0.98.0"), "v0.98.0");
});

test("a package is found under its npm name first and its old name after", () => {
  assert.deepEqual(pinOf({ dependencies: { "companygraph-mcp-server": "github:companygraph/mcp-server#v0.75.3" } }, SERVER), { name: "companygraph-mcp-server", spec: "github:companygraph/mcp-server#v0.75.3", tag: "v0.75.3" });
  assert.deepEqual(pinOf({ dependencies: { "@companygraph/meta-model": "0.98.0", "companygraph-meta-model": "github:companygraph/meta-model#v0.96.0" } }, PARSER), { name: "@companygraph/meta-model", spec: "0.98.0", tag: "v0.98.0" });
  assert.throws(() => pinOf({ dependencies: {} }, SERVER), /depends on none of @companygraph\/mcp-server, companygraph-mcp-server/);
});

test("an installed package is found nested under a package or hoisted above it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pin-"));
  const write = (at, version) => {
    fs.mkdirSync(at, { recursive: true });
    fs.writeFileSync(path.join(at, "package.json"), JSON.stringify({ version }));
  };
  const server = path.join(dir, "node_modules", "@companygraph", "mcp-server");
  write(path.join(dir, "node_modules", "@companygraph", "meta-model"), "0.98.0");
  write(server, "0.76.0");
  assert.equal(installedPackage("@companygraph/meta-model", server).version, "0.98.0");
  write(path.join(server, "node_modules", "@companygraph", "meta-model"), "0.97.0");
  assert.equal(installedPackage("@companygraph/meta-model", server).version, "0.97.0");
  assert.throws(() => installedPackage("@companygraph/chat-server", server), /is not installed/);
});

test("the parser this checkout runs on is the release its package.json pins", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal("v" + installedParser().version, pinOf(pkg, PARSER).tag);
});
