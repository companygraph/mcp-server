import { ModelError } from "./errors.mjs";
import type { Entity, Edge } from "companygraph-meta-model/instance";
import type { Snapshot, SnapshotEntity } from "./snapshot.mjs";
export type Ref = {
    id: string;
    type: string;
    name: string;
};
export type ServedEdge = {
    from: Ref;
    via: string;
    to: Ref;
    attrs: Record<string, string | Ref>;
};
export type Paging = {
    limit?: number | undefined;
    cursor?: string | undefined;
};
/**
 * @import { Entity, Edge, Section, Constraints } from "companygraph-meta-model/instance"
 * @import { Snapshot, SnapshotEntity } from "./snapshot.mjs"
 */
/**
 * An entity as an answer names it.
 * @typedef {{ id: string; type: string; name: string }} Ref
 */
/**
 * An edge as every answer serves it: both ends named, a qualifier that resolved as the entity it names.
 * @typedef {{ from: Ref; via: string; to: Ref; attrs: Record<string, string | Ref> }} ServedEdge
 */
/**
 * The two arguments every paged list takes.
 * @typedef {{ limit?: number | undefined; cursor?: string | undefined }} Paging
 */
export { ModelError };
/** @param {Snapshot} s */
export declare const provenance: (s: Snapshot) => {
    commit: string | null;
    repo: string | null;
    core: string;
    parser: string;
};
/**
 * @param {Snapshot} s
 * @param {string} type
 * @returns {Entity | undefined}
 */
export declare const schemaOf: (s: Snapshot, type: string) => Entity | undefined;
/**
 * @param {Snapshot} s
 * @param {string} type
 */
export declare const requireType: (s: Snapshot, type: string) => Entity;
/**
 * @param {Snapshot} s
 * @param {string} file
 */
export declare const coreUrl: (s: Snapshot, file: string) => string | null;
/**
 * @param {Snapshot} s
 * @param {Entity} schema
 */
export declare const schemaUrl: (s: Snapshot, schema: Entity) => string | null;
/** @param {{ id: string; address?: string }} e */
export declare const place: (e: {
    id: string;
    address?: string;
}) => string;
/** @param {unknown} id */
export declare const createdOf: (id: unknown) => string | null;
/**
 * @template {Entity} E
 * @param {{ entities: E[]; edges: Edge[] }} s
 * @returns {ServedEdge[]}
 */
export declare const allEdges: <E extends Entity>(s: {
    entities: E[];
    edges: Edge[];
}) => ServedEdge[];
/**
 * @template {Entity} E
 * @param {{ entities: E[] }} s
 * @param {string} id
 */
export declare const requireId: <E extends Entity>(s: {
    entities: E[];
}, id: string) => E;
export declare const REFERENCE_CAP = 50;
/**
 * @param {Snapshot} s
 * @param {Entity} e
 */
