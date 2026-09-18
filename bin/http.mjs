#!/usr/bin/env node
// Serves a baked snapshot. PORT is what Cloud Run sets; MCP_ALLOWED_HOSTS is the comma-separated
// list of hostnames a deployment answers to, and unset means any, for a local run. An operator
// error — an unknown flag, a snapshot file that is not there or not JSON — is one line on
// stderr and exit 2, never a stack.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { createHttpServer } from "../lib/http.mjs";

try {
  const { values } = parseArgs({ options: { snapshot: { type: "string" }, port: { type: "string" }, "page-css": { type: "string" } } });
  if (!values.snapshot) { console.error("usage: companygraph-mcp-http --snapshot file [--port n] [--page-css file]"); process.exit(2); }
  const snapshot = JSON.parse(fs.readFileSync(values.snapshot, "utf8"));
  // A deployment with a design of its own hands in the whole stylesheet; unset, the page
  // carries the plain one this package ships.
  const pageCss = values["page-css"] ? fs.readFileSync(values["page-css"], "utf8") : null;
  const port = Number(values.port ?? process.env.PORT ?? 8080);
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean) : null;
  createHttpServer(snapshot, { allowedHosts, pageCss }).listen(port, "0.0.0.0", () => {
    console.log(`companygraph-mcp-http on :${port}, commit ${snapshot.commit ?? "(none)"}, core ${snapshot.core.version}, hosts ${allowedHosts ? allowedHosts.join(" ") : "any"}, page css ${values["page-css"] ?? "built-in"}`);
  });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
