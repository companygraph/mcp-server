#!/usr/bin/env node
// Writes the week's Merges Past Their Checks object of one organization to the file OUT names,
// for the weekly KPI workflow to upload. GITHUB_TOKEN is an installation token of the
// organization's GitHub App, so the repositories are the installation's, listed page by page, and
// each repository's rule suites with result bypass on its default branch are read for the past
// month, which always covers the ISO week that ended before a run on any day of the following
// week. Only the default branch counts, because the KPI counts changes that reached it with its
// required checks passed over, and a bypass on a working branch brings nothing there. Each bypass
// in the week is then classified from its rule suite's failed rules, the pull request that made
// its commit, that head's check runs, the comparison of the head with the default branch as it
// stood before the push, and the checks its rulesets required at the merge, read from each
// ruleset's history, since a ruleset that gained a check later would otherwise judge an earlier
// merge by a check it never had: a pull request whose required checks
// had all succeeded before the merge and whose branch was behind is behind main, anything else is
// past its checks. A bypass whose pull request, runs, comparison, rules or rule suite cannot be
// read is past its checks, and its repository still counts as read. The week is the one that
// ended before NOW, an ISO instant, when it is set, and before the moment of the run otherwise.
// The log is public, since the host repositories are, so it carries counts and full names
// (org/repo) and never the token: the token travels only in a request header. A missing variable,
// or a NOW that is no instant, is one line on stderr and exit 2; a listing GitHub refuses is one
// line and exit 1, since without it there is nothing to count; a request that throws, on the
// network or on a body that is not JSON, aborts the run with its error before any object is
// written, so a week is never kept from a partial reading.
// Two limits follow from what GitHub keeps. When a ruleset's history cannot be read, or the rule
// suite names no ruleset for its required checks, the required checks are the branch's rules as
// they stand when the job runs, not as they stood at the merge, so a check added or removed since
// then is judged by today's rules. That includes every organization-level ruleset, whose history
// the repository endpoint read here does not answer; the family's rulesets are the repositories'
// own. A ruleset in evaluate mode blocks nothing and adds no required check. And a check run is matched to a required check by its name
// alone, not by the app that made it, so a run of the same name from another app would satisfy it.
import fs from "node:fs";
import { lastWeek, countBypasses, classify } from "../lib/bypasses.mjs";

const { GITHUB_TOKEN: token, ORGANIZATION: organization, OUT: out } = process.env;
const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const missing = ["GITHUB_TOKEN", "ORGANIZATION", "OUT"].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`bypasses: ${missing.join(", ")} must be set`);
  process.exit(2);
}

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`bypasses: NOW must be an ISO instant, not ${process.env.NOW}`);
  process.exit(2);
}

const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
const next = (link) => link?.split(",").map((part) => part.match(/<([^>]+)>;\s*rel="next"/)).find(Boolean)?.[1];

// Every page of one listing, following the Link header GitHub sends while a next page exists. A
// page answered with anything but 200 ends the listing with that status and no items, so a
// repository refused half-way is unread rather than counted from its first page alone.
async function pages(url, itemsOf) {
  const items = [];
  while (url) {
    const res = await fetch(url, { headers });
    if (res.status !== 200) { await res.body?.cancel(); return { status: res.status, items: [] }; }
    items.push(...itemsOf(await res.json()));
    url = next(res.headers.get("link"));
  }
  return { status: 200, items };
}

// One request, with its body when it answered 200.
async function get(url) {
  const res = await fetch(url, { headers });
  if (res.status !== 200) { await res.body?.cancel(); return { status: res.status }; }
  return { status: 200, body: await res.json() };
}

// A branch name goes into a path segment by segment, so release/v1 keeps its slash the way
// GitHub's branch paths expect it.
const branchPath = (branch) => branch.split("/").map(encodeURIComponent).join("/");

const { week, from, to } = lastWeek(now);
const listing = await pages(`${api}/installation/repositories?per_page=100`, (body) => body.repositories);
if (listing.status !== 200) {
  console.error(`bypasses: listing the installation's repositories answered ${listing.status}`);
  process.exit(1);
}
const repositories = listing.items.map((r) => r.full_name);
const branches = Object.fromEntries(listing.items.map((r) => [r.full_name, r.default_branch]));
const statuses = {};

// The contexts the default branch's rules require, read once per repository and null when the
// rules cannot be read.
const required = {};
async function requiredOf(repo) {
  if (!(repo in required)) {
    const answer = await pages(`${api}/repos/${repo}/rules/branches/${branchPath(branches[repo])}?per_page=100`, (body) => body);
    required[repo] = answer.status !== 200 ? null : contextsOf(answer.items);
  }
  return required[repo];
}

const contextsOf = (rules) => rules
  .filter((rule) => rule.type === "required_status_checks")
  .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
  .map((check) => check.context);

// A ruleset's versions, listed once per ruleset, and a version's required contexts, read once per
// version; each is null when GitHub refuses it.
const histories = {};
const versionChecks = {};
async function historyOf(repo, id) {
  const key = `${repo}#${id}`;
  if (!(key in histories)) {
    const answer = await pages(`${api}/repos/${repo}/rulesets/${id}/history?per_page=100`, (body) => body);
    histories[key] = answer.status === 200 ? answer.items : null;
  }
  return histories[key];
}
async function contextsAt(repo, id, version) {
  const key = `${repo}#${id}#${version}`;
  if (!(key in versionChecks)) {
    const answer = await get(`${api}/repos/${repo}/rulesets/${id}/history/${version}`);
    versionChecks[key] = answer.status === 200 ? contextsOf(answer.body.state?.rules ?? []) : null;
  }
  return versionChecks[key];
}

