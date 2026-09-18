// The page this package ships, opened in a browser and measured.
//
// `page-contract.test.mjs` holds the markup and the sheet against each other, which catches a
// class with no rule and a rule with no class. It cannot catch a rule that is there and wrong.
// The bug that prompted this file was exactly that: the model's commit is forty characters with
// nothing to break on, `.note p` had every rule it needed except one, and a reader on a phone
// got a page that scrolled sideways. Nothing about that is visible to a parser — the sheet was
// valid, the class was styled, the markup was right.
//
// It was found by a deployment measuring its own page, and only reached this package because
// somebody thought to look. That is not a guarantee, so this is: the same measurements against
// the sheet an instance gets when it supplies none of its own.
//
// Kept to what holds for any instance. Nothing here asserts a gutter or a mark's position,
// because those belong to whatever stylesheet a deployment supplies; what a page must do
// whoever styles it is fit the screen it is read on.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createHttpServer } from "../lib/http.mjs";
import { exampleSnapshot } from "./helpers.mjs";

let server, browser, base;

before(async () => {
  server = createHttpServer(exampleSnapshot());
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

// 360 is the narrowest screen the family writes for, and the width the design system's own
// page checks use.
test("the page fits a phone", async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const fit = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    // Whatever pushed it, named, so the failure says which element rather than only that one did.
    widest: [...document.querySelectorAll("*")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible")
      .map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(/\s+/).join(".") : ""}`)
      .slice(0, 4),
  }));
  assert.equal(fit.scrollWidth, fit.innerWidth,
    `the page scrolls sideways by ${fit.scrollWidth - fit.innerWidth}px; overflowing: ${fit.widest.join(", ") || "nothing named"}`);
  await page.close();
});

test("the page fits a laptop", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const w = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  }));
  assert.equal(w.scrollWidth, w.innerWidth, "the page scrolls sideways on a wide screen");
  await page.close();
});

// Every class the page emits reaches the browser as something the sheet actually touched. The
// contract test compares two texts; this asks the engine, so a rule that parsed but never
// matched — a typo in a selector, a block dropped by a stray brace — is caught here.
test("every emitted class is matched by a rule the browser applied", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const unmatched = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]);
    const selectors = rules.flatMap((r) => r.selectorText ? [r.selectorText]
      : r.cssRules ? [...r.cssRules].map((n) => n.selectorText).filter(Boolean) : []);
    const classes = new Set([...document.querySelectorAll("[class]")]
      .flatMap((el) => String(el.className).trim().split(/\s+/)));
    return [...classes].filter((c) => !selectors.some((s) => new RegExp(`\\.${c}\\b`).test(s)));
  });
  assert.deepEqual(unmatched, [],
    `the browser applied no rule naming: ${unmatched.join(", ")}`);
  await page.close();
});

// The one thing a stray brace takes away without breaking anything: the rules after it. Counting
// what the engine parsed against what the sheet declares is how that becomes visible.
test("the browser parsed every rule the sheet declares", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const counts = await page.evaluate(() => {
    const sheet = document.styleSheets[0];
    const text = document.querySelector("style").textContent;
    return { parsed: sheet.cssRules.length, opens: (text.match(/\{/g) || []).length, closes: (text.match(/\}/g) || []).length };
  });
  assert.equal(counts.opens, counts.closes,
    `the sheet has ${counts.opens} open braces against ${counts.closes} closing`);
  assert.ok(counts.parsed > 10, `the browser parsed only ${counts.parsed} rules`);
  await page.close();
});
