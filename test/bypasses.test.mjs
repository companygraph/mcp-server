import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isoWeek, lastWeek, countBypasses, classify, requiredCount } from "../lib/bypasses.mjs";

test("an ISO week runs Monday 00:00 to the next Monday 00:00 UTC, and week 1 holds the year's first Thursday", () => {
  assert.deepEqual(isoWeek(new Date("2026-10-02T12:00:00Z")), { week: "2026-W40", from: new Date("2026-09-28T00:00:00Z"), to: new Date("2026-10-05T00:00:00Z") });
  assert.equal(isoWeek(new Date("2027-01-01T00:00:00Z")).week, "2026-W53");
  assert.equal(isoWeek(new Date("2026-01-01T00:00:00Z")).week, "2026-W01");
});

test("the week that ended is the one before the week of now", () => {
  assert.equal(lastWeek(new Date("2026-10-05T06:00:00Z")).week, "2026-W40");
});

const at = (iso, extra = {}) => ({ pushed_at: iso, result: "bypass", ...extra });
const FROM_DATE = new Date("2026-09-28T00:00:00Z");
const TO_DATE = new Date("2026-10-05T00:00:00Z");
const allPast = async () => "past_checks";

test("bypasses are counted inside the week only, per repository and per kind, and a repository with none is a zero", async () => {
  const data = { a: [at("2026-09-28T00:00:00Z", { id: 1 }), at("2026-10-04T23:59:59Z", { id: 2 }), at("2026-10-05T00:00:00Z", { id: 3 })], b: [] };
  const classified = [];
  const kind = async (repo, suite) => { classified.push(suite.id); return suite.id === 1 ? "behind_main" : "past_checks"; };
  const r = await countBypasses({ repositories: ["a", "b"], suites: async (x) => ({ status: 200, items: data[x] }), kind, from: FROM_DATE, to: TO_DATE });
  assert.deepEqual(r, {
    bypasses: 2, past_checks: 1, behind_main: 1,
    repositories: { a: { bypasses: 2, past_checks: 1, behind_main: 1 }, b: { bypasses: 0, past_checks: 0, behind_main: 0 } },
    unread: [],
  });
  assert.deepEqual(classified, [1, 2], "a bypass outside the week is never classified");
});

test("a repository that cannot be read is unread, never a zero, and the run goes on", async () => {
  const r = await countBypasses({ repositories: ["a", "x"], suites: async (x) => (x === "x" ? { status: 403, items: [] } : { status: 200, items: [at("2026-09-29T10:00:00Z")] }), kind: allPast, from: FROM_DATE, to: TO_DATE });
  assert.deepEqual(r, { bypasses: 1, past_checks: 1, behind_main: 0, repositories: { a: { bypasses: 1, past_checks: 1, behind_main: 0 } }, unread: ["x"] });
});

test("a result other than bypass is not counted", async () => {
  const r = await countBypasses({ repositories: ["a"], suites: async () => ({ status: 200, items: [{ pushed_at: "2026-09-29T10:00:00Z", result: "pass" }] }), kind: allPast, from: FROM_DATE, to: TO_DATE });
  assert.equal(r.bypasses, 0);
});

// One bypass that is behind main and nothing else: every required check succeeded before the
// merge and main had moved on. Each case below changes one thing about it.
const MERGED = "2026-09-29T10:00:00Z";
// A run starts five minutes before it completes, so the latest run of a name by started_at is the
// state of that check at the merge.
const ok = (name, completed_at = "2026-09-29T09:50:00Z") => ({ name, status: "completed", conclusion: "success", started_at: new Date(new Date(completed_at).getTime() - 300_000).toISOString(), completed_at });
const behindMain = { merged_at: MERGED, head_sha: "h1", required: ["test", "lint"], runs: [ok("test"), ok("lint")], behind: 2, failed: ["required_status_checks"] };

test("a merge with every required check passed before it and main ahead is behind main", () => {
  assert.equal(classify(behindMain), "behind_main");
});

test("a run that completed at the very moment of the merge counts, and a success beside a failure of the same name does too", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test", MERGED), { ...ok("lint"), conclusion: "failure" }, ok("lint", "2026-09-29T09:55:00Z")] }), "behind_main");
});

