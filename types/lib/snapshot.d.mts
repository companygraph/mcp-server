import type { Entity, Edge, GraphType, Files, Constraints } from "companygraph-meta-model/instance";
import type { Rules } from "./rules.mjs";
export type SnapshotEntity = Entity & {
    markdown: string;
};
export type CheckName = {
    name: string;
    rule: string;
};
export type Snapshot = {
    commit: string | null;
    repo: string | null;
    core: {
        version: string;
        parser: string;
        path: string | null;
    };
    root: string;
    rootId: string;
    types: GraphType[];
    schemas: Entity[];
    schemaEdges: Edge[];
    constraints: Record<string, Constraints>;
    rules: Rules | null;
    checks: CheckName[];
    entities: SnapshotEntity[];
    edges: Edge[];
};
/** @returns {string} */
export declare function parserTag(): string;
/**
 * @param {{ files: Files; schemas: Files; sub?: string; core?: string | null; commit?: string | null; repo?: string | null; parserTag?: string }} source
 * @returns {Snapshot}
 */
export declare function buildSnapshot({ files, schemas, sub, core, commit, repo, parserTag: tag }: {
    files: Files;
    schemas: Files;
    sub?: string;
    core?: string | null;
    commit?: string | null;
    repo?: string | null;
    parserTag?: string;
}): Snapshot;
