import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { relationsOf } from "./model.mjs";
import type { Entity, Edge } from "companygraph-meta-model/instance";
import type { Snapshot } from "./snapshot.mjs";
export type DiagramKind = typeof SHAPES[number];
export type Relation = ReturnType<typeof relationsOf>["relations"][number];
export type DiagramNode = {
    node: string;
    id: string;
    title: string;
    type: string;
    url?: string | null;
};
export type DiagramLink = {
    from: string;
    to: string;
    label: string;
};
export type Drawing = {
    title: string | null;
    mermaid: string;
    nodes: DiagramNode[];
    links: DiagramLink[];
    edges: number;
    omitted: number;
};
/**
 * @import { Entity, Edge, Table } from "companygraph-meta-model/instance"
 * @import { Snapshot } from "./snapshot.mjs"
 * @import { Ref, ServedEdge } from "./model.mjs"
 */
/**
 * @typedef {typeof SHAPES[number]} DiagramKind
 */
/**
 * @typedef {ReturnType<typeof relationsOf>["relations"][number]} Relation
 */
/**
 * A node of a picture: the name its source gives it, and what it stands for. For a type, `id` is the schema's own address and `url` its file.
 * @typedef {{ node: string; id: string; title: string; type: string; url?: string | null }} DiagramNode
 */
/**
 * An arrow of a picture by the names its source gives its ends, its label unescaped.
 * @typedef {{ from: string; to: string; label: string }} DiagramLink
 */
/**
 * What one shape draws, before the tool adds the shape and where the model came from.
 * @typedef {{ title: string | null; mermaid: string; nodes: DiagramNode[]; links: DiagramLink[]; edges: number; omitted: number }} Drawing
 */
export declare const DIAGRAM_CAP = 50;
/** @param {unknown} v */
export declare const plain: (v: unknown) => string;
/** @param {unknown} text */
export declare const label: (text: unknown) => string;
/**
 * @param {DiagramKind} shape
 * @param {"empty" | "too_large"} reason
 * @param {number} nodes
 * @param {unknown} [narrowed]
 */
export declare const cannot: (shape: DiagramKind, reason: "empty" | "too_large", nodes: number, narrowed?: unknown) => ModelError;
/**
 * @param {{ entities: Entity[]; edges: Edge[] }} s
 * @param {string} id
 * @returns {Drawing}
 */
export declare function processDiagram(s: {
    entities: Entity[];
    edges: Edge[];
}, id: string): Drawing;
/**
 * @param {Snapshot} s
 * @param {{ shape?: DiagramKind | undefined; id?: string | undefined; domain?: string | undefined; type?: string | undefined }} [options]
 */
export declare function diagram(s: Snapshot, { shape, id, domain, type }?: {
    shape?: DiagramKind | undefined;
    id?: string | undefined;
    domain?: string | undefined;
    type?: string | undefined;
}): {
    title: string | null;
    mermaid: string;
    nodes: DiagramNode[];
    links: DiagramLink[];
    edges: number;
    omitted: number;
    shape: "aggregate" | "concepts" | "context" | "flow" | "lifecycle" | "neighborhood" | "process" | "schema" | undefined;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
