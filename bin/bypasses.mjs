#!/usr/bin/env node
// Writes the week's Ruleset Bypasses object of one organization to the file OUT names, for the
// weekly KPI workflow to upload. GITHUB_TOKEN is an installation token of the organization's
// GitHub App, so the repositories are the installation's, listed page by page, and each
// repository's rule suites with result bypass are read for the past month, which always covers
// the ISO week that ended before a run on any day of the following week. The log is public, since
// the host repositories are, so it carries counts and repository names and never the token: the
// token travels only in a request header. A missing variable is one line on stderr and exit 2; a
// listing GitHub refuses is one line and exit 1, since without it there is nothing to count.
import fs from "node:fs";
import { lastWeek, countBypasses } from "../lib/bypasses.mjs";

const { GITHUB_TOKEN: token, ORGANIZATION: organization, OUT: out } = process.env;
const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const missing = ["GITHUB_TOKEN", "ORGANIZATION", "OUT"].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`bypasses: ${missing.join(", ")} must be set`);
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

const now = new Date();
const { week, from, to } = lastWeek(now);
const listing = await pages(`${api}/installation/repositories?per_page=100`, (body) => body.repositories);
if (listing.status !== 200) {
  console.error(`bypasses: listing the installation's repositories answered ${listing.status}`);
  process.exit(1);
}
const repositories = listing.items.map((r) => r.full_name);
const statuses = {};
const result = await countBypasses({
  repositories, from, to,
  suites: async (repo) => {
    const answer = await pages(`${api}/repos/${repo}/rulesets/rule-suites?time_period=month&rule_suite_result=bypass&per_page=100`, (body) => body);
    statuses[repo] = answer.status;
    return answer;
  },
});

fs.writeFileSync(out, JSON.stringify({
  kpi: "Ruleset Bypasses", organization, week, from: from.toISOString(), to: to.toISOString(),
  bypasses: result.bypasses, repositories: result.repositories, unread: result.unread, read_at: now.toISOString(),
}, null, 2) + "\n");

console.log(`${organization} ${week}: ${result.bypasses} bypasses, ${Object.keys(result.repositories).length} read, ${result.unread.length} unread`);
for (const [repo, n] of Object.entries(result.repositories)) if (n > 0) console.log(`  ${repo} ${n}`);
for (const repo of result.unread) console.log(`  unread ${repo} (${statuses[repo]})`);
