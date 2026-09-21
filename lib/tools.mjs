// The tools, each a thin wrapper over one query: the arguments in, the query's answer out as
// structured content and as the same JSON in text. A refusal goes out as a tool error whose text
// is its sentence and whose structured content is the same refusal as data, under `error`, so a
// client branches on a code and reads candidates from a list. Each tool names the schema of what
// it answers, and the SDK holds every successful answer to it before it leaves.
import { z } from "zod";
import { ModelError, provenance, listTypes, describeSchema, describeRelations, listRules, describeRule, listChecks, listEntities, entityBy, listReferences, findEvidence, search, fetchEntity } from "./model.mjs";
import { OUTPUTS } from "./schemas.mjs";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./paging.mjs";

// The two arguments every paged tool takes, described where every client reads them: in the input
// schema the tool listing hands out. A limit outside the range is served at the nearest bound and
// never refused, so without these words `limit: 0` comes back as one entry and nothing says why.
// One copy, spread into each paged tool, so the three cannot word it differently; the numbers are
// the paging module's own.
const paged = {
  limit: z.number().int().optional().describe(`Entries per page: ${DEFAULT_LIMIT} by default, clamped to 1–${MAX_LIMIT}, so 0 returns one entry and 1000 returns ${MAX_LIMIT}.`),
  cursor: z.string().optional().describe("`page.nextCursor` from the previous answer, sent with the same arguments; omit it for the first page."),
};

