// The week's ruleset bypasses across an organization's repositories, each classified as behind
// main or past its checks, the second count being the value of the KPI Merges Past Their Checks.
// The week is the ISO week in UTC and the count filters each rule suite's pushed_at against it
// here, because the API's own time_period is relative to the moment of the request and would move
// a Monday run's window by however late it started. A repository whose rule suites cannot be read
// is named as unread and counted in no total: a zero would claim a week without a bypass that
// nobody saw.
const DAY = 24 * 3600 * 1000;

// The ISO week holding the date: Monday 00:00 UTC to the next Monday 00:00 UTC, numbered in the
// week-year of its Thursday, so the days of a week that straddles the new year share one name and
// week 1 is the one holding the year's first Thursday.
export function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const from = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
  const thursday = new Date(from.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const number = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1;
  return { week: `${year}-W${String(number).padStart(2, "0")}`, from, to: new Date(from.getTime() + 7 * DAY) };
}

// The week that ended before now: the one a Monday run reports, whatever hour it starts.
export function lastWeek(now) {
  return isoWeek(new Date(now.getTime() - 7 * DAY));
}

// Whether one bypass went past a check, or only merged a branch that was behind main with every
// required check passed. merged_at and head_sha are the pull request's, null when the change
// reached the branch without one; required is the contexts the branch's rules name; runs is the
// head's check runs; behind is how many commits main had that the branch lacked; failed is the
// rule types the rule suite records as failed, and when it is left out the rule types are not
// looked at. Any of the last four is null when it could not be read, and a bypass that cannot be
// classified is past its checks, the side a wrong guess can be undone from. A branch whose rules
// name no required check is past its checks too, since its bypass is then left unexplained by the
// one cause behind main stands for. A required check's state at the merge is its latest run by
// started_at among those that had started by merged_at, and it passed only when that run had
// completed with success by the merge: a success superseded by a re-run still running or failed at
// the merge does not count, and a check still running when the merge went through is past its
// checks even if it passed a minute later. A run started after the merge stands for nothing. A run
// with neither started_at nor completed_at is queued and is taken as started by the merge and the
// latest of its name, so the check was not complete; a run with only completed_at is placed by it.
// count, when it is a number, is how many checks the rule suite says were required at the merge,
// given when the rulesets' history cannot be read, as it cannot with an App's installation token,
// so that a check added since is not held against an earlier merge. required is then today's
// rules, which name a superset of the checks required at the merge when checks were only added
// since: every check started by the merge must have passed, and at least count distinct names of
// them must be ones today's rules require, so a green run no rule asks for today never stands in
// for a required check that did not run. A check today's rules require that was not required at
// the merge still can: if it ran green on the pull request, it counts in place of a then-required
// check that never started, since the count alone cannot tell the two apart. A check removed or
// renamed since the merge fails to count, which leaves the merge past its checks, the side a wrong
// guess can be undone from.
export function classify({ merged_at, head_sha, required, count = null, runs, behind, failed = [] }) {
  if (!merged_at || !head_sha) return "past_checks";
  const byCount = typeof count === "number";
  if (!Array.isArray(required) || !Array.isArray(runs) || !Array.isArray(failed) || typeof behind !== "number") return "past_checks";
  if (failed.some((type) => type !== "required_status_checks")) return "past_checks";
  if ((byCount ? count <= 0 : required.length === 0) || behind <= 0) return "past_checks";
  const merged = new Date(merged_at);
  const passed = (name) => {
    const named = runs.filter((r) => r.name === name);
    if (named.some((r) => !r.started_at && !r.completed_at)) return false;
    const startOf = (r) => new Date(r.started_at || r.completed_at);
    const started = named.filter((r) => startOf(r) <= merged);
    if (!started.length) return false;
    const last = started.reduce((a, b) => (startOf(b) > startOf(a) ? b : a));
    return last.conclusion === "success" && Boolean(last.completed_at) && new Date(last.completed_at) <= merged;
  };
  if (!byCount) return required.every(passed) ? "behind_main" : "past_checks";
  const queued = (r) => !r.started_at && !r.completed_at;
  const started = [...new Set(runs.filter((r) => queued(r) || new Date(r.started_at || r.completed_at) <= merged).map((r) => r.name))];
  const counted = started.filter((name) => required.includes(name));
  return counted.length >= count && started.every(passed) ? "behind_main" : "past_checks";
}

// How many checks the rule suite's required status checks evaluations say were required at the
// merge, read from details such as "3 of 3 required status checks are expected.", or its singular
// "1 of 1 required status check is expected.", or "Required status check "test" is expected.",
// which names one check, the one place an App's installation token can see the rules as they stood
// then. Only evaluations that failed are read, since the bypass passed over those, and a passed
// one's details need not carry the count and would otherwise void it. The counts of several
// rulesets are added, since their checks may overlap and a sum too high only leaves a merge past
// its checks, the side a wrong guess can be undone from; an evaluation in evaluate mode requires
// nothing. It is null when there is no such evaluation or any of them cannot be parsed, so today's
// rules decide.
export function requiredCount(evaluations) {
  const checks = (evaluations ?? []).filter((e) => e.rule_type === "required_status_checks" && e.result === "fail" && e.enforcement !== "evaluate");
  if (!checks.length) return null;
  let total = 0;
  for (const e of checks) {
    const details = typeof e.details === "string" ? e.details : "";
    const n = details.match(/\b\d+ of (\d+) required status checks?\b/);
    if (n) total += Number(n[1]);
    else if (/\bRequired status check "[^"]+" is expected\b/.test(details)) total += 1;
    else return null;
  }
  return total;
}

// One call to suites per repository, in order, so a repository that answers with anything but 200
// is set aside as unread while the rest are still read. Each bypass inside the week is then put
// to kind, and anything it answers but "behind_main" is counted past its checks; a bypass outside
// the week is never classified, so a run asks GitHub nothing about changes it does not count.
export async function countBypasses({ repositories, suites, kind, from, to }) {
  const counts = {};
  const unread = [];
  for (const repo of repositories) {
    const { status, items } = await suites(repo);
    if (status !== 200) { unread.push(repo); continue; }
    const counted = { bypasses: 0, past_checks: 0, behind_main: 0 };
    for (const s of items) {
      const at = new Date(s.pushed_at);
      if (s.result !== "bypass" || at < from || at >= to) continue;
      counted[(await kind(repo, s)) === "behind_main" ? "behind_main" : "past_checks"] += 1;
      counted.bypasses += 1;
    }
    counts[repo] = counted;
  }
  const sum = (key) => Object.values(counts).reduce((a, c) => a + c[key], 0);
  return { bypasses: sum("bypasses"), past_checks: sum("past_checks"), behind_main: sum("behind_main"), repositories: counts, unread };
}
