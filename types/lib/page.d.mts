import type { Snapshot } from "./snapshot.mjs";
export declare const SERVER: {
    name: string;
    version: string;
};
export type PageOptions = {
    origin: string;
    css?: string | null;
    icon?: string | null;
    brand?: string | null;
    jsonld?: string | null;
    server?: {
        name: string;
        version: string;
    };
};
/**
 * What a deployment hands in beside the snapshot: the address the request arrived under, and its own stylesheet, mark, brand, structured data and the server's identity where they differ from this package's.
 * @typedef {{ origin: string; css?: string | null; icon?: string | null; brand?: string | null; jsonld?: string | null; server?: { name: string; version: string } }} PageOptions
 */
/**
 * @param {Snapshot} snapshot
 * @param {PageOptions} options
 */
export declare function renderPage(snapshot: Snapshot, { origin, css, icon, brand, jsonld, server }: PageOptions): string;
