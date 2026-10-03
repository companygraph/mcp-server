export type CheckRun = {
    name: string;
    started_at?: string | null;
    completed_at?: string | null;
    conclusion?: string | null;
};
export type RuleSuite = {
    pushed_at: string;
    result: string;
};
export type RuleEvaluation = {
    rule_type?: string;
    result?: string;
    enforcement?: string;
    details?: unknown;
};
export type BypassKind = "behind_main" | "past_checks";
/**
 * One check run of a head commit, as GitHub lists it.
 * @typedef {{ name: string; started_at?: string | null; completed_at?: string | null; conclusion?: string | null }} CheckRun
 */
/**
 * One rule suite evaluation of a push to a branch, as GitHub lists it.
 * @typedef {{ pushed_at: string; result: string }} RuleSuite
 */
/**
 * One rule's evaluation within a rule suite.
 * @typedef {{ rule_type?: string; result?: string; enforcement?: string; details?: unknown }} RuleEvaluation
 */
/**
 * What a bypass was: only a branch behind main, or past the checks.
 * @typedef {"behind_main" | "past_checks"} BypassKind
 */
/** @param {Date} date */
export declare function isoWeek(date: Date): {
    week: string;
    from: Date;
    to: Date;
};
/** @param {Date} now */
export declare function lastWeek(now: Date): {
    week: string;
    from: Date;
    to: Date;
};
/**
 * @param {{ merged_at?: string | null; head_sha?: string | null; required?: string[] | null; count?: number | null; runs?: CheckRun[] | null; behind?: number | null; failed?: string[] | null }} bypass
 * @returns {BypassKind}
 */
export declare function classify({ merged_at, head_sha, required, count, runs, behind, failed }: {
    merged_at?: string | null;
    head_sha?: string | null;
    required?: string[] | null;
    count?: number | null;
    runs?: CheckRun[] | null;
    behind?: number | null;
    failed?: string[] | null;
}): BypassKind;
/** @param {RuleEvaluation[] | null | undefined} evaluations */
export declare function requiredCount(evaluations: RuleEvaluation[] | null | undefined): number | null;
/**
 * @template {RuleSuite} S
 * @param {{
 *   repositories: string[];
 *   suites: (repo: string) => Promise<{ status: number; items: S[] }>;
 *   kind: (repo: string, suite: S) => Promise<string>;
 *   from: Date;
 *   to: Date;
 * }} week
 */
export declare function countBypasses<S extends RuleSuite>({ repositories, suites, kind, from, to }: {
    repositories: string[];
    suites: (repo: string) => Promise<{
        status: number;
        items: S[];
    }>;
    kind: (repo: string, suite: S) => Promise<string>;
    from: Date;
    to: Date;
}): Promise<{
    bypasses: number;
    past_checks: number;
    behind_main: number;
    repositories: Record<string, {
        bypasses: number;
        past_checks: number;
        behind_main: number;
    }>;
    unread: string[];
}>;
