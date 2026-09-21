// What the landing page has to be true of, asserted against the rendered page rather than
// against the stylesheet that produces it.
//
// The design system's own position is that a contract is an outcome and not a declaration:
// `header.css` leaves the brand lockup and the bar's gap to each site, on purpose, and
// `verify/pages.mjs` measures the result instead — "the wordmark broke" is a height compared
// against a height, not a rule compared against a rule. The three sites in that family are
// covered that way. This page is not, because it is rendered by a server rather than deployed
// as files, and nothing in that suite can crawl it.
//
// So it gets the same treatment here, run against whatever `dist/` a deployment built. Every
// assertion below is a mistake that was made while building the first deployment of this page
// and would have been caught by nobody:
//
//   the shell     an extra closing brace on the tokens fence swallowed the rule after it, and
//                 the content ran the full 1180 with no gutter — 160px wider than every other
//                 page in the family.
//   the header    the body carried top padding where the rest of the family carries none, which
//                 put the mark 22 pixels below where every sibling puts it.
//   the wordmark  the page's own `a` rule painted the whole lockup in the link color, where the
//                 family leaves a link inheriting and colors one span of it.
//
// A browser is the only thing that can see any of those, which is why this file is the one
// place in the shared test suite that needs one.
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createHttpServer } from "companygraph-mcp-server/http";
import { ROOT, DIST, deployment, snapshot } from "../build/config.mjs";
import { jsonld } from "../build/index.mjs";

