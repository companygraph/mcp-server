#!/usr/bin/env node
// The local form: a model directory and its core, served over stdio to whatever launched it.
// The snapshot is built in memory; the commit is what the directory's repository says, or
// null outside one, or null again when the tree is dirty — an uncommitted model answers as
// uncommitted rather than as a commit that does not describe what is actually served. An
// operator error — an unknown flag, a directory that is not there, a parser throw, a core with
// no manifest — is one line on stderr and exit 2, never a stack.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { readDir } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";
import { createServer } from "../lib/server.mjs";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { sub: { type: "string", default: "model/" }, repo: { type: "string" } },
  });
  const [modelDir, coreDir] = positionals;
  if (!modelDir || !coreDir) {
    console.error("usage: companygraph-mcp <model-dir> <core-dir> [--sub model/] [--repo owner/name]");
    process.exit(2);
  }
  const commit = (() => {
    try {
      const dirty = execFileSync("git", ["-C", modelDir, "status", "--porcelain", "--", "."], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (dirty) return null;
      return execFileSync("git", ["-C", modelDir, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { return null; }
  })();
  const snapshot = buildSnapshot({ files: readDir(modelDir), schemas: readDir(coreDir), sub: values.sub, commit, repo: values.repo ?? null });
  await createServer(snapshot).connect(new StdioServerTransport());
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
