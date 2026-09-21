// The McpServer for one snapshot. Its title is the identity's name and its instructions are
// what the model says about itself — the vision's tagline, the identity's tagline — followed
// by the one sentence this package adds: that it adds nothing. Between the two stands a glossary
// of the terms every tool description uses, which is this package's own and names no instance fact.
//
// That sentence names no commit and no version. A client reads the instructions once, when the
// connection is set up, and may keep its copy for as long as the connector exists; every answer
// carries `model`, read from the snapshot being served. A commit written into the instructions
// is then read beside answers naming a later one, and nothing says which of the two is old. The
// page is rendered from the snapshot on every request, so it keeps the commit: `noteFor`.
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const taglines = (s) => {
  const identity = s.entities.find((e) => e.id === s.rootId);
  const vision = s.entities.find((e) => e.type === "vision");
  return [vision?.tagline, identity?.tagline];
};

// The terms the tool descriptions lean on, defined once. A client reads the instructions when
// the connection is set up and a description every time it chooses a tool, so a definition said
// here is one the descriptions need not repeat.
export const GLOSSARY = [
  "Terms the tools use.",
  "An id identifies one entity across the whole model, and every tool that takes an entity takes its id.",
  "A canonical name is an entity's title, unique within its type and, for an owned type, within its owner, so a name alone can be ambiguous where an id cannot.",
  "An owner is the entity another is nested under.",
  "A reference is an edge from one entity to another, and `via` names the field or Section.Column that drew it, or `nested-in` for nesting, a name no schema declares.",
  "A qualifier is a value on a table row that describes that row's edge and draws none of its own.",
  "A list answers a page at a time: follow `page.nextCursor` while `page.hasMore`.",
  "A refused call carries `error.code` for a program beside the sentence for a reader.",
].join(" ");

export function instructionsFor(s) {
  return [...taglines(s), GLOSSARY,
    "This server reports what the model says at one commit, which every answer names under `model`, and adds nothing."]
    .filter(Boolean).join("\n\n");
}

// The same paragraphs for a reader of the page, where the last one names the commit and core.
export function noteFor(s) {
  return [...taglines(s),
    `This server reports what the model says at commit ${s.commit ?? "(uncommitted)"} (core ${s.core.version}) and adds nothing.`]
    .filter(Boolean).join("\n\n");
}

export function createServer(s, { name = pkg.name, version = pkg.version } = {}) {
  const server = new McpServer({ name, version, title: s.root }, { instructions: instructionsFor(s) });
  registerTools(server, s);
  return server;
}