export function registerPageTests() {
  describe("the page a deployment serves", () => {
    const s = snapshot();
    const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
    const jsonldPath = path.join(DIST, "jsonld.json");
    const hasJsonld = fs.existsSync(jsonldPath);

    let server, browser, base;

    before(async () => {
      server = createHttpServer(s, {
        pageCss: fs.readFileSync(path.join(DIST, "page.css"), "utf8"),
        pageBrand: read("brand.html").trim(),
        pageIcon: `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, "favicon.svg")).toString("base64")}`,
        pageJsonld: hasJsonld ? JSON.stringify(JSON.parse(fs.readFileSync(jsonldPath, "utf8"))).replace(/</g, "\\u003c") : null,
        robots: read("robots.txt"),
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      base = `http://127.0.0.1:${server.address().port}/`;
      browser = await chromium.launch();
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    // The shell every prose page in the family sits in: 1180 at most, and a gutter that grows
    // with the viewport until it reaches 80 and stops. Asserted as the rule that applied,
    // because that is what a stray brace takes away — the rendered width alone would not say
    // why it was wrong.
    test("the content sits in the family's shell", async () => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const shell = await page.evaluate(() => {
        const m = document.querySelector("main.shell");
        const cs = getComputedStyle(m);
        const box = m.getBoundingClientRect();
        return {
          maxWidth: cs.maxWidth, padLeft: cs.paddingLeft,
          padRight: cs.paddingRight, outer: Math.round(box.width),
          bodyPadTop: getComputedStyle(document.body).paddingTop,
        };
      });
      assert.equal(shell.padRight, "80px", "the gutter reached its stop on both sides");
      assert.equal(shell.outer, 1180, "the shell is as wide as it may be at this viewport");
      assert.equal(shell.bodyPadTop, "0px", "the space above the header is the header's, not the body's");
      await page.close();
    });

    // The measure is the design package's, not this repository's: the page names its container
    // and the vendored reset styles it. Read the expected numbers out of the package rather
    // than typing them, so a release that moves the family's measure fails here instead of
    // diverging quietly.
    test("the shell is the one the design package declares", async () => {
      const reset = fs.readFileSync(path.join(ROOT, "node_modules/@robertblust/design/blocks/reset.css"), "utf8");
      const rule = reset.match(/\.shell\{([^}]*)\}/);
      assert.ok(rule, "the design package still ships a .shell rule");
      const want = Object.fromEntries(rule[1].split(";").map((d) => d.split(":").map((x) => x.trim())));

      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const got = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector("main.shell"));
        return { maxWidth: cs.maxWidth, padding: cs.paddingLeft };
      });
      assert.equal(got.maxWidth, want["max-width"], "the page takes the package's measure");
      // `min(7vw, 80px)` at 1400 is 80, the stop the package's own comment describes.
      assert.equal(got.padding, "80px", "the gutter reached the package's stop");
      await page.close();
    });

    // The headline is the design package's title contract, and the contract is that the first
    // clause reads light and dim over a heavy completion. If a release renamed those classes the
    // page would keep emitting them, the rules would match nothing, and the headline would go
    // flat with nothing else here noticing.
    test("the title contract still shapes the headline", async () => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const h = await page.evaluate(() => {
        const cs = (s) => getComputedStyle(document.querySelector(s));
        const weight = (s) => Number(cs(s).fontWeight);
        return {
          family: cs(".title h1").fontFamily,
          light: weight(".title h1 .r70"), heavy: weight(".title h1 .rcl"),
          dim: cs(".title h1 .r70").color, ink: cs(".title h1 .rcl").color,
        };
      });
      assert.match(h.family, /Bricolage/, "the headline is set in the family's display face");
      assert.ok(h.heavy > h.light, `the completion is heavier: ${h.heavy} against ${h.light}`);
      assert.notEqual(h.dim, h.ink, "the first clause reads dimmer than the completion");
      await page.close();
    });

    // Where the mark sits, in the numbers a sibling page puts it at: 2rem of header padding
    // above it, and the shell's own gutter to its left.
    test("the mark sits where every sibling puts it", async () => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const mark = await page.evaluate(() => {
        const r = document.querySelector(".brand svg").getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), size: Math.round(r.height) };
      });
      // (1400 − 1180) / 2 centers the shell, and 80 is its gutter.
      assert.equal(mark.left, 190, "the mark starts at the shell's gutter");
      assert.equal(mark.size, 28, "the mark is the family's 28px");
      // 2rem above, and the mark centered in a row no taller than itself.
      assert.ok(mark.top >= 30 && mark.top <= 34, `the mark sits under 2rem of header, at ${mark.top}px`);
      await page.close();
    });

    // The wordmark is two halves and reads as two halves: the name in the page's ink, the
    // second word in the accent. One rule painting the whole link takes that apart without
    // breaking anything a parser would notice.
    test("the wordmark is two colors, and the second is the accent", async () => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const colors = await page.evaluate(() => {
        const b = document.querySelector(".brand b");
        const span = b.querySelector("span");
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--c-mid").trim();
        const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
        const hex = (el) => getComputedStyle(el).color;
        const asRgb = (v) => { const d = document.createElement("i"); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
        return { b: hex(b), span: hex(span), accent: asRgb(accent), ink: asRgb(ink) };
      });
      assert.equal(colors.span, colors.accent, "the second word is the accent");
      assert.equal(colors.b, colors.ink, "the first is the page's ink");
      assert.notEqual(colors.b, colors.span, "and the two are not the same color");
      await page.close();
    });

    // The check the design system runs against every page it covers, in its own words: the
    // brand is one line and the page does not scroll sideways on the narrowest phone it is
    // written for.
    test("on a phone the wordmark holds and nothing scrolls sideways", async () => {
      const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const shut = await page.evaluate(() => ({
        brand: Math.round(document.querySelector(".brand").getBoundingClientRect().height),
        mark: Math.round(document.querySelector(".brand svg").getBoundingClientRect().height),
        wide: document.documentElement.scrollWidth > window.innerWidth,
      }));
      assert.ok(shut.brand <= shut.mark,
        `the wordmark broke: the brand is ${shut.brand}px against a ${shut.mark}px mark`);
      assert.ok(!shut.wide, "the page scrolls sideways");
      await page.close();
    });

    // The crawler test does not carry any instance's facts: it computes what `jsonld()` would
    // build from this model and asks whether `dist/jsonld.json` and the served page agree with
    // it, which is the rule every deployment shares rather than one this file would otherwise
    // have to restate. It computes `want` first rather than branching on whether the file
    // exists — a model that DOES name a surface but whose JSON-LD build step silently wrote
    // nothing must fail here, not pass by reading an absent file as "no surface".
    test("a crawler is told the subject the model implies, or nothing at all", async () => {
      const want = jsonld(s, { repository: deployment().repository });
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const script = await page.evaluate(() =>
        document.querySelector('script[type="application/ld+json"]')?.textContent ?? null);
      if (want === null) {
        assert.ok(!fs.existsSync(jsonldPath), "the model names no surface, so no jsonld.json should have been written");
        assert.equal(script, null, "the model names no surface, so the page carries no structured data");
        await page.close();
        return;
      }
      assert.ok(fs.existsSync(jsonldPath), "the model names a surface, so jsonld.json should have been written");
      assert.deepEqual(JSON.parse(script), want, "the served graph is the one jsonld() builds from this model");
      await page.close();
    });

    // A crawler asks for this before it asks for anything else.
    test("robots.txt is served and allows the page", async () => {
      const r = await fetch(new URL("/robots.txt", base));
      assert.equal(r.status, 200);
      const body = await r.text();
      assert.match(body, /^User-agent: \*$/m);
      assert.match(body, /^Allow: \/$/m);
      assert.ok(!/^Sitemap:/m.test(body), "no sitemap line: this address is not discovered here");
    });

    // The one link that is not decoration: a reader who arrived from a registry listing and
    // wants the person or organization behind the server. It comes from the identity's own
    // `url`, so this asserts the page took it rather than that anyone typed it.
    test("the brand links the address the model gives for itself", async () => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(base, { waitUntil: "networkidle" });
      const href = await page.getAttribute(".brand", "href");
      const identity = s.entities.find((e) => e.id === s.rootId);
      assert.equal(href, identity.fields.url, "the brand links the identity's url");
      await page.close();
    });
  });
}
