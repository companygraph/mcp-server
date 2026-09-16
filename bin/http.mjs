#!/usr/bin/env node
// Serves a baked snapshot. PORT is what Cloud Run sets; MCP_ALLOWED_HOSTS is the comma-separated
// list of hostnames a deployment answers to, and unset means any, for a local run.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { createHttpServer } from "../lib/http.mjs";

const { values } = parseArgs({ options: { snapshot: { type: "string" }, port: { type: "string" } } });
if (!values.snapshot) { console.error("usage: companygraph-mcp-http --snapshot file [--port n]"); process.exit(2); }
const snapshot = JSON.parse(fs.readFileSync(values.snapshot, "utf8"));
const port = Number(values.port ?? process.env.PORT ?? 8080);
const allowedHosts = process.env.MCP_ALLOWED_HOSTS ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean) : null;
createHttpServer(snapshot, { allowedHosts }).listen(port, "0.0.0.0", () => {
  console.log(`companygraph-mcp-http on :${port}, commit ${snapshot.commit ?? "(none)"}, core ${snapshot.core.version}, hosts ${allowedHosts ? allowedHosts.join(" ") : "any"}`);
});
