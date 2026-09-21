// What every tool answers, as schemas: the one copy the server registers, the suite parses
// answers against and a client may import to validate what it received. A shape is strict where
// this package builds the object, so a field nobody declared fails the suite, and loose where
// the parser builds it — an entity, a section, a table, an enum, a join, a list kind, a check —
// so a parser release that adds a key cannot make every answer fail the SDK's own validation.
// Content that varies by schema stays open by design: an entity's fields, a row's attributes.
import { z } from "zod";
import { CODES } from "./errors.mjs";

const count = z.number().int().nonnegative();

export const Model = z.strictObject({ commit: z.string().nullable(), repo: z.string().nullable(), core: z.string(), parser: z.string() });
export const EntityRef = z.strictObject({ id: z.string(), type: z.string(), name: z.string() });
// A row's other columns, verbatim; a qualifier the parser resolved arrives as the entity it names.
export const Attrs = z.record(z.string(), z.union([z.string(), EntityRef]));
export const Edge = z.strictObject({ from: EntityRef, via: z.string(), to: EntityRef, attrs: Attrs });
export const Page = z.strictObject({ total: count, returned: count, hasMore: z.boolean(), nextCursor: z.string().nullable() });

export const Table = z.looseObject({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) });
export const Section = z.looseObject({ heading: z.string(), text: z.string(), tables: z.array(Table) });
// The parser attaches a stamp when either `kind` or `start` is set, not only when both are, so
// an entity that carries one and not the other legitimately answers with null in the field it lacks.
export const Stamp = z.looseObject({ kind: z.string().nullable(), start: z.string().nullable(), end: z.string().nullable() });

export const Entity = z.looseObject({
  id: z.string(), type: z.string(), name: z.string(), tagline: z.string(), owner: z.string().nullable(),
  path: z.string(), url: z.string().nullable(), fields: z.record(z.string(), z.unknown()), sections: z.array(Section),
  stamp: Stamp.optional(),
  references: z.array(Edge), referencedBy: z.array(Edge),
  referenceCounts: z.strictObject({ references: count, referencedBy: count }),
});

const form = z.enum(["ref", "ref?", "qualifier"]);
const Relation = z.strictObject({ from: z.string(), via: z.string(), to: z.string(), form, array: z.boolean(), required: z.boolean(), min: count, max: count.nullable() });
const Enum = z.looseObject({ via: z.string(), tokens: z.array(z.string()), required: z.boolean() });
const Join = z.looseObject({ kind: z.string(), section: z.string() });
const ListKind = z.looseObject({ section: z.string(), kind: z.string(), required: z.boolean(), min: count });
const typed = (shape) => shape.extend({ type: z.string() });

const answer = (shape) => z.strictObject({ ...shape, model: Model });

export const OUTPUTS = {
  list_types: answer({ types: z.array(z.strictObject({ type: z.string(), name: z.string(), tagline: z.string(), owner: z.string().nullable(), count })) }),
  describe_schema: answer({
    type: z.string(), name: z.string(), tagline: z.string(), url: z.string().nullable(), sections: z.array(Section),
    relations: z.strictObject({
      owner: z.string().nullable(), owns: z.array(z.string()),
      references: z.array(Relation.omit({ from: true })), referencedBy: z.array(Relation.omit({ to: true })),
      enums: z.array(Enum), joins: z.array(Join), lists: z.array(ListKind),
    }),
  }),
  describe_relations: answer({
    relations: z.array(Relation), ownership: z.array(z.strictObject({ owner: z.string(), owned: z.string() })),
    enums: z.array(typed(Enum)), joins: z.array(typed(Join)), lists: z.array(typed(ListKind)),
    forms: z.record(z.string(), z.string()), reading: z.record(z.string(), z.string()),
  }),
  list_rules: answer({ tagline: z.string(), url: z.string().nullable(), rules: z.array(z.strictObject({ rule: z.string(), title: z.string(), part: z.string().nullable() })) }),
  describe_rule: answer({ rule: z.string(), title: z.string(), part: z.string().nullable(), text: z.string(), url: z.string().nullable() }),
  list_checks: answer({ checks: z.array(z.looseObject({ name: z.string(), rule: z.string(), title: z.string().nullable() })), ranBy: z.string() }),
  list_entities: answer({ type: z.string(), entities: z.array(EntityRef.extend({ tagline: z.string(), owner: z.string().nullable() })), page: Page }),
  get_entity: answer({ entity: Entity }),
  list_references: answer({ edges: z.array(Edge), page: Page }),
  find_evidence: answer({
    skill: EntityRef.extend({ tagline: z.string() }),
    evidence: z.record(z.string(), z.array(Edge.extend({ owner: z.string().nullable(), stamp: Stamp.optional() }))),
    page: Page,
  }),
  search: answer({
    query: z.string(), match: z.enum(["text", "name"]),
    results: z.array(z.strictObject({
      id: z.string(), title: z.string(), type: z.string(), owner: z.string().nullable(), tagline: z.string(), url: z.string().nullable(),
      matched: z.array(z.strictObject({ where: z.enum(["name", "tagline", "field", "section", "table"]), key: z.string().nullable() })),
    })),
    page: Page,
  }),
  fetch: answer({ id: z.string(), title: z.string(), type: z.string(), url: z.string().nullable(), text: z.string() }),
};

// A refusal. The SDK validates structured content on success and skips it on an error, so this
// shape is registered with no tool and held by the suite instead. Each code fixes its details.
const refusal = (code, details) => z.strictObject({ code: z.literal(code), message: z.string(), rule: z.string().nullable(), details });
const argument = z.strictObject({ argument: z.string(), reason: z.string() });

const DETAILS = {
  unknown_type: z.strictObject({ type: z.string(), declared: z.array(z.string()) }),
  unknown_entity: z.union([z.strictObject({ id: z.string() }), z.strictObject({ type: z.string(), name: z.string() })]),
  ambiguous_name: z.strictObject({ type: z.string(), name: z.string(), candidates: z.array(EntityRef.extend({ owner: z.string().nullable() })).min(2) }),
  unknown_rule: z.strictObject({ rule: z.string(), rules: z.array(z.string()) }),
  invalid_argument: argument,
  invalid_cursor: z.strictObject({ reason: z.enum(["malformed", "other_commit"]) }),
  unsupported_snapshot: z.strictObject({ missing: z.string() }),
};

export const ErrorBody = z.discriminatedUnion("code", CODES.map((code) => refusal(code, DETAILS[code])));
export const ErrorResult = z.strictObject({ error: ErrorBody, model: Model });
