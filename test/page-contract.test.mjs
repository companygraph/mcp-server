// The page and the sheet it ships with, held against each other.
//
// `http.test.mjs` asserts the page emits the class names the README documents, because those are
// what a deployment writes its own stylesheet against. It says nothing about whether the sheet
// *here* styles them, and that is a second thing entirely: an instance that supplies no
// stylesheet renders with this one, so a class added to the markup and forgotten in the sheet
// leaves that instance with unstyled content and leaves nothing red.
//
// Neither direction is caught by reading. A rule for a class the page stopped emitting is dead
// weight that reads as maintained, and a class with no rule looks fine in the diff that added
// it, because the deployment being looked at has its own sheet and styles it anyway.
import { test } from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { exampleSnapshot } from "./helpers.mjs";
import { renderPage } from "../lib/page.mjs";

// The page with nothing supplied: the built-in sheet, which is the case this file is about.
const html = renderPage(exampleSnapshot(), { origin: "https://example.test" });
const sheet = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));

const emitted = [...new Set(
  [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/)),
)].sort();

// A class the sheet mentions anywhere, in any combination — `.ops.tools` and `.ops .head` both
// count for `ops`, `tools` and `head`. The question is whether the sheet knows the name at all,
// not how it reaches it.
const mentioned = (cls) => new RegExp(`\\.${cls}\\b`).test(sheet);

test("every class the page emits is styled by the sheet it ships with", () => {
  assert.ok(emitted.length > 5, `the page emitted only ${emitted.join(" ")}`);
  const orphans = emitted.filter((c) => !mentioned(c));
  assert.deepEqual(orphans, [],
    `emitted and unstyled: ${orphans.join(", ")} — an instance supplying no stylesheet renders these bare`);
});

test("every class the sheet styles is one the page emits", () => {
  const styled = [...new Set([...sheet.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
  const dead = styled.filter((c) => !emitted.includes(c)).sort();
  assert.deepEqual(dead, [],
    `styled and never emitted: ${dead.join(", ")} — a rule for markup that is gone`);
});

// A tool description carries Markdown code spans, and the page is not a Markdown renderer: it
// converts only that one form, and only after escaping, so nothing inside a span can inject
// markup and no backtick reaches a reader as a literal character.
test("a description's code spans render as code, escaped first", () => {
  assert.ok(!html.includes("`"), "a literal backtick reached the page");
  assert.match(html, /<code class="mono">type<\/code>/, "a plain span becomes <code class=\"mono\">");
  assert.match(html, /<code class="mono">match: &quot;words&quot;<\/code>/, "a quote inside a span stays escaped");
});

// The README is what a deployment reads before writing a stylesheet of its own, so a name that
// is in the markup and not in the README is a name nobody knows to style.
test("the README names every class the page emits", () => {
  const text = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  // A name counts wherever it appears as a selector, including inside a longer one: the README
  // writes `header > .bar > a.brand`, and `.bar` is documented by that as surely as by itself.
  const missing = emitted.filter((c) => !new RegExp(`\\.${c}\\b`).test(text));
  assert.deepEqual(missing, [],
    `emitted and undocumented: ${missing.join(", ")} — the contract is what the README says it is`);
});

// The one fact about the server a reader could not check: which release is answering. The
// handshake names it from package.json, and the page names it from the same file, so a
// deployment's pin, the handshake and the page agree by construction. A test hands its own
// pair in to show the option is the seam and the package is only the default.
test("the page names the release that serves it, from the package unless one is handed in", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(html.includes(`served by ${pkg.name} v${pkg.version}.`), "the lede ends with the package's own name and version");
  const other = renderPage(exampleSnapshot(), { origin: "https://example.test", server: { name: "x", version: "9.9.9" } });
  assert.ok(other.includes("served by x v9.9.9."), "a server handed in is the one named");
  assert.ok(!other.includes(pkg.version), "and the package's own version is then nowhere on the page");
});
