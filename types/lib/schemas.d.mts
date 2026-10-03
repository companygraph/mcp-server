import { z } from "zod";
export declare const SHAPES: readonly ["concepts", "process", "neighborhood", "schema"];
export declare const Model: z.ZodObject<{
    commit: z.ZodNullable<z.ZodString>;
    repo: z.ZodNullable<z.ZodString>;
    core: z.ZodString;
    parser: z.ZodString;
}, z.core.$strict>;
export declare const EntityRef: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
}, z.core.$strict>;
export declare const Attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
}, z.core.$strict>]>>;
export declare const Edge: z.ZodObject<{
    from: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        name: z.ZodString;
    }, z.core.$strict>;
    via: z.ZodString;
    to: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        name: z.ZodString;
    }, z.core.$strict>;
    attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        name: z.ZodString;
    }, z.core.$strict>]>>;
}, z.core.$strict>;
export declare const Page: z.ZodObject<{
    total: z.ZodNumber;
    returned: z.ZodNumber;
    hasMore: z.ZodBoolean;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const Created: z.ZodOptional<z.ZodISODateTime>;
export declare const Table: z.ZodObject<{
    columns: z.ZodArray<z.ZodString>;
    rows: z.ZodArray<z.ZodArray<z.ZodString>>;
}, z.core.$loose>;
export declare const Section: z.ZodObject<{
    heading: z.ZodString;
    text: z.ZodString;
    tables: z.ZodArray<z.ZodObject<{
        columns: z.ZodArray<z.ZodString>;
        rows: z.ZodArray<z.ZodArray<z.ZodString>>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export declare const Stamp: z.ZodObject<{
    kind: z.ZodNullable<z.ZodString>;
    start: z.ZodNullable<z.ZodString>;
    end: z.ZodNullable<z.ZodString>;
}, z.core.$loose>;
export declare const Entity: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
    tagline: z.ZodString;
    owner: z.ZodNullable<z.ZodString>;
    created: z.ZodOptional<z.ZodISODateTime>;
    path: z.ZodString;
    url: z.ZodNullable<z.ZodString>;
    image_url: z.ZodOptional<z.ZodString>;
    fields: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    sections: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        text: z.ZodString;
        tables: z.ZodArray<z.ZodObject<{
            columns: z.ZodArray<z.ZodString>;
            rows: z.ZodArray<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    stamp: z.ZodOptional<z.ZodObject<{
        kind: z.ZodNullable<z.ZodString>;
        start: z.ZodNullable<z.ZodString>;
        end: z.ZodNullable<z.ZodString>;
    }, z.core.$loose>>;
    references: z.ZodArray<z.ZodObject<{
        from: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>;
        via: z.ZodString;
        to: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>;
        attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>]>>;
    }, z.core.$strict>>;
    referencedBy: z.ZodArray<z.ZodObject<{
        from: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>;
        via: z.ZodString;
        to: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>;
        attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>]>>;
    }, z.core.$strict>>;
    referenceCounts: z.ZodObject<{
        references: z.ZodNumber;
        referencedBy: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$loose>;
export declare const OUTPUTS: {
    list_types: z.ZodObject<{
        types: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodString;
            owner: z.ZodNullable<z.ZodString>;
            count: z.ZodNumber;
        }, z.core.$strict>>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    describe_schema: z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
        tagline: z.ZodString;
        url: z.ZodNullable<z.ZodString>;
        sections: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            text: z.ZodString;
            tables: z.ZodArray<z.ZodObject<{
                columns: z.ZodArray<z.ZodString>;
                rows: z.ZodArray<z.ZodArray<z.ZodString>>;
            }, z.core.$loose>>;
        }, z.core.$loose>>;
        relations: z.ZodObject<{
            owner: z.ZodNullable<z.ZodString>;
            owns: z.ZodArray<z.ZodString>;
            references: z.ZodArray<z.ZodObject<{
                via: z.ZodString;
                to: z.ZodNullable<z.ZodString>;
                form: z.ZodEnum<{
                    qualifier: "qualifier";
                    ref: "ref";
                    "ref?": "ref?";
                }>;
                by: z.ZodNullable<z.ZodString>;
                in: z.ZodNullable<z.ZodString>;
                array: z.ZodBoolean;
                required: z.ZodBoolean;
                min: z.ZodNumber;
                max: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>>;
            referencedBy: z.ZodArray<z.ZodObject<{
                from: z.ZodString;
                via: z.ZodString;
                form: z.ZodEnum<{
                    qualifier: "qualifier";
                    ref: "ref";
                    "ref?": "ref?";
                }>;
                by: z.ZodNullable<z.ZodString>;
                in: z.ZodNullable<z.ZodString>;
                array: z.ZodBoolean;
                required: z.ZodBoolean;
                min: z.ZodNumber;
                max: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>>;
            enums: z.ZodArray<z.ZodObject<{
                via: z.ZodString;
                tokens: z.ZodArray<z.ZodString>;
                required: z.ZodBoolean;
            }, z.core.$loose>>;
            joins: z.ZodArray<z.ZodObject<{
                kind: z.ZodString;
                section: z.ZodString;
            }, z.core.$loose>>;
            lists: z.ZodArray<z.ZodObject<{
                section: z.ZodString;
                kind: z.ZodString;
                required: z.ZodBoolean;
                min: z.ZodNumber;
            }, z.core.$loose>>;
        }, z.core.$strict>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    describe_relations: z.ZodObject<{
        relations: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            via: z.ZodString;
            to: z.ZodNullable<z.ZodString>;
            form: z.ZodEnum<{
                qualifier: "qualifier";
                ref: "ref";
                "ref?": "ref?";
            }>;
            by: z.ZodNullable<z.ZodString>;
            in: z.ZodNullable<z.ZodString>;
            array: z.ZodBoolean;
            required: z.ZodBoolean;
            min: z.ZodNumber;
            max: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>>;
        ownership: z.ZodArray<z.ZodObject<{
            owner: z.ZodString;
            owned: z.ZodString;
        }, z.core.$strict>>;
        enums: z.ZodArray<z.ZodObject<{
            [x: string]: any;
            type: z.ZodString;
        }, z.core.$strip>>;
        joins: z.ZodArray<z.ZodObject<{
            [x: string]: any;
            type: z.ZodString;
        }, z.core.$strip>>;
        lists: z.ZodArray<z.ZodObject<{
            [x: string]: any;
            type: z.ZodString;
        }, z.core.$strip>>;
        forms: z.ZodRecord<z.ZodString, z.ZodString>;
        reading: z.ZodRecord<z.ZodString, z.ZodString>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    list_rules: z.ZodObject<{
        tagline: z.ZodString;
        url: z.ZodNullable<z.ZodString>;
        rules: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            title: z.ZodString;
            part: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    describe_rule: z.ZodObject<{
        rule: z.ZodString;
        title: z.ZodString;
        part: z.ZodNullable<z.ZodString>;
        text: z.ZodString;
        url: z.ZodNullable<z.ZodString>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    describe_errors: z.ZodObject<{
        errors: z.ZodArray<z.ZodObject<{
            code: z.ZodEnum<{
                ambiguous_name: "ambiguous_name";
                cannot_draw: "cannot_draw";
                invalid_argument: "invalid_argument";
                invalid_cursor: "invalid_cursor";
                no_creation_time: "no_creation_time";
                unknown_entity: "unknown_entity";
                unknown_rule: "unknown_rule";
                unknown_type: "unknown_type";
                unsupported_snapshot: "unsupported_snapshot";
            }>;
            when: z.ZodString;
            details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strict>>;
        schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    list_checks: z.ZodObject<{
        checks: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            rule: z.ZodString;
            title: z.ZodNullable<z.ZodString>;
        }, z.core.$loose>>;
        ranBy: z.ZodString;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    list_entities: z.ZodObject<{
        type: z.ZodNullable<z.ZodString>;
        entities: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodString;
            owner: z.ZodNullable<z.ZodString>;
            created: z.ZodOptional<z.ZodISODateTime>;
        }, z.core.$strict>>;
        page: z.ZodObject<{
            total: z.ZodNumber;
            returned: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    get_entity: z.ZodObject<{
        entity: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodString;
            owner: z.ZodNullable<z.ZodString>;
            created: z.ZodOptional<z.ZodISODateTime>;
            path: z.ZodString;
            url: z.ZodNullable<z.ZodString>;
            image_url: z.ZodOptional<z.ZodString>;
            fields: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            sections: z.ZodArray<z.ZodObject<{
                heading: z.ZodString;
                text: z.ZodString;
                tables: z.ZodArray<z.ZodObject<{
                    columns: z.ZodArray<z.ZodString>;
                    rows: z.ZodArray<z.ZodArray<z.ZodString>>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
            stamp: z.ZodOptional<z.ZodObject<{
                kind: z.ZodNullable<z.ZodString>;
                start: z.ZodNullable<z.ZodString>;
                end: z.ZodNullable<z.ZodString>;
            }, z.core.$loose>>;
            references: z.ZodArray<z.ZodObject<{
                from: z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>;
                via: z.ZodString;
                to: z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>;
                attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>]>>;
            }, z.core.$strict>>;
            referencedBy: z.ZodArray<z.ZodObject<{
                from: z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>;
                via: z.ZodString;
                to: z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>;
                attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strict>]>>;
            }, z.core.$strict>>;
            referenceCounts: z.ZodObject<{
                references: z.ZodNumber;
                referencedBy: z.ZodNumber;
            }, z.core.$strict>;
        }, z.core.$loose>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    list_references: z.ZodObject<{
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>;
            via: z.ZodString;
            to: z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>;
            attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>]>>;
        }, z.core.$strict>>;
        page: z.ZodObject<{
            total: z.ZodNumber;
            returned: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    find_evidence: z.ZodObject<{
        skill: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodString;
        }, z.core.$strict>;
        evidence: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
            from: z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>;
            via: z.ZodString;
            to: z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>;
            attrs: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                id: z.ZodString;
                type: z.ZodString;
                name: z.ZodString;
            }, z.core.$strict>]>>;
            owner: z.ZodNullable<z.ZodString>;
            stamp: z.ZodOptional<z.ZodObject<{
                kind: z.ZodNullable<z.ZodString>;
                start: z.ZodNullable<z.ZodString>;
                end: z.ZodNullable<z.ZodString>;
            }, z.core.$loose>>;
        }, z.core.$strict>>>;
        page: z.ZodObject<{
            total: z.ZodNumber;
            returned: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    search: z.ZodObject<{
        query: z.ZodString;
        match: z.ZodEnum<{
            name: "name";
            text: "text";
            words: "words";
        }>;
        words: z.ZodOptional<z.ZodArray<z.ZodObject<{
            word: z.ZodString;
            stem: z.ZodString;
            common: z.ZodBoolean;
        }, z.core.$strict>>>;
        results: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            type: z.ZodString;
            owner: z.ZodNullable<z.ZodString>;
            tagline: z.ZodString;
            created: z.ZodOptional<z.ZodISODateTime>;
            url: z.ZodNullable<z.ZodString>;
            matched: z.ZodArray<z.ZodObject<{
                where: z.ZodEnum<{
                    field: "field";
                    name: "name";
                    section: "section";
                    table: "table";
                    tagline: "tagline";
                }>;
                key: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
        page: z.ZodObject<{
            total: z.ZodNumber;
            returned: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    fetch: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodString;
        url: z.ZodNullable<z.ZodString>;
        text: z.ZodString;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
    diagram: z.ZodObject<{
        shape: z.ZodEnum<{
            concepts: "concepts";
            neighborhood: "neighborhood";
            process: "process";
            schema: "schema";
        }>;
        title: z.ZodNullable<z.ZodString>;
        mermaid: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            node: z.ZodString;
            id: z.ZodString;
            title: z.ZodString;
            type: z.ZodString;
            url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strict>>;
        links: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            label: z.ZodString;
        }, z.core.$strict>>;
        everyType: z.ZodOptional<z.ZodArray<z.ZodObject<{
            via: z.ZodString;
            to: z.ZodString;
            multiplicity: z.ZodString;
        }, z.core.$strict>>>;
        edges: z.ZodNumber;
        omitted: z.ZodNumber;
    } & {
        model: typeof Model;
    }, z.core.$strict>;
};
export declare const DETAILS: {
    unknown_type: z.ZodObject<{
        type: z.ZodString;
        declared: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    unknown_entity: z.ZodUnion<readonly [z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
    }, z.core.$strict>]>;
    ambiguous_name: z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
        candidates: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            name: z.ZodString;
            owner: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    unknown_rule: z.ZodObject<{
        rule: z.ZodString;
        rules: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    invalid_argument: z.ZodObject<{
        argument: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>;
    invalid_cursor: z.ZodObject<{
        reason: z.ZodEnum<{
            malformed: "malformed";
            other_commit: "other_commit";
        }>;
    }, z.core.$strict>;
    unsupported_snapshot: z.ZodObject<{
        missing: z.ZodString;
    }, z.core.$strict>;
    cannot_draw: z.ZodObject<{
        shape: z.ZodEnum<{
            concepts: "concepts";
            neighborhood: "neighborhood";
            process: "process";
            schema: "schema";
        }>;
        reason: z.ZodEnum<{
            empty: "empty";
            too_large: "too_large";
        }>;
        nodes: z.ZodNumber;
        limit: z.ZodNumber;
    }, z.core.$strict>;
    no_creation_time: z.ZodObject<{
        order: z.ZodEnum<{
            newest: "newest";
            oldest: "oldest";
        }>;
        type: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
};
/**
 * What a refusal carries, one shape per code. The union is built by walking the closed list of codes,
 * which a tuple type cannot say, so the compiler is told the one thing it cannot see.
 * @type {z.ZodType<{ code: import("./errors.mjs").RefusalKind; message: string; rule: string | null; details: unknown }>}
 */
export declare const ErrorBody: z.ZodType<{
    code: import("./errors.mjs").RefusalKind;
    message: string;
    rule: string | null;
    details: unknown;
}>;
export declare const ErrorResult: z.ZodObject<{
    error: z.ZodType<{
        code: import("./errors.mjs").RefusalKind;
        message: string;
        rule: string | null;
        details: unknown;
    }, any, z.core.$ZodTypeInternals<{
        code: import("./errors.mjs").RefusalKind;
        message: string;
        rule: string | null;
        details: unknown;
    }, any>>;
    model: z.ZodObject<{
        commit: z.ZodNullable<z.ZodString>;
        repo: z.ZodNullable<z.ZodString>;
        core: z.ZodString;
        parser: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