const run = (s, fn) => async (args) => {
  try {
    const data = fn(args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
  } catch (err) {
    if (!(err instanceof ModelError)) throw err;
    const refusal = { error: { code: err.code, message: err.message, rule: err.rule, details: err.details }, model: provenance(s) };
    return { isError: true, content: [{ type: "text", text: err.message }], structuredContent: refusal };
  }
};

// Each tool as data: its name, what it does, what it takes, what it answers and the query it
// runs. The list is the single copy — `registerTools` builds the server from it and the landing
// page prints it, so a tool cannot appear in one and not the other. A description is built one
// way, in at most sixty words: purpose, when to use it and which sibling instead, inputs, the
// answer's shape, limits. It names no instance fact, and it uses the terms the instructions define.
export const TOOLS = [
  { name: "list_types",
    description: "Every type the model's schemas declare. Use first, to learn which types exist before listing or describing one. No input. Returns `types`, each with `type`, `name`, `tagline`, `owner` (the type it nests under, or null) and `count`, the entities it holds.",
    input: z.object({}),
    call: (s) => listTypes(s),
    output: OUTPUTS.list_types },

  { name: "describe_schema",
    description: "One type's schema: its sections as written and its declared relations as data. Use to learn what an entity of the type may hold; for the whole vocabulary use describe_relations. Input: `type`. Returns `sections` and `relations`: owner, owns, references both ways, enums, joins and lists.",
    input: z.object({ type: z.string().describe("A type name from list_types, such as skill") }),
    call: (s, { type }) => describeSchema(s, type),
    output: OUTPUTS.describe_schema },

  { name: "describe_relations",
    description: "What the schemas declare between types: references with form and cardinality, ownership, enums, joins, list kinds. Use for a diagram or audit; for one type's full schema use describe_schema. Optional `type` narrows every list, `direction` (declares, declared-to, both; needs `type`) one side of relations, `via` relations and enums. Returns those lists, with `forms` and `reading` explaining every term. Not paged.",
    input: z.object({ type: z.string().optional(), direction: z.enum(["declares", "declared-to", "both"]).optional(), via: z.string().optional() }),
    call: (s, args) => describeRelations(s, args),
    output: OUTPUTS.describe_relations },

  { name: "list_rules",
    description: "The rules the model is held to, from the CONVENTIONS.md its core vendors. Use to resolve a rule number that a schema or a refusal cites, such as R9. No input. Returns `tagline` and `rules`, each with `rule`, `title` and `part`; describe_rule gives one rule's text.",
    input: z.object({}),
    call: (s) => listRules(s),
    output: OUTPUTS.list_rules },

  { name: "describe_rule",
    description: "One rule as written. Input: `rule`, a number from list_rules such as R9, in either case. Returns `rule`, `title`, `part` and `text`. An unknown number is refused with the known ones listed.",
    input: z.object({ rule: z.string().describe("A rule's number from list_rules, such as R9") }),
    call: (s, { rule }) => describeRule(s, rule),
    output: OUTPUTS.describe_rule },

  { name: "list_checks",
    description: "The checks the model's own gate runs, from the checker release this server was built with. Use to see which rules a script enforces and which are left to a reader. No input. Returns `checks`, each with `name`, `rule` and that rule's `title`, and `ranBy`. A list and no verdict: this server runs none of them.",
    input: z.object({}),
    call: (s) => listChecks(s),
    output: OUTPUTS.list_checks },

  { name: "list_entities",
    description: "The entities of one type, by id. Use to browse a type; to find an entity by words or by name use search. Input: `type`, optional `owner` (an id) to keep one owner's entities, `limit` (default 50, at most 200) and `cursor`. Returns `entities` with `id`, `type`, `name`, `tagline`, `owner`, and `page`; follow `page.nextCursor` while `page.hasMore`.",
    input: z.object({ type: z.string(), owner: z.string().optional().describe("An owner's id, to keep its entities"), ...paged }),
    call: (s, { type, ...options }) => listEntities(s, type, options),
    output: OUTPUTS.list_entities },

  { name: "get_entity",
    description: "One entity as structured data: fields, sections, tables and its references both ways. Use to reason over an entity; for its page as written use fetch. Input: `id`, or `type` and `name`; an ambiguous name is refused with candidate ids. Returns `entity`. Each reference list holds at most 50 edges; `referenceCounts` gives the totals and list_references the rest.",
    input: z.object({ id: z.string().optional().describe("The entity's id, as any answer gives it"), type: z.string().optional(), name: z.string().optional().describe("The canonical name, the entity's H1; needs type") }),
    call: (s, args) => entityBy(s, args),
    output: OUTPUTS.get_entity },

  { name: "list_references",
    description: "The model's edges, filtered and paged. Use to inspect one entity's relations or one kind of reference without taking whole entities. Optional `entity` (an id), `direction` (out, in, both; needs `entity`), `via`, `type` (the far end's type, or either end's without `entity`), `limit`, `cursor`. Returns `edges`, each `from`, `via`, `to`, `attrs`, and `page`.",
    input: z.object({ entity: z.string().optional(), direction: z.enum(["out", "in", "both"]).optional(), via: z.string().optional(), type: z.string().optional(), ...paged }),
    call: (s, args) => listReferences(s, args),
    output: OUTPUTS.list_references },

  { name: "find_evidence",
    description: "Everything the model says about one skill: every edge into it, grouped by the type of the page that drew it. Use to check a claimed skill against its evidence. Input: `skill`, an id or canonical name. Returns `skill` and `evidence`; a profile's claim arrives via Skills.Skill with its level, each evidence row via Evidence.Skill. Attributes are verbatim.",
    input: z.object({ skill: z.string().describe("The skill's id or canonical name") }),
    call: (s, { skill }) => findEvidence(s, skill),
    output: OUTPUTS.find_evidence },

  { name: "search",
    description: "Find entities by words or by exact name. `match: \"text\"` (default) is a case-insensitive substring over name, tagline, fields, sections and table cells; `match: \"name\"` is the exact canonical name, across types. Optional `type`, `owner` (an id), `limit`, `cursor`. Returns `results` with `id`, `title`, `type`, `matched`, and `page`. A listing by type then name, not a ranking.",
    input: z.object({ query: z.string(), match: z.enum(["text", "name"]).optional(), type: z.string().optional(), owner: z.string().optional().describe("An owner's id, to keep its entities"), ...paged }),
    call: (s, { query, ...options }) => search(s, query, options),
    output: OUTPUTS.search },

  { name: "fetch",
    description: "One entity's page as written. Use to quote or display the source; for structured fields and references use get_entity. Input: `id`, from search, list_entities or any reference. Returns `id`, `title`, `type`, `url` and `text`, the Markdown source. Takes no name: search with match \"name\" finds the id.",
    input: z.object({ id: z.string() }),
    call: (s, { id }) => fetchEntity(s, id),
    output: OUTPUTS.fetch },
];

export function registerTools(server, s) {
  for (const tool of TOOLS)
    server.registerTool(tool.name,
      { description: tool.description, inputSchema: tool.input, outputSchema: tool.output },
      run(s, (args) => tool.call(s, args)));
}
