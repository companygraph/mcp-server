import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readDir, readGitHub } from "../lib/read.mjs";
import { fixtureRoot } from "./helpers.mjs";

test("readDir maps every file under the root by its relative path", () => {
  const files = readDir(path.join(fixtureRoot, "example", "model"));
  assert.ok(files.has("identity.md"));
  assert.ok(files.has("profiles/tomas-reyes/tomas-reyes.md"));
  assert.match(files.get("identity.md"), /^---\n/);
  assert.deepEqual([...files.keys()], [...files.keys()].sort());
});

test("readGitHub lists the tree at the commit and reads each blob under sub", async () => {
  const calls = [];
  const fetch = async (url, { headers }) => {
    calls.push({ url, headers });
    if (url.includes("/git/trees/")) {
      return { ok: true, json: async () => ({ truncated: false, tree: [
        { type: "blob", path: "model/identity.md" },
        { type: "blob", path: "README.md" },
        { type: "tree", path: "model/skills" },
        { type: "blob", path: "model/skills/a.md" },
      ] }) };
    }
    return { ok: true, text: async () => `text of ${url.split("/").pop()}` };
  };
  const files = await readGitHub({ repo: "o/r", commit: "abc", sub: "model/", token: "T", fetch });
  assert.deepEqual([...files.keys()], ["identity.md", "skills/a.md"]);
  assert.equal(files.get("identity.md"), "text of identity.md");
  assert.equal(calls[0].url, "https://api.github.com/repos/o/r/git/trees/abc?recursive=1");
  assert.equal(calls[0].headers.authorization, "Bearer T");
  assert.equal(calls[1].url, "https://raw.githubusercontent.com/o/r/abc/model/identity.md");
});

test("readGitHub fails on a truncated listing and on a failed blob", async () => {
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async () => ({ ok: true, json: async () => ({ truncated: true, tree: [] }) }) }), /truncated/);
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async (url) => url.includes("/git/trees/")
      ? { ok: true, json: async () => ({ truncated: false, tree: [{ type: "blob", path: "model/x.md" }] }) }
      : { ok: false, status: 500 } }), /model\/x\.md: HTTP 500/);
});
