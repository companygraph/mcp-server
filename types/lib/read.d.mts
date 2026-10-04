import type { Files } from "companygraph-meta-model/instance";
export type Source = {
    repo: string;
    commit: string;
    token?: string | undefined;
    fetch?: typeof globalThis.fetch;
};
/** @import { Files } from "companygraph-meta-model/instance" */
/**
 * Where a commit is read from: the repository, the commit, a token where one is given, and the
 * `fetch` to read through.
 * @typedef {{ repo: string; commit: string; token?: string | undefined; fetch?: typeof globalThis.fetch }} Source
 */
/**
 * @param {string} root
 * @returns {Files}
 */
export declare function readDir(root: string): Files;
/**
 * @param {string} coreDir
 * @returns {Files}
 */
export declare function readSchemas(coreDir: string): Files;
/**
 * @param {Source & { sub: string }} source
 * @returns {Promise<Files>}
 */
export declare function readGitHub({ repo, commit, sub, token, fetch }: Source & {
    sub: string;
}): Promise<Files>;
/**
 * @param {Source & { core: string }} source
 * @returns {Promise<Files>}
 */
export declare function readGitHubSchemas({ repo, commit, core, token, fetch }: Source & {
    core: string;
}): Promise<Files>;
