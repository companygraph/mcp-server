// One snapshot over Streamable HTTP with no session: a fresh transport and a fresh server per
// request, JSON responses rather than a stream, nothing cached. GET and DELETE have no meaning
// without a session and say so. A Host outside the allowed list is refused before the
// transport sees it; unset, nothing is checked, which is the local case.
import http from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer } from "./server.mjs";
import { provenance } from "./model.mjs";

export function createHttpServer(snapshot, { allowedHosts = null } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, model: provenance(snapshot) }) + "\n");
      return;
    }
    if (pathname !== "/mcp") { res.writeHead(404).end(); return; }
    if (allowedHosts && !allowedHosts.includes(req.headers.host ?? "")) {
      res.writeHead(403, { "Content-Type": "text/plain" }).end("host not allowed\n");
      return;
    }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await createServer(snapshot).connect(transport);
    await transport.handleRequest(req, res);
  });
}
