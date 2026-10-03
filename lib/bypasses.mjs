// The week's count of ruleset bypasses across an organization's repositories, the value of the
// KPI Ruleset Bypasses. The week is the ISO week in UTC and the count filters each rule suite's
// pushed_at against it here, because the API's own time_period is relative to the moment of the
// request and would move a Monday run's window by however late it started. A repository whose
// rule suites cannot be read is named as unread and counted in no total: a zero would claim a
// week without a bypass that nobody saw.
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

// One call to suites per repository, in order, so a repository that answers with anything but 200
// is set aside as unread while the rest are still read.
export async function countBypasses({ repositories, suites, from, to }) {
  const counts = {};
  const unread = [];
  for (const repo of repositories) {
    const { status, items } = await suites(repo);
    if (status !== 200) { unread.push(repo); continue; }
    counts[repo] = items.filter((s) => {
      const at = new Date(s.pushed_at);
      return s.result === "bypass" && at >= from && at < to;
    }).length;
  }
  return { bypasses: Object.values(counts).reduce((a, b) => a + b, 0), repositories: counts, unread };
}
