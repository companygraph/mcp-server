import type { Snapshot } from "../../lib/snapshot.mjs";
export type Deployment = {
    platform?: string;
    domain: string;
    registry_name: string;
    repository: string;
} & Record<string, unknown>;
export type Source = {
    repo: string;
    commit: string;
} & Record<string, unknown>;
export type Platform = "google" | "azure";
/** @import { Snapshot } from "../../lib/snapshot.mjs" */
/**
 * deployment.json: what a deployment names of itself and its platform. A field of the other
 * platform, or one a platform lacks, is what `deploymentProblems` reports.
 * @typedef {{ platform?: string; domain: string; registry_name: string; repository: string } & Record<string, unknown>} Deployment
 */
/**
 * source.json: the repository and the commit of the model a deployment pins.
 * @typedef {{ repo: string; commit: string } & Record<string, unknown>} Source
 */
/**
 * @typedef {"google" | "azure"} Platform
 */
export declare const ROOT: string;
export declare const DIST: string;
/** @returns {Source} */
export declare const source: () => Source;
/** @returns {Deployment} */
export declare const deployment: () => Deployment;
/** @returns {Snapshot} */
export declare const snapshot: () => Snapshot;
export declare const PLATFORMS: readonly ["google", "azure"];
/**
 * @param {Deployment} d
 * @returns {Platform}
 */
export declare function platformOf(d: Deployment): Platform;
/**
 * @param {Deployment} d
 * @returns {string[]}
 */
export declare function deploymentProblems(d: Deployment): string[];
