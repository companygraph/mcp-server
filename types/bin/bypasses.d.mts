#!/usr/bin/env node
export type Repository = {
    full_name: string;
    default_branch: string;
};
export type Evaluation = {
    rule_type: string;
    result: string;
    enforcement?: string;
    details?: unknown;
    rule_source?: {
        type: string;
        id?: number | null;
    };
};
export type MergedPull = {
    merged_at: string;
    merge_commit_sha: string;
    base?: {
        ref: string;
    };
    head: {
        sha: string;
    };
};
export type Suite = {
    id: number;
    before_sha: string;
    after_sha: string;
    pushed_at: string;
    result: string;
};
