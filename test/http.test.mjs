import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpServer, MAX_BODY_BYTES } from "../lib/http.mjs";
import { exampleSnapshot, COMMIT, EXAMPLE_CORE, PARSER } from "./helpers.mjs";
import { TOOLS } from "../lib/tools.mjs";

const s = exampleSnapshot();
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } };
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function listen(opts = {}) {
  const { snapshot = s, ...rest } = opts;
  const server = createHttpServer(snapshot, rest);
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

test("the SDK client lists every tool over HTTP", async () => {
  const base = await listen();
  const client = new Client({ name: "t", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  assert.equal((await client.listTools()).tools.length, TOOLS.length);
  await client.close();
});

test("other methods and paths", async () => {
  const base = await listen();
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/mcp`, { method: "DELETE" })).status, 405);
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
  const h = await fetch(`${base}/health`);
  assert.equal(h.status, 200);
  assert.equal(h.headers.get("cache-control"), "no-store");
  assert.deepEqual((await h.json()).model, { commit: COMMIT, repo: "companygraph/meta-model", core: EXAMPLE_CORE, parser: PARSER });
});

// A person with curl and no client can check a deployment's release against its pin in one
// line. The field is additive: whoever read ok and model reads what they read.
test("/health names the release that serves it, beside what it answered before", async () => {
  const base = await listen();
  const body = await (await fetch(`${base}/health`)).json();
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(body).sort(), ["model", "ok", "server"]);
  assert.equal(body.ok, true);
  assert.deepEqual(body.server, { name: pkg.name, version: pkg.version });
});

test("GET / is a page naming the model, the endpoint it was reached by and every tool", async () => {
  const base = await listen();
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^text\/html/);
  const html = await r.text();
  // The model speaking for itself, not a description this package wrote.
  assert.ok(html.includes(s.root), "the page names the model's root");
  assert.ok(html.includes(COMMIT), "the page names the commit it reads");
  assert.ok(html.includes(`at commit ${COMMIT} (core ${EXAMPLE_CORE}) and adds nothing.`), "the note says which commit, as the instructions no longer do");
  // The address is the one the request arrived under, never a configured guess.
  assert.ok(html.includes(`${base}/mcp`), "the page names the endpoint it was reached by");
  for (const tool of TOOLS) assert.ok(html.includes(tool.name), `the page lists ${tool.name}`);
  // A page is HTML a browser renders, so an entity name carrying a bracket cannot escape it.
  assert.ok(!/<[a-z]+[^>]*>/i.test(s.root) || !html.includes(s.root), "root is escaped where it is unsafe");
  // The markup is the contract a supplied stylesheet is written against.
  for (const cls of ["title", "r70", "rcl", "tagline", "note", "lede"])
    assert.ok(html.includes(`class="${cls}"`), `the page carries .${cls}`);
  assert.ok(html.includes('class="ops"') && html.includes('class="ops tools"'), "the route list and the tool list carry theirs");
  for (const part of ["mono m", "mono p", '"s"']) assert.ok(html.includes(part), `a row carries ${part}`);
  const head = await fetch(`${base}/`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("the header links the identity's own url, and is absent when it has none", async () => {
  const base = await listen();
  const html = await (await fetch(`${base}/`)).text();
  const home = s.entities.find((e) => e.id === s.rootId).fields.url;
  assert.ok(home, "the fixture identity has a url to link");
  assert.ok(html.includes(`<a class="brand" href="${home}"`), "the brand links the identity's url");
  assert.ok(html.includes(">Robert Blust</a>") || html.includes(`>${s.root}</a>`), "with no brand supplied the name stands in, escaped");

  const lockup = '<svg viewBox="0 0 32 32"><rect class="plate"/></svg><b>A <span>B</span></b>';
  const branded = await listen({ pageBrand: lockup });
  const bhtml = await (await fetch(`${branded}/`)).text();
  assert.ok(bhtml.includes(lockup), "a supplied brand is inserted as written, markup and all");

  const noUrl = structuredClone(s);
  noUrl.entities.find((e) => e.id === noUrl.rootId).fields.url = undefined;
  const bare = await listen({ snapshot: noUrl });
  assert.ok(!(await (await fetch(`${bare}/`)).text()).includes("class=\"brand\""), "no url, no header");
});

test("a supplied icon is linked, and none is linked when none is supplied", async () => {
  const icon = "data:image/svg+xml;base64,PHN2Zy8+";
  const withIcon = await listen({ pageIcon: icon });
  const html = await (await fetch(`${withIcon}/`)).text();
  assert.ok(html.includes(`<link rel="icon" href="${icon}" type="image/svg+xml">`), "the icon is linked with its type");
  const without = await listen();
  assert.ok(!(await (await fetch(`${without}/`)).text()).includes('rel="icon"'), "no icon, no link");
});

test("a supplied json-ld block reaches the head, escaped, and none means none", async () => {
  const node = { "@context": "https://schema.org", "@type": "Person", "name": "A <b>test</b>" };
  const base = await listen({ pageJsonld: JSON.stringify(node).replace(/</g, "\\u003c") });
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<script type="application\/ld\+json">/, "the block is in the head");
  assert.ok(!html.includes("<b>test</b>"), "a < inside the block cannot close the script");
  const bare = await listen();
  assert.ok(!(await (await fetch(`${bare}/`)).text()).includes("ld+json"), "no block, no script");
});

test("robots.txt is served where one is supplied, and 404s where none is", async () => {
  const body = "User-agent: *\nAllow: /\n";
  const base = await listen({ robots: body });
  const r = await fetch(`${base}/robots.txt`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^text\/plain/);
  assert.equal(await r.text(), body);
  const bare = await listen();
  assert.equal((await fetch(`${bare}/robots.txt`)).status, 404, "no rule supplied, no rule invented");
});

test("a supplied stylesheet replaces the built-in one and the markup is unchanged", async () => {
  const base = await listen({ pageCss: "/* supplied */ body { color: rebeccapurple }" });
  const html = await (await fetch(`${base}/`)).text();
  assert.ok(html.includes("/* supplied */"), "the supplied sheet is used");
  assert.ok(!html.includes("ui-monospace"), "the built-in sheet is gone rather than appended");
  assert.ok(html.includes('class="ops tools"'), "the markup a stylesheet targets is unchanged");
});

test("a Host outside the allowed list is refused, an allowed one served regardless of its port", async () => {
  const base = await listen({ allowedHosts: ["mcp.example"] });
  const bad = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(bad.status, 403);
  const port = Number(new URL(base).port);
  const good = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { ...headers, host: "mcp.example:8443" } },
      (res) => { res.resume(); res.on("end", () => resolve(res)); },
    );
    req.on("error", reject);
    req.end(JSON.stringify(INIT));
  });
  assert.equal(good.statusCode, 200);
});

// A browser names the page a request came from, and the protocol asks a server to hold that
// name to a policy; a connector's backend and every other client outside a browser sends none.
// So no Origin passes, an Origin of the deployment's own hosts passes, and any other is refused
// before the transport sees it, as a Host is: a foreign page, `null` from a sandboxed frame or a
// file, and a value that is no origin at all.
test("an Origin outside the allowed hosts is refused, and no Origin or the host's own is served", async () => {
  const base = await listen({ allowedHosts: ["mcp.example"] });
  const port = Number(new URL(base).port);
  const post = (origin) => new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { ...headers, host: "mcp.example", ...(origin === undefined ? {} : { origin }) } },
      (res) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") })); },
    );
    req.on("error", reject);
    req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
  });
  for (const origin of ["https://untrusted.example", "null", "not an origin", "https://mcp.example.evil.test"]) {
    const r = await post(origin);
    assert.equal(r.status, 403, origin);
    assert.doesNotMatch(r.body, /list_types/, `${origin} was handed the tool catalog`);
    assert.equal(JSON.parse(r.body).jsonrpc, "2.0", origin);
  }
  for (const origin of [undefined, "https://mcp.example", "https://mcp.example:8443"]) {
    const r = await post(origin);
    assert.equal(r.status, 200, String(origin));
    assert.match(r.body, /list_types/, String(origin));
  }
});

test("with no allowed hosts, the local case, an Origin is not checked, as a Host is not", async () => {
  const base = await listen();
  const port = Number(new URL(base).port);
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { ...headers, origin: "http://localhost:6274" } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.end(JSON.stringify(INIT));
  });
  assert.equal(status, 200);
});

test("a body over the cap is 413, and the server still answers a normal request after", async () => {
  const base = await listen();
  const big = await fetch(`${base}/mcp`, { method: "POST", headers, body: "x".repeat(MAX_BODY_BYTES + 1) });
  assert.equal(big.status, 413);
  assert.equal(big.headers.get("cache-control"), "no-store");
  const r = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result.serverInfo.title, "Beacon Systems");
});

test("a handler error is a 500, not a dead server", async () => {
  const bad = { ...s, entities: null };
  const server = createHttpServer(bad);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  after(() => server.close());
  const first = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(first.status, 500);
  assert.equal(first.headers.get("cache-control"), "no-store");
  const second = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(INIT) });
  assert.equal(second.status, 500);
});
