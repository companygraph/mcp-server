#!/usr/bin/env node
// Writes the snapshot the HTTP server serves. Two forms: two local directories, or a GitHub
// repository at a commit with the model and core subtrees named. Either way the file carries
// the commit it was read from, so a deployment can bake it and answer for one commit.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { readDir, readGitHub } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    github: { type: "string" }, sub: { type: "string", default: "model/" }, core: { type: "string", default: "meta/core/" },
    commit: { type: "string" }, repo: { type: "string" }, out: { type: "string" },
  },
});
if (!values.out) {
  console.error("usage: companygraph-mcp-snapshot <model-dir> <core-dir> [--commit sha] [--repo owner/name] [--sub model/] --out file\n" +
                "       companygraph-mcp-snapshot --github owner/name@sha [--sub model/] [--core meta/core/] --out file");
  process.exit(2);
}

let snapshot;
if (values.github) {
  const [repo, commit] = values.github.split("@");
  if (!repo || !commit) { console.error("--github wants owner/name@sha"); process.exit(2); }
  const [files, schemas] = await Promise.all([
    readGitHub({ repo, commit, sub: values.sub }),
    readGitHub({ repo, commit, sub: values.core }),
  ]);
  snapshot = buildSnapshot({ files, schemas, sub: values.sub, commit, repo });
} else {
  const [modelDir, coreDir] = positionals;
  if (!modelDir || !coreDir) { console.error("two directories: <model-dir> <core-dir>"); process.exit(2); }
  snapshot = buildSnapshot({ files: readDir(modelDir), schemas: readDir(coreDir), sub: values.sub, commit: values.commit ?? null, repo: values.repo ?? null });
}
fs.writeFileSync(values.out, JSON.stringify(snapshot) + "\n");
console.log(`wrote ${values.out}: ${snapshot.entities.length} entities, ${snapshot.edges.length} edges, core ${snapshot.core.version}, commit ${snapshot.commit ?? "(none)"}`);
