#!/usr/bin/env node
// Serves a baked snapshot. PORT is what Cloud Run sets; MCP_ALLOWED_HOSTS is the comma-separated
// list of hostnames a deployment answers to, and unset means any, for a local run. An operator
// error — an unknown flag, a snapshot file that is not there or not JSON — is one line on
// stderr and exit 2, never a stack.
import fs from "node:fs";
import { parseArgs } from "node:util";
import { createHttpServer } from "../lib/http.mjs";

try {
  const { values } = parseArgs({ options: { snapshot: { type: "string" }, port: { type: "string" }, "page-css": { type: "string" }, "page-icon": { type: "string" }, "page-brand": { type: "string" } } });
  if (!values.snapshot) { console.error("usage: companygraph-mcp-http --snapshot file [--port n] [--page-css file] [--page-icon file] [--page-brand file]"); process.exit(2); }
  const snapshot = JSON.parse(fs.readFileSync(values.snapshot, "utf8"));
  // A deployment with a design of its own hands in the whole stylesheet; unset, the page
  // carries the plain one this package ships.
  const pageCss = values["page-css"] ? fs.readFileSync(values["page-css"], "utf8") : null;
  // An icon travels as a data URI rather than a route, so the page stays one response and the
  // server keeps no static directory. Type from the extension, which is all a favicon needs.
  const ICON_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
  let pageIcon = null;
  if (values["page-icon"]) {
    const ext = values["page-icon"].slice(values["page-icon"].lastIndexOf("."));
    const type = ICON_TYPES[ext.toLowerCase()];
    if (!type) { console.error(`--page-icon: ${ext || "no extension"} is not one of ${Object.keys(ICON_TYPES).join(" ")}`); process.exit(2); }
    pageIcon = `data:${type};base64,${fs.readFileSync(values["page-icon"]).toString("base64")}`;
  }
  const pageBrand = values["page-brand"] ? fs.readFileSync(values["page-brand"], "utf8").trim() : null;
  const port = Number(values.port ?? process.env.PORT ?? 8080);
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean) : null;
  createHttpServer(snapshot, { allowedHosts, pageCss, pageIcon, pageBrand }).listen(port, "0.0.0.0", () => {
    console.log(`companygraph-mcp-http on :${port}, commit ${snapshot.commit ?? "(none)"}, core ${snapshot.core.version}, hosts ${allowedHosts ? allowedHosts.join(" ") : "any"}, page css ${values["page-css"] ?? "built-in"}, icon ${values["page-icon"] ?? "none"}, brand ${values["page-brand"] ?? "the name"}`);
  });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
