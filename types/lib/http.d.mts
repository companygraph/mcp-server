import http from "node:http";
import type { Snapshot } from "./snapshot.mjs";
/** @import { Snapshot } from "./snapshot.mjs" */
export declare const MAX_BODY_BYTES: number;
export type HttpOptions = {
    allowedHosts?: string[] | null;
    pageCss?: string | null;
    pageIcon?: string | null;
    pageBrand?: string | null;
    pageJsonld?: string | null;
    robots?: string | null;
};
/**
 * What a deployment supplies beside the snapshot: the hosts it answers to, and the stylesheet, mark, brand, structured data and robots rule of its page.
 * @typedef {{ allowedHosts?: string[] | null; pageCss?: string | null; pageIcon?: string | null; pageBrand?: string | null; pageJsonld?: string | null; robots?: string | null }} HttpOptions
 */
/**
 * @param {Snapshot} snapshot
 * @param {HttpOptions} [options]
 */
export declare function createHttpServer(snapshot: Snapshot, { allowedHosts, pageCss, pageIcon, pageBrand, pageJsonld, robots }?: HttpOptions): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