export declare const imageUrl: (s: Snapshot, e: Entity) => string | null;
/** @param {Snapshot} s */
export declare function listTypes(s: Snapshot): {
    types: {
        type: string;
        name: string;
        tagline: string;
        owner: string | null;
        count: number;
    }[];
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/** @param {Snapshot} s */
export declare const relationsOf: (s: Snapshot) => {
    relations: {
        from: string;
        via: string;
        to: string | null;
        form: "ref" | "ref?" | "qualifier";
        by: string | null;
        in: string | null;
        array: boolean;
        required: boolean;
        min: number;
        max: number | null;
    }[];
    ownership: {
        owner: string;
        owned: string;
    }[];
    enums: ({
        type: string;
    } & {
        via: string;
        tokens: string[];
        required: boolean;
    })[];
    joins: ({
        type: string;
    } & ({
        kind: "under";
        section: string;
        under: string;
    } | {
        kind: "lists";
        section: string;
        column: string;
        field: string;
        by: string;
    } | {
        kind: "roles";
        section: string;
        column: string;
        by: string;
    }))[];
    lists: ({
        type: string;
    } & {
        section: string;
        kind: "Bulleted" | "Numbered";
        required: boolean;
        min: number;
    })[];
};
/**
 * @param {Snapshot} s
 * @param {{ type?: string | undefined; direction?: "declares" | "declared-to" | "both" | undefined; via?: string | undefined }} [options]
 */
export declare function describeRelations(s: Snapshot, { type, direction, via }?: {
    type?: string | undefined;
    direction?: "declares" | "declared-to" | "both" | undefined;
    via?: string | undefined;
}): {
    relations: {
        from: string;
        via: string;
        to: string | null;
        form: "ref" | "ref?" | "qualifier";
        by: string | null;
        in: string | null;
        array: boolean;
        required: boolean;
        min: number;
        max: number | null;
    }[];
    ownership: {
        owner: string;
        owned: string;
    }[];
    enums: ({
        type: string;
    } & {
        via: string;
        tokens: string[];
        required: boolean;
    })[];
    joins: ({
        type: string;
    } & ({
        kind: "under";
        section: string;
        under: string;
    } | {
        kind: "lists";
        section: string;
        column: string;
        field: string;
        by: string;
    } | {
        kind: "roles";
        section: string;
        column: string;
        by: string;
    }))[];
    lists: ({
        type: string;
    } & {
        section: string;
        kind: "Bulleted" | "Numbered";
        required: boolean;
        min: number;
    })[];
    forms: {
        ref: string;
        "ref?": string;
        qualifier: string;
    };
    reading: {
        required: string;
        "min and max": string;
        under: string;
        lists: string;
        roles: string;
        enums: string;
        "by and in": string;
    };
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} type
 */
export declare function describeSchema(s: Snapshot, type: string): {
    type: string;
    name: string;
    tagline: string;
    url: string | null;
    sections: {
        heading: string;
        text: string;
        tables: import("companygraph-meta-model/instance").Table[];
    }[];
    relations: {
        owner: string | null;
        owns: string[];
        references: {
            via: string;
            to: string | null;
            form: "ref" | "ref?" | "qualifier";
            by: string | null;
            in: string | null;
            array: boolean;
            required: boolean;
            min: number;
            max: number | null;
        }[];
        referencedBy: {
            from: string;
            via: string;
            form: "ref" | "ref?" | "qualifier";
            by: string | null;
            in: string | null;
            array: boolean;
            required: boolean;
            min: number;
            max: number | null;
        }[];
        enums: {
            via: string;
            tokens: string[];
            required: boolean;
        }[];
        joins: ({
            kind: "under";
            section: string;
            under: string;
        } | {
            kind: "lists";
            section: string;
            column: string;
            field: string;
            by: string;
        } | {
            kind: "roles";
            section: string;
            column: string;
            by: string;
        })[];
        lists: {
            section: string;
            kind: "Bulleted" | "Numbered";
            required: boolean;
            min: number;
        }[];
    };
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/** @param {Snapshot} s */
export declare function listRules(s: Snapshot): {
    tagline: string;
    url: string | null;
    rules: {
        rule: string;
        title: string;
        part: string | null;
    }[];
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} rule
 */
export declare function describeRule(s: Snapshot, rule: string): {
    rule: string;
    title: string;
    part: string | null;
    text: string;
    url: string | null;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
export declare const ORDERS: readonly ["address", "newest", "oldest"];
/**
 * @param {Snapshot} s
 * @param {string | undefined} type
 * @param {Paging & { owner?: string | undefined; order?: typeof ORDERS[number] | undefined }} [options]
 */
export declare function listEntities(s: Snapshot, type: string | undefined, { owner, order, limit, cursor }?: Paging & {
    owner?: string | undefined;
    order?: typeof ORDERS[number] | undefined;
}): {
    type: string | null;
    entities: ({
        created: string;
        id: string;
        type: string;
        name: string;
        tagline: string;
        owner: string | null;
    } | {
        created?: never;
        id: string;
        type: string;
        name: string;
        tagline: string;
        owner: string | null;
    })[];
    page: import("./paging.mjs").PageInfo;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} type
 * @param {string} name
 */
export declare function getEntity(s: Snapshot, type: string, name: string): {
    entity: {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created: string;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    } | {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created?: never;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    };
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} id
 */
export declare function getEntityById(s: Snapshot, id: string): {
    entity: {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created: string;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    } | {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created?: never;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    };
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {{ id?: string | undefined; type?: string | undefined; name?: string | undefined }} [by]
 */
export declare function entityBy(s: Snapshot, { id, type, name }?: {
    id?: string | undefined;
    type?: string | undefined;
    name?: string | undefined;
}): {
    entity: {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created: string;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    } | {
        id: string;
        type: string;
        name: string;
        tagline: string;
        fields: import("companygraph-meta-model/instance").Fields;
        path: string;
        stamp?: import("companygraph-meta-model/instance").Stamp;
        created?: never;
        owner: string | null;
        sections: {
            heading: string;
            text: string;
            tables: import("companygraph-meta-model/instance").Table[];
        }[];
        url: string | null;
        image_url?: string;
        references: ServedEdge[];
        referencedBy: ServedEdge[];
        referenceCounts: {
            references: number;
            referencedBy: number;
        };
    };
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {Paging & { entity?: string | undefined; direction?: "out" | "in" | "both" | undefined; via?: string | undefined; type?: string | undefined }} [options]
 */
export declare function listReferences(s: Snapshot, { entity, direction, via, type, limit, cursor }?: Paging & {
    entity?: string | undefined;
    direction?: "out" | "in" | "both" | undefined;
    via?: string | undefined;
    type?: string | undefined;
}): {
    edges: ServedEdge[];
    page: import("./paging.mjs").PageInfo;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} skill
 * @param {Paging} [options]
 */
export declare function findEvidence(s: Snapshot, skill: string, { limit, cursor }?: Paging): {
    skill: {
        id: string;
        type: string;
        name: string;
        tagline: string;
    };
    evidence: Record<string, (ServedEdge & {
        owner: string | null;
        stamp?: Entity["stamp"];
    })[]>;
    page: import("./paging.mjs").PageInfo;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
declare const MATCHES: readonly ["text", "name", "words"];
export type Where = "name" | "tagline" | "field" | "section" | "table";
export type Stemmed = {
    places: {
        where: Where;
        key: string | null;
        stems: Set<string>;
    }[];
    all: Set<string>;
};
export type StemIndex = {
    byId: Map<string, Stemmed>;
    common: Set<string>;
};
/**
 * @param {Snapshot} s
 * @param {string} query
 * @param {Paging & { match?: typeof MATCHES[number] | undefined; type?: string | undefined; owner?: string | undefined }} [options]
 */
export declare function search(s: Snapshot, query: string, { match, type, owner, limit, cursor }?: Paging & {
    match?: typeof MATCHES[number] | undefined;
    type?: string | undefined;
    owner?: string | undefined;
}): {
    query: string;
    match: "name" | "text" | "words";
    words?: {
        word: string;
        stem: string;
        common: boolean;
    }[];
    results: {
        e?: SnapshotEntity;
        id: string;
        title: string;
        type: string;
        owner: string | null;
        tagline: string;
        created?: string;
        url: string | null;
        matched: {
            where: Where;
            key: string | null;
        }[];
    }[];
    page: import("./paging.mjs").PageInfo;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/**
 * @param {Snapshot} s
 * @param {string} id
 */
export declare function fetchEntity(s: Snapshot, id: string): {
    id: string;
    title: string;
    type: string;
    url: string | null;
    text: string;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/** @param {Snapshot} s */
export declare function describeErrors(s: Snapshot): {
    errors: {
        code: import("./errors.mjs").RefusalKind;
        when: string;
        details: Record<string, unknown>;
    }[];
    schema: Record<string, unknown>;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
/** @param {Snapshot} s */
export declare function listChecks(s: Snapshot): {
    checks: {
        name: string;
        rule: string;
        title: string | null;
        reports: string;
    }[];
    ranBy: string;
    model: {
        commit: string | null;
        repo: string | null;
        core: string;
        parser: string;
    };
};