// The contexts required at the merge: for each ruleset whose required status checks the rule
// suite evaluated, its latest version updated at or before merged_at. Today's rules stand in for
// all of them when the suite names no such ruleset, or when any history or version cannot be read
// or holds no version from before the merge, since a mix of past and present rules would match
// neither.
async function requiredAt(repo, rulesets, merged_at) {
  if (!rulesets.length) return requiredOf(repo);
  const merged = new Date(merged_at);
  const contexts = new Set();
  for (const id of rulesets) {
    const versions = (await historyOf(repo, id))?.filter((v) => new Date(v.updated_at) <= merged);
    if (!versions?.length) return requiredOf(repo);
    const latest = versions.reduce((a, b) => (new Date(b.updated_at) > new Date(a.updated_at) ? b : a));
    const at = await contextsAt(repo, id, latest.version_id);
    if (!at) return requiredOf(repo);
    for (const context of at) contexts.add(context);
  }
  return [...contexts];
}

// How far from the push a pull request found only by its base branch may have been merged and
// still be the one that made it.
const FALLBACK_WINDOW = 10 * 60 * 1000;

// One bypass, classified. The failed rules leave out a rule in evaluate mode, which blocks nothing
// and so was not bypassed. The pull request is the merged one whose merge commit is the pushed
// commit, or failing that a merged one into the default branch, since a squash or rebase merge
// still lists the pull request it came from, as long as it was merged within ten minutes of the
// push; a pull request merged further from it only touched the commit, so the bypass has none.
// The comparison runs from the head to before_sha, the default branch as it stood just before the
// push, because main today already holds the merge and every branch would look behind it; ahead_by
// is then the commits main had that the branch lacked, and one commit per page is asked for since
// nothing else of the answer is read. The check runs are asked for with filter=all, since the
// default answers only each name's latest run and a re-run after the merge would hide the state
// the check was in when the merge went through. A bypass the failed rules already decide, because
// the rule suite cannot be read or a rule other than required status checks was passed over, is
// classified at once and asks GitHub nothing more.
async function kind(repo, suite) {
  const detail = await get(`${api}/repos/${repo}/rulesets/rule-suites/${suite.id}`);
  const evaluations = detail.status === 200 ? detail.body.rule_evaluations ?? [] : [];
  const failed = detail.status !== 200 ? null : evaluations
    .filter((e) => e.result === "fail" && e.enforcement !== "evaluate")
    .map((e) => e.rule_type);
  const none = { merged_at: null, head_sha: null, required: null, runs: null, behind: null, failed };
  if (!failed || failed.some((type) => type !== "required_status_checks")) return classify(none);
  const rulesets = [...new Set(evaluations
    .filter((e) => e.rule_type === "required_status_checks" && e.enforcement !== "evaluate" && e.rule_source?.type === "ruleset" && e.rule_source.id != null)
    .map((e) => e.rule_source.id))];
  const pulls = await get(`${api}/repos/${repo}/commits/${suite.after_sha}/pulls`);
  const merged = pulls.status === 200 ? pulls.body.filter((p) => p.merged_at) : [];
  const near = (p) => Math.abs(new Date(p.merged_at) - new Date(suite.pushed_at)) <= FALLBACK_WINDOW;
  const pr = merged.find((p) => p.merge_commit_sha === suite.after_sha) ?? merged.find((p) => p.base?.ref === branches[repo] && near(p));
  if (!pr) return classify(none);
  const runs = await pages(`${api}/repos/${repo}/commits/${pr.head.sha}/check-runs?filter=all&per_page=100`, (body) => body.check_runs);
  const comparison = await get(`${api}/repos/${repo}/compare/${pr.head.sha}...${suite.before_sha}?per_page=1`);
  return classify({
    merged_at: pr.merged_at,
    head_sha: pr.head.sha,
    required: await requiredAt(repo, rulesets, pr.merged_at),
    runs: runs.status === 200 ? runs.items : null,
    behind: comparison.status === 200 ? comparison.body.ahead_by : null,
    failed,
  });
}

const result = await countBypasses({
  repositories, from, to, kind,
  suites: async (repo) => {
    const answer = await pages(`${api}/repos/${repo}/rulesets/rule-suites?time_period=month&rule_suite_result=bypass&ref=refs/heads/${encodeURIComponent(branches[repo])}&per_page=100`, (body) => body);
    statuses[repo] = answer.status;
    return answer;
  },
});

fs.writeFileSync(out, JSON.stringify({
  kpi: "Merges Past Their Checks", organization, week, from: from.toISOString(), to: to.toISOString(),
  bypasses: result.bypasses, past_checks: result.past_checks, behind_main: result.behind_main,
  repositories: result.repositories, unread: result.unread, read_at: new Date().toISOString(),
}, null, 2) + "\n");

const line = (c) => `${c.bypasses} bypasses, ${c.past_checks} past their checks, ${c.behind_main} behind main`;
console.log(`${organization} ${week}: ${line(result)}, ${Object.keys(result.repositories).length} read, ${result.unread.length} unread`);
// Every repository read is printed with its counts, zeros included, so the log shows which
// repositories the week's value rests on as well as which it could not read.
for (const [repo, c] of Object.entries(result.repositories)) console.log(`  ${repo} ${line(c)}`);
for (const repo of result.unread) console.log(`  unread ${repo} (${statuses[repo]})`);
