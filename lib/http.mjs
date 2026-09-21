// Four paths where a deployment supplies a robots rule, three otherwise: / is a page for whoever types the host into a browser, /health is for the
// deployment, and /mcp is the protocol. Everything else is a 404 from here rather than from
// whatever sits in front, which is the point of the host rewriting every path to this service.
//
// The health path is /health and not /healthz: on Cloud Run, Google's front end answers
// /healthz itself with its own 404 and the request never reaches the container.
// One snapshot over Streamable HTTP with no session: a fresh transport and a fresh server per
// request, JSON responses rather than a stream, nothing cached. GET and DELETE have no meaning
// without a session and say so. A Host outside the allowed list is refused, port-agnostically,
// before the transport sees it, by the SDK's own guard; unset, nothing is checked, which is
// the local case. An Origin is held to the same list by the SDK's other guard: a client outside
// a browser sends none and passes, a page served from one of the allowed hosts passes, and any
// other page, `null` and a value that is no origin are refused, since the protocol asks a server
// to check the header and nothing this server answers is meant for a foreign page's script. The
// SDK buffers a POST body whole and has no size option of its own, so a
// body over MAX_BODY_BYTES is refused before the transport is built: a stated Content-Length
// over the cap is refused with no read at all, otherwise the body is read here, bounded, and
// handed to the transport already parsed — reading it twice would race the SDK's own read of
// the same stream.
import http from "node:http";
import { NodeStreamableHTTPServerTransport, hostHeaderValidation, originValidation } from "@modelcontextprotocol/node";
import { createServer } from "./server.mjs";
import { provenance } from "./model.mjs";
import { renderPage } from "./page.mjs";

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

export function createHttpServer(snapshot, { allowedHosts = null, pageCss = null, pageIcon = null, pageBrand = null, pageJsonld = null, robots = null } = {}) {
  const checkHost = allowedHosts ? hostHeaderValidation(allowedHosts) : null;
  const checkOrigin = allowedHosts ? originValidation(allowedHosts) : null;
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, model: provenance(snapshot) }) + "\n");
      return;
    }
    // A crawler asks for this before anything else. Served only where a deployment supplied one,
    // because a rule about what may be crawled belongs to whoever publishes, not to this package.
    if (pathname === "/robots.txt" && robots && (req.method === "GET" || req.method === "HEAD")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : robots);
      return;
    }
    if (pathname === "/" && (req.method === "GET" || req.method === "HEAD")) {
      // The proxy in front knows the name the request arrived under; the container does not.
      const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
      // Behind a proxy the scheme is the forwarded one; direct, it is whether this socket is
      // encrypted. Assuming https would print an address that does not work in local use.
      const proto = req.headers["x-forwarded-proto"] ?? (req.socket.encrypted ? "https" : "http");
      const body = renderPage(snapshot, { origin: `${proto}://${host}`, css: pageCss, icon: pageIcon, brand: pageBrand, jsonld: pageJsonld });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    if (pathname !== "/mcp") { res.writeHead(404).end(); return; }
    if (checkHost && !checkHost(req, res)) return;
    if (checkOrigin && !checkOrigin(req, res)) return;
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
