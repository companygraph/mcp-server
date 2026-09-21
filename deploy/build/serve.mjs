// The image's start: the server over dist/, handing it the JSON-LD only when the build wrote one.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { DIST } from "./config.mjs";

const http = createRequire(import.meta.url).resolve("../../bin/http.mjs");
const f = (n) => path.join(DIST, n);
const args = [http, "--snapshot", f("snapshot.json"), "--page-css", f("page.css"), "--page-icon", "favicon.svg",
  "--page-brand", "brand.html", "--robots", "robots.txt"];
if (fs.existsSync(f("jsonld.json"))) args.push("--page-jsonld", f("jsonld.json"));
spawn(process.execPath, args, { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 1));
