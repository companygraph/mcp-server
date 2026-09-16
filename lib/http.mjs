// One snapshot over Streamable HTTP with no session: a fresh transport and a fresh server per
// request, JSON responses rather than a stream, nothing cached. GET and DELETE have no meaning
// without a session and say so. A Host outside the allowed list is refused before the
// transport sees it; unset, nothing is checked, which is the local case. The SDK buffers a
// POST body whole and has no size option of its own, so a body over MAX_BODY_BYTES is refused
// before the transport is built: a stated Content-Length over the cap is refused with no read
// at all, otherwise the body is read here, bounded, and handed to the transport already
// parsed — reading it twice would race the SDK's own read of the same stream.
import http from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer } from "./server.mjs";
import { provenance } from "./model.mjs";

export const MAX_BODY_BYTES = 256 * 1024;

function readBoundedBody(req, res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        if (!res.headersSent) res.writeHead(413, { "Content-Type": "text/plain" }).end("request too large\n");
        req.destroy();
        resolve(undefined);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (res.headersSent) return;
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.length === 0) { resolve(undefined); return; }
      try { resolve(JSON.parse(text)); }
      catch {
        const body = JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: Invalid JSON" }, id: null });
        res.writeHead(400, { "Content-Type": "application/json" }).end(body);
        resolve(undefined);
      }
    });
    req.on("error", reject);
  });
}

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
    const contentLength = Number(req.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      res.writeHead(413, { "Content-Type": "text/plain" }).end("request too large\n");
      return;
    }
    try {
      const body = await readBoundedBody(req, res);
      if (res.headersSent) return;
      const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await createServer(snapshot).connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) { res.writeHead(500, { "Content-Type": "text/plain" }).end("internal error\n"); }
      else { res.end(); }
    }
  });
}
