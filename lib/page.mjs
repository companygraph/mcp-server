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

export function renderPage(snapshot, { origin }) {
  const model = provenance(snapshot);
  const title = `${snapshot.root} — MCP server`;
  const endpoint = `${origin}/mcp`;
  const short = model.commit ? model.commit.slice(0, 7) : "uncommitted";
  const source = model.repo && model.commit
    ? `<a href="https://github.com/${esc(model.repo)}/tree/${esc(model.commit)}">${esc(model.repo)}@${esc(short)}</a>`
    : esc(model.repo ?? "an unversioned directory");

  const rows = TOOLS.map(
    (t) => `<tr><td><code>${esc(t.name)}</code></td><td>${esc(t.description)}</td></tr>`,
  ).join("\n        ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="A read-only MCP server over one company model. Every answer is what the model says at one commit.">
    <meta name="robots" content="index, follow">
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 4rem 1rem 6rem; background: #181818; color: #E7ECF4;
             font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      main { max-width: 46rem; margin: 0 auto; }
      h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .25rem; font-weight: 600; }
      .kicker { margin: 0 0 2rem; color: #8B96A8; font-size: .95rem; }
      h2 { font-size: 1rem; font-weight: 600; margin: 2.75rem 0 .75rem; letter-spacing: .01em; }
      p { margin: 0 0 1rem; }
      a { color: #7FA3D8; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
      pre { background: #101010; border: 1px solid #262626; border-radius: 6px;
            padding: .85rem 1rem; overflow-x: auto; }
      code.addr { background: #101010; border: 1px solid #262626; border-radius: 6px;
                  padding: .2rem .45rem; }
      table { border-collapse: collapse; width: 100%; }
      td, th { text-align: left; vertical-align: top; padding: .5rem .75rem .5rem 0;
               border-bottom: 1px solid #262626; }
      th { color: #8B96A8; font-weight: 600; font-size: .85rem; }
      td:first-child { white-space: nowrap; width: 1%; }
      footer { margin-top: 3.5rem; padding-top: 1.25rem; border-top: 1px solid #262626;
               color: #8B96A8; font-size: .9rem; }
      @media (max-width: 34rem) {
        body { padding-top: 2.5rem; }
        td:first-child { white-space: normal; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${esc(snapshot.root)}</h1>
      <p class="kicker">A read-only MCP server over one company model.</p>

      ${paragraphs(instructionsFor(snapshot))}

      <h2>The endpoint</h2>
      <p><code class="addr">${esc(endpoint)}</code></p>
      <p>It speaks MCP over HTTP and answers POST. A browser gets this page instead, and
        <code>GET ${esc(endpoint)}</code> is a 405 on purpose.</p>
      <p>Add it to a client that takes a remote MCP server by URL, or run one against the same
        model over stdio:</p>
      <pre>npx --package github:companygraph/mcp-server companygraph-mcp ./model ./meta/core</pre>

      <h2>What it answers</h2>
      <table>
        <tr><th>Tool</th><th>Returns</th></tr>
        ${rows}
      </table>

      <h2>What it reads</h2>
      <p>A snapshot of ${source}, parsed at build time against the core that instance vendored,
        core ${esc(model.core)} with parser ${esc(model.parser)}. Every answer carries that
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
