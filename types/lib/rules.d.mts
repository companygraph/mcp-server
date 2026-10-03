export type Rule = {
    rule: string;
    title: string;
    part: string | null;
    text: string;
};
export type Rules = {
    tagline: string;
    rules: Rule[];
};
export type Pending = {
    rule: string;
    title: string;
    part: string | null;
    lines: string[];
};
/**
 * One rule: its number, title, the part it stands in and its text.
 * @typedef {{ rule: string; title: string; part: string | null; text: string }} Rule
 */
/**
 * The rules a core ships, with the tagline that stands above the first part.
 * @typedef {{ tagline: string; rules: Rule[] }} Rules
 */
/**
 * A rule read so far: its lines are still being collected.
 * @typedef {{ rule: string; title: string; part: string | null; lines: string[] }} Pending
 */
/**
 * @param {unknown} text
 * @returns {Rules | null}
 */
export declare function parseRules(text: unknown): Rules | null;
