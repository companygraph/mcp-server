import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Snapshot } from "./snapshot.mjs";
export type Tool = {
    name: string;
    description: string;
    input: z.ZodType;
    call: (s: Snapshot, args: any) => Record<string, unknown>;
    output: z.ZodType;
};
/** @type {Tool[]} */
export declare const TOOLS: Tool[];
/**
 * @param {McpServer} server
 * @param {Snapshot} s
 */
export declare function registerTools(server: McpServer, s: Snapshot): void;
