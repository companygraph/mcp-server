#!/usr/bin/env node
// One command for every deployment's build, run in a deployment's own root, so the five steps a
// deployment needs are the package's code rather than a copy each deployment keeps and drifts
// from. `snapshot`, `page-css`, `tag` and `serve` are scripts that do their own work on import;
// `jsonld` and `server-json` are pure functions this command fills from `deployment.json` and
// writes to `dist/` itself, so a deployment's own tests can call them without writing a file. An
// operator error — an unknown subcommand, a missing version — is one line on stderr and exit 2,
// never a stack.
import fs from "node:fs";
import path from "node:path";
import { DIST, deployment, snapshot as readSnapshot } from "../deploy/build/config.mjs";
import { jsonld, serverJson } from "../deploy/build/index.mjs";

const USAGE = "usage: companygraph-mcp-deploy <snapshot|page-css|jsonld|server-json <version>|tag|serve>";

try {
  const [, , cmd, arg] = process.argv;
  switch (cmd) {
    case "snapshot":
      await import("../deploy/build/snapshot.mjs");
      break;
    case "page-css":
      await import("../deploy/build/page-css.mjs");
      break;
    case "tag":
      await import("../deploy/build/tag.mjs");
      break;
    case "serve":
      await import("../deploy/build/serve.mjs");
      break;
    case "jsonld": {
      const { repository } = deployment();
      const graph = jsonld(readSnapshot(), { repository });
      fs.mkdirSync(DIST, { recursive: true });
      if (graph) {
        const out = path.join(DIST, "jsonld.json");
        fs.writeFileSync(out, JSON.stringify(graph, null, 2) + "\n");
        console.log(`wrote ${out}`);
      } else {
        console.log(`no surface in the model names ${repository}: no JSON-LD written`);
      }
      break;
    }
    case "server-json": {
      if (!arg) { console.error("usage: companygraph-mcp-deploy server-json <version>"); process.exit(2); }
      const { registry_name: name, domain } = deployment();
      const json = serverJson(readSnapshot(), { name, url: `https://${domain}/mcp` }, arg);
      fs.mkdirSync(DIST, { recursive: true });
      fs.writeFileSync(path.join(DIST, "server.json"), JSON.stringify(json, null, 2) + "\n");
      console.log(`wrote server.json for ${name} ${arg}`);
      break;
    }
    default:
      console.error(USAGE);
      process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
