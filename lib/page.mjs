// The page a browser gets at /. An MCP endpoint answers POSTs and says nothing to a person who
// types the host into a browser, and the first thing that person sees decides whether they
// believe the rest. So this renders what the snapshot already holds — the model's own words
// about itself, the tools, the commit it reads — and states nothing this package knows about any
// particular instance.
//
// The project's own name is spelled only in lowercase here, in `companygraph.io` and in the
// repository path. The reference instance carries an entity of that name, so `portability.test`
// forbids the capitalized form in `lib/` — it cannot tell a project from an entity that shares
// its name, and every other file here keeps the same convention.
//
// A deployment may hand in its own icon the same way it hands in a stylesheet, and for the same
// reason: a mark belongs to whoever deploys, and a package that shipped one would put a
// stranger's badge in a stranger's tab.
//
// Structured data arrives the same way, and for a third reason: what a crawler should be told
// about a subject is a publishing decision, and schema.org's vocabulary is not this package's to
// choose on anyone's behalf. A deployment that wants it derives it from the model it already
// holds and hands the block over; unset, the page describes itself to a crawler with the
// ordinary tags above and nothing more.
//
// A deployment may hand in its own stylesheet, and then it owns the look entirely: this
// package ships one plain sheet so that a server with no styling still reads, and steps aside
// where a family has a design of its own. What the page guarantees in exchange is its markup —
// the class names below are the contract that stylesheet is written against, and changing one
// is a breaking change for whoever styled it.
//
// The address is taken from the request's Host rather than configured: the server cannot know
// which name it was reached by, a deployment may answer on more than one, and a hardcoded URL
// would be wrong on exactly the copy that mattered.
import fs from "node:fs";
import { provenance } from "./model.mjs";
import { noteFor } from "./server.mjs";
import { TOOLS } from "./tools.mjs";