test("a bypass with no pull request is past its checks", () => {
  assert.equal(classify({ ...behindMain, merged_at: null, head_sha: null }), "past_checks");
});

test("a required run that completed after the merge is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), ok("lint", "2026-09-29T10:00:01Z")] }), "past_checks");
});

test("a required run still running at the merge is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), { name: "lint", status: "in_progress", conclusion: null, started_at: "2026-09-29T09:45:00Z", completed_at: null }] }), "past_checks");
});

test("an earlier success superseded by a re-run still running at the merge is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), ok("lint"), { name: "lint", status: "in_progress", conclusion: null, started_at: "2026-09-29T09:55:00Z", completed_at: null }] }), "past_checks");
});

test("an earlier success superseded by a re-run that failed before the merge is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), ok("lint"), { name: "lint", status: "completed", conclusion: "failure", started_at: "2026-09-29T09:55:00Z", completed_at: "2026-09-29T09:58:00Z" }] }), "past_checks");
});

test("an earlier success superseded by a re-run still queued, neither started nor completed, is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), ok("lint"), { name: "lint", status: "queued", conclusion: null, started_at: null, completed_at: null }] }), "past_checks");
});

test("a run started after the merge does not stand for the check at the merge", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), ok("lint"), { name: "lint", status: "completed", conclusion: "failure", started_at: "2026-09-29T10:05:00Z", completed_at: "2026-09-29T10:08:00Z" }] }), "behind_main");
});

test("a failed required run is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test"), { ...ok("lint"), conclusion: "failure" }] }), "past_checks");
});

test("a required check with no run at all is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: [ok("test")] }), "past_checks");
});

test("a branch that was not behind main is past its checks, whether its checks passed or not", () => {
  assert.equal(classify({ ...behindMain, behind: 0, runs: [ok("test")] }), "past_checks");
  assert.equal(classify({ ...behindMain, behind: 0 }), "past_checks");
});

test("a bypassed rule other than required status checks is past its checks", () => {
  assert.equal(classify({ ...behindMain, failed: ["required_status_checks", "pull_request"] }), "past_checks");
});

test("a bypass whose pull request, runs, comparison, rules or rule suite could not be read is past its checks", () => {
  assert.equal(classify({ ...behindMain, runs: null }), "past_checks");
  assert.equal(classify({ ...behindMain, behind: null }), "past_checks");
  assert.equal(classify({ ...behindMain, required: null }), "past_checks");
  assert.equal(classify({ ...behindMain, failed: null }), "past_checks");
});

test("a branch whose rules name no required check is past its checks, since the bypass is then unexplained", () => {
  assert.equal(classify({ ...behindMain, required: [] }), "past_checks");
});

// When the ruleset's history cannot be read, as it cannot with an App's installation token, the
// rule suite's own count of the checks required at the merge stands in for today's rules. The
// first case is the shape of robertblust/mcp-blust-ch #57: three checks then required, all green
// before the merge, while today's rules name five.
const today = ["test", "lint", "build", "chat / build", "chat / terraform"];
const byCount = { ...behindMain, required: today, count: 3, runs: [ok("test"), ok("lint"), ok("build")] };

test("with the history unreadable, three distinct checks green before the merge meet a count of three although today's rules name five", () => {
  assert.equal(classify({ ...byCount, count: null }), "past_checks", "today's rules alone would judge it past its checks");
  assert.equal(classify(byCount), "behind_main");
});

test("with the history unreadable, two distinct checks green do not meet a count of three", () => {
  assert.equal(classify({ ...byCount, runs: [ok("test"), ok("lint"), ok("lint", "2026-09-29T09:55:00Z")] }), "past_checks");
});

test("with the history unreadable, a fourth run started before the merge and still in progress is past its checks", () => {
  assert.equal(classify({ ...byCount, runs: [...byCount.runs, { name: "docs", status: "in_progress", conclusion: null, started_at: "2026-09-29T09:45:00Z", completed_at: null }] }), "past_checks");
  assert.equal(classify({ ...byCount, runs: [...byCount.runs, { name: "docs", status: "queued", conclusion: null, started_at: null, completed_at: null }] }), "past_checks", "a queued run counts as started by the merge");
  assert.equal(classify({ ...byCount, runs: [...byCount.runs, { name: "docs", status: "completed", conclusion: "failure", started_at: "2026-09-29T10:05:00Z", completed_at: "2026-09-29T10:08:00Z" }] }), "behind_main", "a run started after the merge stands for nothing");
});

