// The one way a deployment reads the model it pins: the server's own snapshot command, against
// the commit source.json names, so what it serves is what the pin says.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DIST, source } from "./config.mjs";

const { repo, commit } = source();
fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, "snapshot.json");
execFileSync("npx", ["--no-install", "companygraph-mcp-snapshot", "--github", `${repo}@${commit}`,
  "--sub", "model/", "--core", "meta/core/", "--out", out], { stdio: "inherit" });
