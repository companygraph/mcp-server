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
// A deployment may hand in its own stylesheet, and then it owns the look entirely: this
// package ships one plain sheet so that a server with no styling still reads, and steps aside
// where a family has a design of its own. What the page guarantees in exchange is its markup —
// the class names below are the contract that stylesheet is written against, and changing one
// is a breaking change for whoever styled it.
//
// The address is taken from the request's Host rather than configured: the server cannot know
// which name it was reached by, a deployment may answer on more than one, and a hardcoded URL
// would be wrong on exactly the copy that mattered.
import { provenance } from "./model.mjs";
import { instructionsFor } from "./server.mjs";
import { TOOLS } from "./tools.mjs";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The instructions are one string of paragraphs, which is what an agent is given. A reader gets
// the same words in the same order, as paragraphs.
const paragraphs = (text) =>
  text.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("\n      ");

export function renderPage(snapshot, { origin, css = null, icon = null }) {
  const model = provenance(snapshot);
  const title = `${snapshot.root} — MCP server`;
  const endpoint = `${origin}/mcp`;
  const short = model.commit ? model.commit.slice(0, 7) : "uncommitted";
  const source = model.repo && model.commit
    ? `<a href="https://github.com/${esc(model.repo)}/tree/${esc(model.commit)}">${esc(model.repo)}@${esc(short)}</a>`
    : esc(model.repo ?? "an unversioned directory");

  const [lede, ...rest] = instructionsFor(snapshot).split("\n\n");

  const rows = TOOLS.map(
    (t) => `<tr><td><code>${esc(t.name)}</code></td><td>${esc(t.description)}</td></tr>`,
  ).join("\n        ");

  // The title contract the family's prose pages use, and a shape any instance fits: the
  // model's own name reads light, what this page is completes it heavy.
  //
  // The instructions arrive as paragraphs. The first is the lede under the headline; the rest
  // are what the model says about itself and the one sentence this package adds — that it adds
  // nothing — and they sit together in a single marked block, because a server telling a reader
  // what it does not do is the one reversal on the page.
  const DEFAULT_CSS = `
      :root { color-scheme: dark light; --ground:#181818; --ink:#E7ECF4; --dim:#8B96A8;
              --rule:#262626; --raise:#101010; --c-mid:#7FA3D8; --c-firm:#E7ECF4; --c-flag:#D9A44F; }
      * { box-sizing: border-box; }
      body { margin:0; padding:4rem 1rem 6rem; background:var(--ground); color:var(--ink);
             font:16px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif; }
      main { max-width:46rem; margin:0 auto; }
      .title h1 { margin:0; line-height:1.05; letter-spacing:-.03em;
                  font-size:clamp(2rem,5vw,3.2rem); }
      .title h1 .r70 { display:block; font-weight:300; color:var(--dim); }
      .title h1 .rcl { display:block; font-weight:800; }
      .title h1 em { font-style:normal; color:var(--c-firm); }
      .tagline { margin-top:1.4rem; font-size:1.15rem; color:var(--dim); max-width:46ch;
                 line-height:1.4; }
      h2 { font-size:1rem; font-weight:600; margin:2.75rem 0 .75rem; }
      .lede { color:var(--dim); max-width:62ch; }
      .note { margin:2rem 0; max-width:56ch; padding-left:1rem;
              border-left:2px solid var(--c-flag); color:var(--ink); }
      .note p:last-child { margin-bottom:0; }
      p { margin:0 0 1rem; }
      a { color:var(--c-mid); }
      code, pre { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.9em; }
      pre, code.addr { background:var(--raise); border:1px solid var(--rule); border-radius:6px; }
      pre { padding:.85rem 1rem; overflow-x:auto; }
      code.addr { padding:.2rem .45rem; }
      table.tools { border-collapse:collapse; width:100%; }
      table.tools td, table.tools th { text-align:left; vertical-align:top;
             padding:.5rem .75rem .5rem 0; border-bottom:1px solid var(--rule); }
      table.tools th { color:var(--dim); font-weight:600; font-size:.85rem; }
      table.tools td:first-child { white-space:nowrap; width:1%; }
      footer { margin-top:3.5rem; padding-top:1.25rem; border-top:1px solid var(--rule);
               color:var(--dim); font-size:.9rem; }
      @media (max-width:34rem) {
        body { padding-top:2.5rem; }
        table.tools td:first-child { white-space:normal; }
      }`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="A read-only MCP server over one company model. Every answer is what the model says at one commit.">
    <meta name="robots" content="index, follow">${icon ? `
    <link rel="icon" href="${icon}" type="${icon.startsWith("data:") ? icon.slice(5, icon.indexOf(";")) : "image/svg+xml"}">` : ""}
    <style>${css ?? DEFAULT_CSS}
    </style>
  </head>
  <body>
    <main>
      <div class="title">
        <h1><span class="r70">${esc(snapshot.root)}</span><span class="rcl">over <em>MCP</em>.</span></h1>
      </div>
      ${lede ? `<p class="tagline">${esc(lede)}</p>` : ""}

      ${rest.length ? `<div class="note">
        ${rest.map((p) => `<p>${esc(p)}</p>`).join("\n        ")}
      </div>` : ""}

      <h2>The endpoint</h2>
      <p class="lede"><code class="addr">${esc(endpoint)}</code></p>
      <p class="lede">It speaks MCP over HTTP and answers POST. A browser gets this page
        instead, and <code>GET ${esc(endpoint)}</code> is a 405 on purpose.</p>
      <p class="lede">Add it to a client that takes a remote MCP server by URL, or run one
        against the same model over stdio:</p>
      <pre>npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core</pre>

      <h2>What it answers</h2>
      <table class="tools">
        <tr><th>Tool</th><th>Returns</th></tr>
        ${rows}
      </table>

      <h2>What it reads</h2>
      <p class="lede">A snapshot of ${source}, parsed at build time against the core that
        instance vendored, core ${esc(model.core)} with parser ${esc(model.parser)}. Every
        answer carries that commit, so an answer can be checked against the files it came
        from.</p>

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
