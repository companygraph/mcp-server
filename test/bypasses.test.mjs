import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isoWeek, lastWeek, countBypasses } from "../lib/bypasses.mjs";

test("an ISO week runs Monday 00:00 to the next Monday 00:00 UTC, and week 1 holds the year's first Thursday", () => {
  assert.deepEqual(isoWeek(new Date("2026-10-02T12:00:00Z")), { week: "2026-W40", from: new Date("2026-09-28T00:00:00Z"), to: new Date("2026-10-05T00:00:00Z") });
  assert.equal(isoWeek(new Date("2027-01-01T00:00:00Z")).week, "2026-W53");
  assert.equal(isoWeek(new Date("2026-01-01T00:00:00Z")).week, "2026-W01");
});

test("the week that ended is the one before the week of now", () => {
  assert.equal(lastWeek(new Date("2026-10-05T06:00:00Z")).week, "2026-W40");
});

const at = (iso) => ({ pushed_at: iso, result: "bypass" });
test("bypasses are counted inside the week only, per repository, and a repository with none is a zero", async () => {
  const data = { a: [at("2026-09-28T00:00:00Z"), at("2026-10-04T23:59:59Z"), at("2026-10-05T00:00:00Z")], b: [] };
  const r = await countBypasses({ repositories: ["a", "b"], suites: async (x) => ({ status: 200, items: data[x] }), from: new Date("2026-09-28T00:00:00Z"), to: new Date("2026-10-05T00:00:00Z") });
  assert.deepEqual(r, { bypasses: 2, repositories: { a: 2, b: 0 }, unread: [] });
});

test("a repository that cannot be read is unread, never a zero, and the run goes on", async () => {
  const r = await countBypasses({ repositories: ["a", "x"], suites: async (x) => (x === "x" ? { status: 403, items: [] } : { status: 200, items: [at("2026-09-29T10:00:00Z")] }), from: new Date("2026-09-28T00:00:00Z"), to: new Date("2026-10-05T00:00:00Z") });
  assert.deepEqual(r, { bypasses: 1, repositories: { a: 1 }, unread: ["x"] });
});

test("a result other than bypass is not counted", async () => {
  const r = await countBypasses({ repositories: ["a"], suites: async () => ({ status: 200, items: [{ pushed_at: "2026-09-29T10:00:00Z", result: "pass" }] }), from: new Date("2026-09-28T00:00:00Z"), to: new Date("2026-10-05T00:00:00Z") });
  assert.equal(r.bypasses, 0);
});

// The command runs against a fake API that answers the way GitHub does: the repositories on two
// pages, the second reached only through the Link header, one repository's rule suites on two
// pages the same way, and one repository refused with a 403, as robertblust/xiny answers. The
// process runs asynchronously, since a synchronous child would hold this process's event loop and
// the fake server could never answer it.
test("the command reads every page, names the unreadable repository, writes the object's keys and never prints the token", async () => {
  const token = "ghs_notarealtoken0123456789";
  const { from } = lastWeek(new Date());
  const inside = (hours) => new Date(from.getTime() + hours * 3600_000).toISOString();
  const before = new Date(from.getTime() - 3600_000).toISOString();
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, authorization: req.headers.authorization });
    const base = `http://127.0.0.1:${server.address().port}`;
    const json = (body, link) => {
      res.writeHead(200, { "content-type": "application/json", ...(link ? { link: `<${base}${link}>; rel="next", <${base}${link}>; rel="last"` } : {}) });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, base);
    if (url.pathname === "/installation/repositories") {
      if (url.searchParams.get("page") === "2") return json({ total_count: 3, repositories: [{ full_name: "org/x" }] });
      return json({ total_count: 3, repositories: [{ full_name: "org/a" }, { full_name: "org/b" }] }, "/installation/repositories?per_page=100&page=2");
    }
    if (url.pathname === "/repos/org/a/rulesets/rule-suites") {
      if (url.searchParams.get("page") === "2") return json([at(inside(30)), at(before)]);
      return json([at(inside(1)), at(inside(2))], "/repos/org/a/rulesets/rule-suites?time_period=month&rule_suite_result=bypass&per_page=100&page=2");
    }
    if (url.pathname === "/repos/org/b/rulesets/rule-suites") return json([]);
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Resource not accessible by integration" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bypasses-")), "week.json");
  try {
    const { stdout, stderr } = await promisify(execFile)("node", [new URL("../bin/bypasses.mjs", import.meta.url).pathname], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: token, ORGANIZATION: "org", OUT: out, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` },
    });
    const week = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.deepEqual(Object.keys(week).sort(), ["bypasses", "from", "kpi", "organization", "read_at", "repositories", "to", "unread", "week"]);
    assert.equal(week.kpi, "Ruleset Bypasses");
    assert.equal(week.organization, "org");
    assert.equal(week.week, lastWeek(new Date()).week);
    assert.equal(week.from, from.toISOString());
    assert.deepEqual(week.repositories, { "org/a": 3, "org/b": 0 });
    assert.deepEqual(week.unread, ["org/x"]);
    assert.equal(week.bypasses, 3);
    assert.ok(seen.every((r) => r.authorization === `Bearer ${token}`), "every request carries the token");
    assert.ok(seen.some((r) => r.url.includes("page=2") && r.url.startsWith("/installation/")), "the second page of repositories was read");
    assert.ok(seen.some((r) => r.url.includes("page=2") && r.url.startsWith("/repos/org/a/")), "the second page of rule suites was read");
    assert.ok(!stdout.includes("ghs_") && !stderr.includes("ghs_"), stdout + stderr);
    assert.match(stdout, /org\/x/);
  } finally {
    server.close();
  }
});

test("the command without its environment is one stderr line and exit 2", async () => {
  const err = await promisify(execFile)("node", [new URL("../bin/bypasses.mjs", import.meta.url).pathname], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  }).then(() => assert.fail("expected the process to exit non-zero"), (e) => e);
  assert.equal(err.code, 2);
  assert.equal(err.stderr.trim().split("\n").length, 1, err.stderr);
});
