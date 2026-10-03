/**
 * @param {unknown} text
 * @returns {string[]}
 */
export declare function words(text: unknown): string[];
export type Rule = [string, string, ((rest: string) => boolean)?];
/**
 * @param {unknown} text
 * @returns {string[]}
 */
export declare function stems(text: unknown): string[];
