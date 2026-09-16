// The McpServer for one snapshot. Its title is the identity's name and its instructions are
// what the model says about itself — the vision's tagline, the identity's tagline — followed
// by the one sentence this package adds: that it adds nothing.
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export function instructionsFor(s) {
  const identity = s.entities.find((e) => e.id === s.rootId);
  const vision = s.entities.find((e) => e.type === "vision");
  return [vision?.tagline, identity?.tagline,
    `This server reports what the model says at commit ${s.commit ?? "(uncommitted)"} (core ${s.core.version}) and adds nothing.`]
    .filter(Boolean).join("\n\n");
}

export function createServer(s, { name = pkg.name, version = pkg.version } = {}) {
  const server = new McpServer({ name, version, title: s.root }, { instructions: instructionsFor(s) });
  registerTools(server, s);
  return server;
}
