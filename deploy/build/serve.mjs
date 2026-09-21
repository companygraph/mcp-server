// The image's start: the server over dist/, handing it the JSON-LD only when the build wrote one.
//
// Run in-process rather than spawned as a child: a container sized for one Node process was
// running two, the command that never exited and the server it exited into, and only the
// second one Cloud Run's health check ever saw. bin/http.mjs reads its options from
// process.argv via parseArgs() at import time and starts listening on import, so setting argv
// and importing it here starts the same server this process would otherwise spawn.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DIST } from "./config.mjs";

const http = createRequire(import.meta.url).resolve("../../bin/http.mjs");
const f = (n) => path.join(DIST, n);
const flags = ["--snapshot", f("snapshot.json"), "--page-css", f("page.css"), "--page-icon", "favicon.svg",
  "--page-brand", "brand.html", "--robots", "robots.txt"];
if (fs.existsSync(f("jsonld.json"))) flags.push("--page-jsonld", f("jsonld.json"));
process.argv = [process.execPath, http, ...flags];
await import(pathToFileURL(http).href);
