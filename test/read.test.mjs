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
  assert.equal(calls.length, 3);
  assert.deepEqual(new Set(calls.slice(1).map((c) => c.url)), new Set([
    "https://raw.githubusercontent.com/o/r/abc/model/identity.md",
    "https://raw.githubusercontent.com/o/r/abc/model/skills/a.md",
  ]));
  assert.ok(calls.slice(1).every((c) => c.headers.authorization === "Bearer T"));
});

test("readGitHub bounds concurrency: no more than eight blob fetches in flight at once", async () => {
  const blobs = Array.from({ length: 20 }, (_, i) => ({ type: "blob", path: `model/${i}.md` }));
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = async (url) => {
    if (url.includes("/git/trees/")) return { ok: true, json: async () => ({ truncated: false, tree: blobs }) };
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    return { ok: true, text: async () => `text of ${url.split("/").pop()}` };
  };
  const files = await readGitHub({ repo: "o/r", commit: "abc", sub: "model/", fetch });
  assert.equal(files.size, 20);
  assert.ok(maxInFlight <= 8, `expected at most 8 in flight, saw ${maxInFlight}`);
});

test("readGitHub fails on a truncated listing and on a failed blob", async () => {
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async () => ({ ok: true, json: async () => ({ truncated: true, tree: [] }) }) }), /truncated/);
  await assert.rejects(readGitHub({ repo: "o/r", commit: "abc", sub: "model/",
    fetch: async (url) => url.includes("/git/trees/")
      ? { ok: true, json: async () => ({ truncated: false, tree: [{ type: "blob", path: "model/x.md" }] }) }
      : { ok: false, status: 500 } }), /model\/x\.md: HTTP 500/);
});
