export declare const DEFAULT_LIMIT = 50;
export declare const MAX_LIMIT = 200;
/** @param {unknown} [limit] */
export declare function clampLimit(limit?: unknown): number;
export type PageInfo = {
    total: number;
    returned: number;
    hasMore: boolean;
    nextCursor: string | null;
};
/**
 * One page of a list: the slice, and what the page says of the rest.
 * @typedef {{ total: number; returned: number; hasMore: boolean; nextCursor: string | null }} PageInfo
 */
/**
 * @template T
 * @param {T[]} items
 * @param {{ limit?: number | null | undefined; cursor?: string | null | undefined }} [paging]
 * @param {string | null | undefined} [commit]
 * @returns {{ items: T[]; page: PageInfo }}
 */
export declare function paginate<T>(items: T[], { limit, cursor }?: {
    limit?: number | null | undefined;
    cursor?: string | null | undefined;
}, commit?: string | null | undefined): {
    items: T[];
    page: PageInfo;
};
