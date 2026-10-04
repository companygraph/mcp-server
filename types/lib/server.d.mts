import { McpServer } from "@modelcontextprotocol/server";
import type { Snapshot } from "./snapshot.mjs";
export declare const GLOSSARY: string;
/** @param {Snapshot} s */
export declare function instructionsFor(s: Snapshot): string;
/** @param {Snapshot} s */
export declare function noteFor(s: Snapshot): string;
/**
 * @param {Snapshot} s
 * @param {{ name?: string; version?: string }} [identity]
 */
export declare function createServer(s: Snapshot, { name, version }?: {
    name?: string;
    version?: string;
}): McpServer;
