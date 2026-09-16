import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpServer } from "../lib/http.mjs";
import { exampleSnapshot, COMMIT } from "./helpers.mjs";

const s = exampleSnapshot();
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } };
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function listen(opts) {
  const server = createHttpServer(s, opts);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  after(() => server.close());
  return base;
}

test("POST /mcp answers JSON, statelessly, uncached", async () => {
  const base = await listen();
  const r = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal(r.headers.get("mcp-session-id"), null);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const body = await r.json();
  assert.equal(body.result.serverInfo.title, "Beacon Systems");
  const call = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_types", arguments: {} } }) });
  assert.equal((await call.json()).result.structuredContent.model.commit, COMMIT);
});

test("the SDK client lists seven tools over HTTP", async () => {
  const base = await listen();
  const client = new Client({ name: "t", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  assert.equal((await client.listTools()).tools.length, 7);
  await client.close();
});

test("other methods and paths", async () => {
  const base = await listen();
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/mcp`, { method: "DELETE" })).status, 405);
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
  const h = await fetch(`${base}/healthz`);
  assert.equal(h.status, 200);
  assert.equal(h.headers.get("cache-control"), "no-store");
  assert.deepEqual((await h.json()).model, { commit: COMMIT, repo: "companygraph/meta-model", core: "0.25.2", parser: "v0.25.2" });
});

test("a Host outside the allowed list is refused, an allowed one served", async () => {
  const base = await listen({ allowedHosts: ["mcp.example"] });
  const bad = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(bad.status, 403);
  const port = Number(new URL(base).port);
  const good = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { ...headers, host: "mcp.example" } },
      (res) => { res.resume(); res.on("end", () => resolve(res)); },
    );
    req.on("error", reject);
    req.end(JSON.stringify(INIT));
  });
  assert.equal(good.statusCode, 200);
});
