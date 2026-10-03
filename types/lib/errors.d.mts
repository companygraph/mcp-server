export declare const CODES: readonly ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot", "cannot_draw", "no_creation_time"];
export declare const WHEN: {
    unknown_type: string;
    unknown_entity: string;
    ambiguous_name: string;
    unknown_rule: string;
    invalid_argument: string;
    invalid_cursor: string;
    unsupported_snapshot: string;
    cannot_draw: string;
    no_creation_time: string;
};
export type RefusalKind = typeof CODES[number];
/** @typedef {typeof CODES[number]} RefusalKind */
export declare class ModelError extends Error {
    code: "ambiguous_name" | "cannot_draw" | "invalid_argument" | "invalid_cursor" | "no_creation_time" | "unknown_entity" | "unknown_rule" | "unknown_type" | "unsupported_snapshot";
    rule: string | null;
    details: Record<string, unknown>;
    /**
     * @param {RefusalKind} code
     * @param {string} message
     * @param {{ rule?: string | null; details?: Record<string, unknown> }} [facts]
     */
    constructor(code: RefusalKind, message: string, { rule, details }?: {
        rule?: string | null;
        details?: Record<string, unknown>;
    });
}