test("with the history unreadable, the count path still needs the branch behind and only required status checks failed", () => {
  assert.equal(classify({ ...byCount, behind: 0 }), "past_checks");
  assert.equal(classify({ ...byCount, failed: ["required_status_checks", "pull_request"] }), "past_checks");
  assert.equal(classify({ ...byCount, count: 0 }), "past_checks");
});

test("the count of required checks is read from the rule suite's required status checks evaluations, and is null when any cannot be parsed", () => {
  const checks = (details, enforcement = "active") => ({ rule_type: "required_status_checks", result: "fail", enforcement, details });
  assert.equal(requiredCount([checks("3 of 3 required status checks are expected."), { rule_type: "pull_request", result: "pass", details: null }]), 3);
  assert.equal(requiredCount([checks("1 of 2 required status checks are expected."), checks("2 of 4 required status checks are expected.")]), 6, "the rulesets' counts add up, the side a wrong guess can be undone from");
  assert.equal(requiredCount([checks("3 of 3 required status checks are expected."), checks("9 of 9 required status checks are expected.", "evaluate")]), 3, "an evaluate-mode ruleset requires nothing");
  assert.equal(requiredCount([checks("Required status checks are expected.")]), null);
  assert.equal(requiredCount([checks(null)]), null);
  assert.equal(requiredCount([checks("3 of 3 required status checks are expected."), checks("something else")]), null);
  assert.equal(requiredCount([]), null);
});

test("with the count unparseable, today's rules decide as before", () => {
  assert.equal(classify({ ...byCount, count: null, required: ["test", "lint", "build"] }), "behind_main");
  assert.equal(classify({ ...byCount, count: null }), "past_checks");
});

// The command runs against a fake API that answers the way GitHub does: the repositories on two
// pages, the second reached only through the Link header, one repository's rule suites on two
// pages the same way, and one repository refused with a 403, as robertblust/xiny answers. Each
// repository names its default branch, one of them with a slash in it, and every rule-suites
// request must ask for that branch's ref, since a bypass on another branch is no escape from the
// default branch's review. Each bypass in the week is then classified from its rule suite, its
// pull request, that head's check runs (one head's on two pages), the comparison with main as it
// stood before the push, and the required checks of the ruleset as it stood at the merge, read from
// the ruleset's history, or, when GitHub refuses that history to the App as it does in
// production, by the count of required checks the rule suite states. org/a holds one bypass behind
// main by its ruleset's history although today's rules require one more check, one with no pull
// request and one merged before a required check finished; org/b holds one that also passed over
// the pull-request rule, which is decided before its pull request is asked for, one whose check
// runs are refused, one whose only pull request was merged hours before the push, one behind main
// by its rule suite's count of one check although today's rules require two, because its
// ruleset's history is refused, and one with the same history refused whose rule suite states no
// count, so today's rules decide and it is past its checks. NOW fixes the week, so the test never reads the wall clock. The process runs
// asynchronously, since a synchronous child would hold this process's event loop and the fake
// server could never answer it.
const NOW = "2026-10-05T06:00:00Z";
const FROM = "2026-09-28T00:00:00.000Z";
const bin = new URL("../bin/bypasses.mjs", import.meta.url).pathname;
const run = (env) => promisify(execFile)("node", [bin], { encoding: "utf8", env: { ...process.env, NOW, ...env } });

