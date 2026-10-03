import type { Snapshot } from "./snapshot.mjs";
export type Answer = {
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
} & Record<string, any>;
/** @import { Snapshot } from "./snapshot.mjs" */
/**
 * What a call answered, once it parsed against the schema of its tool or, refused, the error
 * schema: `model` says where it came from in every case, and the rest is the tool's own, which
 * only `name` says, so it is read by key.
 * @typedef {{ model: { commit: string | null; repo: string | null; core: string; parser: string } } & Record<string, any>} Answer
 */
/** @param {Snapshot} s */
export declare function sampleCalls(s: Snapshot): {
    list_types: {};
    describe_schema: {
        type: string;
    };
    describe_relations: {};
    list_rules: {} | undefined;
    describe_rule: {
        rule: string;
    } | undefined;
    list_checks: {} | undefined;
    describe_errors: {};
    list_entities: {
        type: string;
    };
    get_entity: {
        id: string;
    };
    list_references: {
        entity: string;
    };
    find_evidence: {
        skill: string;
    } | undefined;
    search: {
        query: string;
        match: string;
    };
    fetch: {
        id: string;
    };
    diagram: {
        shape: string;
        id: string;
    };
};
/**
 * @param {string} name
 * @param {{ isError?: boolean | undefined; structuredContent?: unknown }} result
 * @returns {Answer}
 */
export declare function checkAnswer(name: string, result: {
    isError?: boolean | undefined;
    structuredContent?: unknown;
}): Answer;
