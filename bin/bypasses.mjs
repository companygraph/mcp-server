#!/usr/bin/env node
// Writes the week's Ruleset Bypasses object of one organization to the file OUT names, for the
// weekly KPI workflow to upload. GITHUB_TOKEN is an installation token of the organization's
// GitHub App, so the repositories are the installation's, listed page by page, and each
// repository's rule suites with result bypass on its default branch are read for the past month,
// which always covers the ISO week that ended before a run on any day of the following week. Only
// the default branch counts, because the KPI counts changes that reached it with its required
// checks passed over, and a bypass on a working branch brings nothing there. The week is the one
// that ended before NOW, an ISO instant, when it is set, and before the moment of the run
// otherwise. The log is public, since the host repositories are, so it carries counts and full
// names (org/repo) and never the token: the token travels only in a request header. A missing
// variable, or a NOW that is no instant, is one line on stderr and exit 2; a listing GitHub
// refuses is one line and exit 1, since without it there is nothing to count; a request that
// throws, on the network or on a body that is not JSON, aborts the run with its error before any
// object is written, so a week is never kept from a partial reading.
import fs from "node:fs";
import { lastWeek, countBypasses } from "../lib/bypasses.mjs";

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

const { week, from, to } = lastWeek(now);
const listing = await pages(`${api}/installation/repositories?per_page=100`, (body) => body.repositories);
if (listing.status !== 200) {
  console.error(`bypasses: listing the installation's repositories answered ${listing.status}`);
  process.exit(1);
}
const repositories = listing.items.map((r) => r.full_name);
const branches = Object.fromEntries(listing.items.map((r) => [r.full_name, r.default_branch]));
const statuses = {};
const result = await countBypasses({
  repositories, from, to,
  suites: async (repo) => {
    const answer = await pages(`${api}/repos/${repo}/rulesets/rule-suites?time_period=month&rule_suite_result=bypass&ref=refs/heads/${encodeURIComponent(branches[repo])}&per_page=100`, (body) => body);
    statuses[repo] = answer.status;
    return answer;
  },
});

fs.writeFileSync(out, JSON.stringify({
  kpi: "Ruleset Bypasses", organization, week, from: from.toISOString(), to: to.toISOString(),
  bypasses: result.bypasses, repositories: result.repositories, unread: result.unread, read_at: new Date().toISOString(),
}, null, 2) + "\n");

console.log(`${organization} ${week}: ${result.bypasses} bypasses, ${Object.keys(result.repositories).length} read, ${result.unread.length} unread`);
// Every repository read is printed with its count, a zero included, so the log shows which
// repositories the week's value rests on as well as which it could not read.
for (const [repo, n] of Object.entries(result.repositories)) console.log(`  ${repo} ${n}`);
for (const repo of result.unread) console.log(`  unread ${repo} (${statuses[repo]})`);
