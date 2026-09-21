// The stylesheet a deployment hands the server for its landing page.
//
// The server ships a plain sheet of its own so that any instance reads without one. A
// deployment that belongs to a family with a design supplies the family's instead — and
// supplies it by asking the design package for its own blocks rather than copying their bytes
// here, which is the same reason a page carries fences instead of a stylesheet somebody pasted
// once.
//
// Four blocks and no more. Tokens carries the color ramp and both themes; the prose reset is
// what every prose page in the family declares first; the title contract is the two-part
// headline; the footer credit is the mark. The header, the nav and the stage are deliberately
// absent — this is one screen of prose and a table, with nowhere to navigate to.
//
// What follows them is the deployment's own layout, written against the tokens and against the
// class names `companygraph-mcp-server` documents as its markup contract. Those names are the
// seam: a rule here that invents a class the server does not emit styles nothing, silently.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { blockFor } from "@robertblust/design/fences";
import { ROOT, DIST } from "./config.mjs";

// The design package is the deployment's own devDependency (never this package's, so this
// package gains no dependency on the family's design), so its files are resolved from the
// deployment's own node_modules rather than from wherever this script happens to be installed.
const designPkg = createRequire(path.join(ROOT, "package.json")).resolve("@robertblust/design/package.json");
// The design package ships the font files the blocks name, and `tokens.css` states the rule the
// family holds itself to: nothing may name a family the site does not ship. The page has no
// static directory to serve them from — it is rendered by a server, not deployed as files — so
// they travel inside the stylesheet as data. Ninety-one kilobytes become about a hundred and
// twenty-five base64, paid on a visit to one page that is otherwise five. The alternative was a
// static route in a package that has no business growing one.
const FONT_DIR = path.join(path.dirname(designPkg), "assets/fonts/");
const FONTS = [
  { family: "Bricolage Grotesque", file: "Bricolage-var.woff2", weight: "200 800" },
  { family: "Instrument Sans", file: "InstrumentSans-var.woff2", weight: "400 700" },
  { family: "Plex Mono", file: "PlexMono-400.woff2", weight: "400" },
  { family: "Plex Mono", file: "PlexMono-600.woff2", weight: "600" },
];

// One `src` per face, not the two a site writes. A page serving these from `/fonts/` names the
// same file twice, as `woff2-variations` and as `woff2`, and pays nothing for the second; here
// the second would be a second copy of the bytes, and the file doubled to 230 kilobytes before
// anyone noticed. Every browser that supports variable fonts reads them from plain `woff2`.
const faces = FONTS.map(({ family, file, weight }) => {
  const b64 = fs.readFileSync(path.join(FONT_DIR, file)).toString("base64");
  return `  @font-face{font-family:"${family}";`
    + `src:url(data:font/woff2;base64,${b64}) format("woff2");`
    + `font-weight:${weight};font-display:swap}`;
}).join("\n");

// `design tokens` is the one fence whose stored block stops before the closing brace, and
// `blockFor` puts it back for the variant that closes: a prose page closes `:root` inside the
// fence, a deck leaves it open for its own tokens. So the page variant arrives closed and adding
// a brace here left the sheet one ahead — 50 open against 51 — which cost the rules after it.
const tokens = blockFor("design tokens", "page");
const reset = blockFor("prose reset", null);
const title = blockFor("title contract", null);

// The deployment's own layout, in a file that is actually CSS. It lived in a template literal
// here once and a backtick in it — in a comment, naming a class — ended the literal and broke
// the build three times, twice within an hour of a comment saying not to. A rule that has to be
// remembered is a rule that gets forgotten; a `.css` file cannot be ended by its own contents.
const own = fs.readFileSync(path.join(ROOT, "own.css"), "utf8");

fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, "page.css");
fs.writeFileSync(out, [faces, tokens, reset, title, own].join("\n\n") + "\n");
console.log(`wrote ${out}: ${fs.statSync(out).size} bytes from the design package's own blocks`);