// The release of this package, read from the file the handshake reads. A person who opens the
// page has no client to read `serverInfo` from, and a deployment's pin is the one thing a
// reader could not check against the page until the page named it; read here rather than
// handed in, so the page and the handshake cannot say two things.
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const SERVER = { name: pkg.name, version: pkg.version };

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A tool description carries Markdown code spans, `` `type` `` among them, and this page is not
// a Markdown renderer: it honors only that one span form, converting it after escaping so
// nothing a span carries can inject markup, never before, which would let a span reopen what
// escaping just closed.
const withMono = (s) => esc(s).replace(/`([^`]+)`/g, '<code class="mono">$1</code>');

// The instructions are one string of paragraphs, which is what an agent is given. A reader gets
// the same paragraphs in the same order, and the last one names the commit besides: the page is
// rendered from the snapshot on every request, so what it names cannot outlive its time.
const paragraphs = (text) =>
  text.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("\n      ");

export function renderPage(snapshot, { origin, css = null, icon = null, brand = null, jsonld = null, server = SERVER }) {
  const model = provenance(snapshot);
  const title = `${snapshot.root} — MCP server`;
  const endpoint = `${origin}/mcp`;
  const short = model.commit ? model.commit.slice(0, 7) : "uncommitted";
  const source = model.repo && model.commit
    ? `<a href="https://github.com/${esc(model.repo)}/tree/${esc(model.commit)}">${esc(model.repo)}@${esc(short)}</a>`
    : esc(model.repo ?? "an unversioned directory");

  const [lede, ...rest] = noteFor(snapshot).split("\n\n");

  // The way back to whoever this describes. The address is the identity's own `url`, so an
  // instance links its own home and this package names nobody's, and with no url there is no
  // header at all, because a brand that goes nowhere is furniture.
  //
  // What sits inside the link is the deployment's, inserted as written. A mark is markup and
  // not an image: the family this was built for draws its own in inline SVG so the plate and
  // the letters take their colours from the tokens and follow the theme, which an `<img>`
  // cannot do. So the deployment hands in that fragment; unset, the model's name stands in,
  // escaped. Nothing here inspects it — the deployment that supplies the stylesheet, the
  // snapshot and the container is already the author of the page.
  const home = snapshot.entities.find((e) => e.id === snapshot.rootId)?.fields?.url ?? null;
  const header = home
    ? `<header><div class="bar"><a class="brand" href="${esc(home)}" aria-label="${esc(snapshot.root)}">`
      + (brand ?? esc(snapshot.root))
      + `</a></div></header>\n      `
    : "";

  const rows = TOOLS.map(
    (t) => `<li><div class="head"><code class="mono p">${esc(t.name)}</code><span class="s">${withMono(t.description)}</span></div></li>`,
  ).join("\n        ");

  // The title contract the family's prose pages use, and a shape any instance fits: the
  // model's own name reads light, what this page is completes it heavy.
  //
  // The note arrives as paragraphs. The first is the lede under the headline; the rest
  // are what the model says about itself and the one sentence this package adds — that it adds
  // nothing — and they sit together in a single marked block, because a server telling a reader
  // what it does not do is the one reversal on the page.
  const DEFAULT_CSS = `
      :root { color-scheme: dark light; --ground:#181818; --ink:#E7ECF4; --dim:#8B96A8;
              --rule:#262626; --raise:#101010; --c-mid:#7FA3D8; --c-firm:#E7ECF4; --c-flag:#D9A44F; }
      * { box-sizing: border-box; }
      body { margin:0; padding:4rem 1rem 6rem; background:var(--ground); color:var(--ink);
             font:16px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif; }
      /* The page's container. A deployment vendoring a design that ships a rule for this name
         gets that rule instead of this one, which is the point of naming it rather than styling
         the element: the measure then belongs to the design and cannot be restated here and
         drift from it. */
      .shell { width:100%; max-width:46rem; margin:0 auto; }
      .title h1 { margin:0; line-height:1.05; letter-spacing:-.03em;
                  font-size:clamp(2rem,5vw,3.2rem); }
      .title h1 .r70 { display:block; font-weight:300; color:var(--dim); }
      .title h1 .rcl { display:block; font-weight:800; }
      .title h1 em { font-style:normal; color:var(--c-firm); }
      .tagline { margin-top:1.4rem; font-size:1.15rem; color:var(--dim); max-width:46ch;
                 line-height:1.4; }
      h2 { font-size:1rem; font-weight:600; margin:2.75rem 0 .75rem; }
      /* The lede names the parser's release, which between two releases may be a commit: forty
         characters with nothing to break on, as in the note below. */
      .lede { color:var(--dim); max-width:62ch; overflow-wrap:anywhere; }
      header { padding:2rem 0; }
      header .bar { display:flex; align-items:center; }
      .brand { display:flex; align-items:center; gap:.7rem; text-decoration:none;
               font-weight:600; }
      .note { margin:2rem 0; max-width:56ch; padding-left:1rem;
              border-left:2px solid var(--c-flag); color:var(--ink); }
      .note p:last-child { margin-bottom:0; }
      /* A commit is forty characters with nothing to break on, and this block always carries
         one. Unwrapped it takes a phone's viewport by about thirty-five pixels. */
      .note p { overflow-wrap:anywhere; }
      p { margin:0 0 1rem; }
      a { color:var(--c-mid); }
      code, pre { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.9em; }
      pre { background:var(--raise); border:1px solid var(--rule); border-radius:6px;
            padding:.85rem 1rem; overflow-x:auto; }
      .ops { margin-top:1.3rem; padding:0; list-style:none; display:grid; gap:.55rem; }
      .ops > li { background:var(--raise); border:1px solid var(--rule); border-radius:8px; }
      .ops .head { display:grid; gap:.15rem .9rem; align-items:baseline;
                   grid-template-columns:minmax(0,1fr); padding:.5rem .75rem; }
      .ops .m { font-size:.74rem; font-weight:600; letter-spacing:.08em; color:var(--c-mid); }
      .ops .p { font-size:.9rem; color:var(--ink); }
      .ops .s { font-size:.93rem; color:var(--dim); }
      .mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
      @media (min-width:780px) {
        .ops .head { grid-template-columns:3.6rem minmax(0,7rem) minmax(0,1fr); }
        .ops.tools .head { grid-template-columns:minmax(0,12rem) minmax(0,1fr); }
      }
      footer { margin-top:3.5rem; padding-top:1.25rem; border-top:1px solid var(--rule);
               color:var(--dim); font-size:.9rem; }
      @media (max-width:34rem) {
        body { padding-top:2.5rem; }
      }`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="A read-only MCP server over one company model. Every answer is what the model says at one commit.">
    <meta name="robots" content="index, follow">${jsonld ? `
    <script type="application/ld+json">${jsonld}</script>` : ""}${icon ? `
    <link rel="icon" href="${icon}" type="${icon.startsWith("data:") ? icon.slice(5, icon.indexOf(";")) : "image/svg+xml"}">` : ""}
    <style>${css ?? DEFAULT_CSS}
    </style>
  </head>
  <body>
    <main class="shell">
      ${header}<div class="title">
        <h1><span class="r70">${esc(snapshot.root)}</span><span class="rcl">over <em>MCP</em>.</span></h1>
      </div>
      ${lede ? `<p class="tagline">${esc(lede)}</p>` : ""}

      ${rest.length ? `<div class="note">
        ${rest.map((p) => `<p>${esc(p)}</p>`).join("\n        ")}
      </div>` : ""}

      <h2>The endpoint</h2>
      <p class="lede">Three paths, and only one of them speaks the protocol. Add
        <code class="mono">${esc(endpoint)}</code> to a client that takes a remote MCP server by
        URL.</p>
      <ul class="ops">
        <li><div class="head"><code class="mono m">POST</code><code class="mono p">/mcp</code><span class="s">The protocol. Streamable HTTP, one snapshot, no session.</span></div></li>
        <li><div class="head"><code class="mono m">GET</code><code class="mono p">/health</code><span class="s">Whether the server is up, and the model commit it answers from.</span></div></li>
        <li><div class="head"><code class="mono m">GET</code><code class="mono p">/</code><span class="s">This page. A browser gets it; <code class="mono">GET /mcp</code> is a 405 on purpose.</span></div></li>
      </ul>
      <p class="lede">Or run one against the same model over stdio, with no server at all:</p>
      <pre>npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core</pre>

      <h2>What it answers</h2>
      <ul class="ops tools">
        ${rows}
      </ul>

      <h2>What it reads</h2>
      <p class="lede">A snapshot of ${source}, parsed at build time against the core that
        instance vendored, core ${esc(model.core)} with parser ${esc(model.parser)},
        served by ${esc(server.name)} v${esc(server.version)}. Every answer carries that
        commit, so an answer can be checked against the files it came from.</p>

      <footer>
        Served by <a href="https://github.com/companygraph/mcp-server">companygraph/mcp-server</a>,
        the read-only MCP server for any instance ·
        <a href="https://companygraph.io">companygraph.io</a>
      </footer>
    </main>
  </body>
</html>
`;
}