test("the command reads every page of the default branch, classifies each bypass, names the unreadable repository, writes the object's keys and never prints the token", async () => {
  const token = "ghs_notarealtoken0123456789";
  const inside = (hours) => new Date(new Date(FROM).getTime() + hours * 3600_000).toISOString();
  const before = new Date(new Date(FROM).getTime() - 3600_000).toISOString();
  const branches = { "org/a": "main", "org/b": "release/v1", "org/x": "main" };
  const suite = (id, hours, sha) => at(inside(hours), { id, after_sha: `m${sha}`, before_sha: `p${sha}` });
  const statusOnly = [{ rule_type: "required_status_checks", result: "fail" }, { rule_type: "pull_request", result: "pass" }];
  // Bypass 11 also failed a rule in evaluate mode, which blocks nothing and must not make it past
  // its checks.
  const evaluateOnly = [{ rule_type: "required_status_checks", result: "fail", enforcement: "active", rule_source: { type: "ruleset", id: 7 } }, { rule_type: "pull_request", result: "fail", enforcement: "evaluate", rule_source: { type: "ruleset", id: 7 } }];
  const evaluations = { "org/a/11": evaluateOnly, "org/a/12": statusOnly, "org/a/13": statusOnly, "org/b/21": [{ rule_type: "required_status_checks", result: "fail" }, { rule_type: "pull_request", result: "fail" }], "org/b/22": statusOnly, "org/b/23": statusOnly, "org/b/24": [{ rule_type: "required_status_checks", result: "fail", rule_source: { type: "ruleset", id: 9 }, details: "1 of 1 required status checks are expected." }], "org/b/25": [{ rule_type: "required_status_checks", result: "fail", rule_source: { type: "ruleset", id: 9 }, details: null }] };
  const pr = (sha, merged_hours, base) => [{ number: Number(sha), merged_at: inside(merged_hours), merge_commit_sha: `m${sha}`, head: { sha: `h${sha}` }, base: { ref: base } }];
  const pulls = { "org/a/m11": pr("11", 2, "main"), "org/a/m12": [], "org/a/m13": pr("13", 31, "main"), "org/b/m21": pr("21", 5, "release/v1"), "org/b/m22": pr("22", 6, "release/v1"),
    // Bypass 23's commit lists only a pull request merged into the branch two hours before the
    // push, with another merge commit: a pull request that touched the commit, not the one that
    // made the push, so the bypass has no pull request and is past its checks.
    "org/b/m23": [{ ...pr("23", 6, "release/v1")[0], merge_commit_sha: "other" }],
    "org/b/m24": pr("24", 9, "release/v1"), "org/b/m25": pr("25", 10, "release/v1") };
  const success = (name, hours) => ({ name, status: "completed", conclusion: "success", started_at: inside(hours - 0.25), completed_at: inside(hours) });
  const runs = { "org/a/h13": [success("test", 30), success("lint", 31.5)], "org/b/h21": [success("test", 4)], "org/b/h23": [success("test", 5)], "org/b/h24": [success("test", 8.5)], "org/b/h25": [success("test", 9.5)] };
  // Ruleset 7 of org/a required test and lint when bypass 11 was merged, two hours into the week;
  // an older version also required ghost and a later one added build, which today's rules name.
  const versions = { 1: [before, ["test", "lint", "ghost"]], 2: [inside(0.5), ["test", "lint"]], 3: [inside(10), ["test", "lint", "build"]] };
  const checksRule = (contexts) => ({ type: "required_status_checks", parameters: { required_status_checks: contexts.map((context) => ({ context })) } });
  const seen = [];
  const refs = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, authorization: req.headers.authorization });
    const base = `http://127.0.0.1:${server.address().port}`;
    const json = (body, link) => {
      res.writeHead(200, { "content-type": "application/json", ...(link ? { link: `<${base}${link}>; rel="next", <${base}${link}>; rel="last"` } : {}) });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, base);
    if (url.pathname === "/installation/repositories") {
      const repo = (full_name) => ({ full_name, default_branch: branches[full_name] });
      if (url.searchParams.get("page") === "2") return json({ total_count: 3, repositories: [repo("org/x")] });
      return json({ total_count: 3, repositories: [repo("org/a"), repo("org/b")] }, "/installation/repositories?per_page=100&page=2");
    }
    const suites = url.pathname.match(/^\/repos\/(org\/[^/]+)\/rulesets\/rule-suites$/);
    if (suites) refs.push({ repo: suites[1], ref: url.searchParams.get("ref") });
    if (url.pathname === "/repos/org/a/rulesets/rule-suites") {
      if (url.searchParams.get("page") === "2") return json([suite(13, 30, "13"), at(before, { id: 10, after_sha: "m10", before_sha: "p10" })]);
      return json([suite(11, 1, "11"), suite(12, 2, "12")], "/repos/org/a/rulesets/rule-suites?time_period=month&rule_suite_result=bypass&ref=refs%2Fheads%2Fmain&per_page=100&page=2");
    }
    if (url.pathname === "/repos/org/b/rulesets/rule-suites") return json([suite(21, 4, "21"), suite(22, 6, "22"), suite(23, 8, "23"), suite(24, 9, "24"), suite(25, 10, "25")]);
    let m;
    if ((m = url.pathname.match(/^\/repos\/(org\/[ab])\/rulesets\/rule-suites\/(\d+)$/))) return json({ id: Number(m[2]), result: "bypass", rule_evaluations: evaluations[`${m[1]}/${m[2]}`] });
    if ((m = url.pathname.match(/^\/repos\/(org\/[ab])\/commits\/([^/]+)\/pulls$/))) return json(pulls[`${m[1]}/${m[2]}`]);
    if (url.pathname === "/repos/org/a/commits/h11/check-runs") {
      assert.equal(url.searchParams.get("filter"), "all");
      if (url.searchParams.get("page") === "2") return json({ total_count: 2, check_runs: [success("lint", 1.5)] });
      return json({ total_count: 2, check_runs: [success("test", 1)] }, "/repos/org/a/commits/h11/check-runs?filter=all&per_page=100&page=2");
    }
    if ((m = url.pathname.match(/^\/repos\/(org\/[ab])\/commits\/(h1[13]|h2[1345])\/check-runs$/))) return json({ total_count: 0, check_runs: runs[`${m[1]}/${m[2]}`] });
    if ((m = url.pathname.match(/^\/repos\/(org\/[ab])\/compare\/(h\d+)\.\.\.(p\d+)$/))) return json({ ahead_by: 2, behind_by: 1, status: "diverged" });
    if (url.pathname === "/repos/org/a/rulesets/7/history") return json(Object.entries(versions).reverse().map(([version_id, [updated_at]]) => ({ version_id: Number(version_id), updated_at })));
    if ((m = url.pathname.match(/^\/repos\/org\/a\/rulesets\/7\/history\/(\d)$/))) {
      const [updated_at, contexts] = versions[m[1]];
      return json({ version_id: Number(m[1]), updated_at, state: { id: 7, name: "protect-main", rules: [{ type: "pull_request", parameters: {} }, checksRule(contexts)] } });
    }
    if (url.pathname === "/repos/org/a/rules/branches/main") return json([{ type: "pull_request", parameters: {} }, checksRule(["test", "lint", "build"])]);
    if (url.pathname === "/repos/org/b/rules/branches/release/v1") return json([checksRule(["test", "build"])]);
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Resource not accessible by integration" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bypasses-")), "week.json");
  try {
    const { stdout, stderr } = await run({ GITHUB_TOKEN: token, ORGANIZATION: "org", OUT: out, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` });
    const week = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.deepEqual(Object.keys(week), ["kpi", "organization", "week", "from", "to", "bypasses", "past_checks", "behind_main", "repositories", "unread", "read_at"]);
    assert.equal(week.kpi, "Merges Past Their Checks");
    assert.equal(week.organization, "org");
    assert.equal(week.week, "2026-W40");
    assert.equal(week.from, FROM);
    assert.deepEqual(week.repositories, {
      "org/a": { bypasses: 3, past_checks: 2, behind_main: 1 },
      "org/b": { bypasses: 5, past_checks: 4, behind_main: 1 },
    });
    assert.deepEqual(week.unread, ["org/x"]);
    assert.equal(week.past_checks, 6);
    assert.equal(week.behind_main, 2);
    assert.equal(week.bypasses, week.past_checks + week.behind_main);
    for (const counts of Object.values(week.repositories)) assert.equal(counts.bypasses, counts.past_checks + counts.behind_main);
    assert.ok(seen.every((r) => r.authorization === `Bearer ${token}`), "every request carries the token");
    assert.ok(seen.some((r) => r.url.includes("page=2") && r.url.startsWith("/installation/")), "the second page of repositories was read");
    assert.ok(seen.some((r) => r.url.includes("page=2") && r.url.startsWith("/repos/org/a/rulesets/")), "the second page of rule suites was read");
    assert.ok(seen.some((r) => r.url.includes("page=2") && r.url.startsWith("/repos/org/a/commits/h11/check-runs")), "the second page of check runs was read");
    assert.ok(seen.some((r) => r.url === "/repos/org/a/compare/h11...p11?per_page=1"), "main is compared as it stood before the push");
    assert.ok(!seen.some((r) => r.url.includes("m10") || r.url.includes("rule-suites/10")), "a bypass outside the week is never classified");
    assert.equal(seen.filter((r) => r.url.startsWith("/repos/org/a/rules/branches/")).length, 1, "a branch's rules are read once per repository");
    assert.ok(seen.some((r) => r.url.startsWith("/repos/org/a/rulesets/7/history/2")), "the ruleset is read as it stood at the merge");
    assert.ok(!seen.some((r) => /\/history\/[13]/.test(r.url)), "no other version of the ruleset is read");
    assert.ok(seen.some((r) => r.url.startsWith("/repos/org/b/rulesets/9/history?")), "the refused history was asked for first");
    assert.ok(seen.some((r) => r.url.startsWith("/repos/org/b/rules/branches/release/v1")), "today's rules stand in when the history is refused and the rule suite states no count");
    assert.ok(!seen.some((r) => r.url.startsWith("/repos/org/b/commits/m21/")), "a bypass its failed rules decide asks nothing more");
    assert.equal(refs.length, 4, JSON.stringify(refs));
    for (const { repo, ref } of refs) assert.equal(ref, `refs/heads/${branches[repo]}`, `${repo} asks for its default branch`);
    assert.ok(!stdout.includes("ghs_") && !stderr.includes("ghs_"), stdout + stderr);
    assert.match(stdout, /^ {2}org\/a 3 bypasses, 2 past their checks, 1 behind main$/m);
    assert.match(stdout, /^ {2}org\/b 5 bypasses, 4 past their checks, 1 behind main$/m);
    assert.match(stdout, /org\/x/);
  } finally {
    server.close();
  }
});

// Three bypasses in org/c, each naming two active rulesets, 5 and 6, and an evaluate-mode
// ruleset 8 whose history is refused. Ruleset 5 required docs at the merge, a version found only
// on the second page of its history, and ruleset 6 required test; today's rules require build,
// which never ran. Bypass 31 passed docs and test and is behind main, which it can be only if the
// second page was read, ruleset 8 added nothing and today's rules did not stand in; bypass 32
// lacks docs and bypass 33 lacks test, so each ruleset's checks count.
test("the required checks unite the rulesets in force at the merge, read across history pages, and an evaluate-mode ruleset adds none", async () => {
  const inside = (hours) => new Date(new Date(FROM).getTime() + hours * 3600_000).toISOString();
  const before = new Date(new Date(FROM).getTime() - 3600_000).toISOString();
  const success = (name, hours) => ({ name, status: "completed", conclusion: "success", started_at: inside(hours - 0.25), completed_at: inside(hours) });
  const checksRule = (contexts) => ({ type: "required_status_checks", parameters: { required_status_checks: contexts.map((context) => ({ context })) } });
  const evaluation = (id, enforcement = "active") => ({ rule_type: "required_status_checks", result: "fail", enforcement, rule_source: { type: "ruleset", id } });
  const runs = { h31: [success("docs", 1), success("test", 1)], h32: [success("test", 2)], h33: [success("docs", 3)] };
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);
    const base = `http://127.0.0.1:${server.address().port}`;
    const json = (body, link) => {
      res.writeHead(200, { "content-type": "application/json", ...(link ? { link: `<${base}${link}>; rel="next"` } : {}) });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, base);
    let m;
    if (url.pathname === "/installation/repositories") return json({ total_count: 1, repositories: [{ full_name: "org/c", default_branch: "main" }] });
    if (url.pathname === "/repos/org/c/rulesets/rule-suites") return json([31, 32, 33].map((id, i) => at(inside(i + 1.5), { id, after_sha: `m${id}`, before_sha: `p${id}` })));
    if ((m = url.pathname.match(/^\/repos\/org\/c\/rulesets\/rule-suites\/(\d+)$/))) return json({ id: Number(m[1]), rule_evaluations: [evaluation(5), evaluation(6), evaluation(8, "evaluate")] });
    if ((m = url.pathname.match(/^\/repos\/org\/c\/commits\/m(\d+)\/pulls$/))) return json([{ number: Number(m[1]), merged_at: inside(Number(m[1]) - 29.5), merge_commit_sha: `m${m[1]}`, head: { sha: `h${m[1]}` }, base: { ref: "main" } }]);
    if ((m = url.pathname.match(/^\/repos\/org\/c\/commits\/(h\d+)\/check-runs$/))) return json({ total_count: 0, check_runs: runs[m[1]] });
    if (url.pathname.startsWith("/repos/org/c/compare/")) return json({ ahead_by: 1 });
    if (url.pathname === "/repos/org/c/rulesets/5/history") {
      if (url.searchParams.get("page") === "2") return json([{ version_id: 51, updated_at: before }]);
      return json([{ version_id: 52, updated_at: inside(50) }], "/repos/org/c/rulesets/5/history?per_page=100&page=2");
    }
    if (url.pathname === "/repos/org/c/rulesets/5/history/51") return json({ version_id: 51, state: { rules: [checksRule(["docs"])] } });
    if (url.pathname === "/repos/org/c/rulesets/5/history/52") return json({ version_id: 52, state: { rules: [checksRule(["docs", "late"])] } });
    if (url.pathname === "/repos/org/c/rulesets/6/history") return json([{ version_id: 61, updated_at: before }]);
    if (url.pathname === "/repos/org/c/rulesets/6/history/61") return json({ version_id: 61, state: { rules: [checksRule(["test"])] } });
    if (url.pathname === "/repos/org/c/rules/branches/main") return json([checksRule(["build"])]);
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Resource not accessible by integration" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bypasses-")), "week.json");
  try {
    await run({ GITHUB_TOKEN: "ghs_notarealtoken0123456789", ORGANIZATION: "org", OUT: out, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` });
    assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")).repositories, { "org/c": { bypasses: 3, past_checks: 2, behind_main: 1 } });
    assert.ok(seen.some((u) => u.startsWith("/repos/org/c/rulesets/5/history?") && u.includes("page=2")), "the second page of the history was read");
    assert.ok(!seen.some((u) => u.startsWith("/repos/org/c/rulesets/8/")), "an evaluate-mode ruleset is never read");
    assert.ok(!seen.some((u) => u.startsWith("/repos/org/c/rules/branches/")), "today's rules do not stand in");
    assert.equal(seen.filter((u) => u.startsWith("/repos/org/c/rulesets/6/history/61")).length, 1, "a version is read once");
  } finally {
    server.close();
  }
});

test("a repository read with no bypass is printed with three zeros", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url.startsWith("/installation/") ? { total_count: 1, repositories: [{ full_name: "org/c", default_branch: "main" }] } : []));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bypasses-")), "week.json");
  try {
    const { stdout } = await run({ GITHUB_TOKEN: "ghs_notarealtoken0123456789", ORGANIZATION: "org", OUT: out, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` });
    assert.match(stdout, /^ {2}org\/c 0 bypasses, 0 past their checks, 0 behind main$/m);
    assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")).repositories, { "org/c": { bypasses: 0, past_checks: 0, behind_main: 0 } });
  } finally {
    server.close();
  }
});

test("a repository listing answered with anything but 200 is one stderr line, exit 1 and no object", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Bad credentials" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bypasses-")), "week.json");
  try {
    const err = await run({ GITHUB_TOKEN: "ghs_notarealtoken0123456789", ORGANIZATION: "org", OUT: out, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` })
      .then(() => assert.fail("expected the process to exit non-zero"), (e) => e);
    assert.equal(err.code, 1);
    assert.equal(err.stderr.trim().split("\n").length, 1, err.stderr);
    assert.ok(!fs.existsSync(out), "no object is written");
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
