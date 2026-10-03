// The tools, each a thin wrapper over one query: the arguments in, the query's answer out as
// structured content and as the same JSON in text. A refusal goes out as a tool error whose text
// is its sentence and whose structured content is the same refusal as data, under `error`, so a
// client branches on a code and reads candidates from a list. Each tool names the schema of what
// it answers, and the SDK holds every successful answer to it before it leaves.
import { z } from "zod";
import { ModelError, provenance, listTypes, describeSchema, describeRelations, listRules, describeRule, listChecks, describeErrors, listEntities, ORDERS, entityBy, listReferences, findEvidence, search, fetchEntity } from "./model.mjs";
import { diagram } from "./diagram.mjs";
import { OUTPUTS, SHAPES } from "./schemas.mjs";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./paging.mjs";

/**
 * @import { McpServer, StandardSchemaWithJSON, CallToolResult } from "@modelcontextprotocol/server"
 * @import { Snapshot } from "./snapshot.mjs"
 */

/**
 * One tool as data. `call` takes what `input` parsed, which is why its arguments are not typed
 * here: each tool's own `input` is their one declaration.
 * @typedef {object} Tool
 * @property {string} name
 * @property {string} description
 * @property {z.ZodType} input
 * @property {(s: Snapshot, args: any) => Record<string, unknown>} call
 * @property {z.ZodType} output
 */

// The two arguments every paged tool takes, described where every client reads them: in the input
// schema the tool listing hands out. A limit outside the range is served at the nearest bound and
// never refused, so without these words `limit: 0` comes back as one entry and nothing says why.
// One copy, spread into each paged tool, so no two can word it differently; the numbers are
// the paging module's own.
const paged = {
  limit: z.number().int().optional().describe(`Entries per page: ${DEFAULT_LIMIT} by default, clamped to 1–${MAX_LIMIT}, so 0 returns one entry and 1000 returns ${MAX_LIMIT}.`),
  cursor: z.string().optional().describe("`page.nextCursor` from the previous answer, sent with the same arguments; omit it for the first page."),
};

// Arguments are held to a tool's input schema here and not by the SDK, which refuses them
// before this package runs and keeps only a sentence. So the SDK is handed a schema that lists
// as the true one does and lets every value through, by the two parts of the contract it reads
// a schema by, and the true schema judges the arguments below, where a failure becomes the
// refusal every other one is. The first issue stands in the details, whose keys are fixed at
// one argument; the sentence names them all. An argument no schema names is dropped, as before.
/**
 * @param {z.ZodType} schema
 * @returns {StandardSchemaWithJSON}
 */
const listedAs = (schema) => ({ "~standard": { version: 1, vendor: "companygraph-mcp-server", validate: (value) => ({ value }), jsonSchema: schema["~standard"].jsonSchema } });

/**
 * @param {Tool} tool
 * @param {unknown} args
 */
const held = (tool, args) => {
  const parsed = tool.input.safeParse(args ?? {});
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map((i) => ({ argument: i.path.length ? i.path.join(".") : "arguments", reason: i.message }));
  throw new ModelError("invalid_argument", `${tool.name} cannot take what it was given: ${issues.map((i) => `${i.argument}: ${i.reason}`).join("; ")}`, { details: issues[0] });
};

/**
 * @param {Snapshot} s
 * @param {Tool} tool
 * @returns {(args: unknown) => Promise<CallToolResult>}
 */
const run = (s, tool) => async (args) => {
  try {
    const data = tool.call(s, held(tool, args));
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
/** @type {Tool[]} */
export const TOOLS = [
  { name: "list_types",
    description: "Every type the model's schemas declare. Use first, to learn which types exist before listing or describing one. No input. Returns `types`, each with `type`, `name`, `tagline`, `owner` (the type it nests under, or null) and `count`, the entities it holds.",
    input: z.object({}),
    call: (s) => listTypes(s),
    output: OUTPUTS.list_types },

  { name: "describe_schema",
    description: "One type's schema: its sections as written and its declared relations as data. Use to learn what an entity of the type may hold; for the whole vocabulary use describe_relations. Input: `type`. Returns `url`, the schema's own file, `sections`, and `relations`: owner, owns, references both ways, enums, joins and lists.",
    input: z.object({ type: z.string().describe("A type name from list_types, such as skill") }),
    call: (s, { type }) => describeSchema(s, type),
    output: OUTPUTS.describe_schema },

  { name: "describe_relations",
    description: "What the schemas declare between types: references with form and cardinality, ownership, enums, joins, list kinds. Use for a diagram or audit; for one type's full schema use describe_schema. Optional `type` narrows every list, `direction` (declares, declared-to, both; needs `type`) one side of relations, `via` relations and enums. Returns those lists, with `forms` and `reading` explaining every term. Not paged.",
    input: z.object({ type: z.string().optional(), direction: z.enum(["declares", "declared-to", "both"]).optional(), via: z.string().optional() }),
    call: (s, args) => describeRelations(s, args),
    output: OUTPUTS.describe_relations },

  { name: "list_rules",
    description: "The vocabulary's conventions the model is held to, R0 onwards, from its core's CONVENTIONS.md. Use to resolve a number a schema or refusal cites, such as R9. A company's own rules are entities of type `rule`: list_entities and get_entity. No input. Returns `tagline`, the file's `url`, and `rules`, each with `rule`, `title` and `part`; describe_rule gives one rule's text.",
    input: z.object({}),
    call: (s) => listRules(s),
    output: OUTPUTS.list_rules },

  { name: "describe_rule",
    description: "One convention of the vocabulary as written, not a company's own rule (an entity of type `rule`: list_entities, get_entity). Input: `rule`, a number from list_rules such as R9, in either case. Returns `rule`, `title`, `part`, `text` and the file's `url`. An unknown number is refused with the known ones listed.",
    input: z.object({ rule: z.string().describe("A convention's number from list_rules, such as R9") }),
    call: (s, { rule }) => describeRule(s, rule),
    output: OUTPUTS.describe_rule },

  { name: "list_checks",
    description: "The checks the model's own gate runs, from the checker release this server was built with. Use to see which rules a script enforces and which are left to a reader. No input. Returns `checks`, each with `name`, `rule` and that rule's `title`, and `ranBy`. A list and no verdict: this server runs none of them.",
    input: z.object({}),
    call: (s) => listChecks(s),
    output: OUTPUTS.list_checks },

  { name: "describe_errors",
    description: "What a refused call looks like. A tool's output schema covers its answers only, so use this once, to branch on refusals or validate them. No input. Returns `errors`, every `code` with `when` it is raised and the JSON Schema of its `details`, and `schema`, the JSON Schema of a whole refusal: `error` with `code`, `message`, `rule`, `details`, beside `model`.",
    input: z.object({}),
    call: (s) => describeErrors(s),
    output: OUTPUTS.describe_errors },

  { name: "list_entities",
    description: "Entities in address order, or by when they came into the model. Use to browse; to find by words or name use search. Input: optional `type`, `owner` (an id or address), `order` (address, newest, oldest), `limit`, `cursor`. Returns `entities` with `id`, `type`, `name`, `tagline`, `owner`, `created`, and `page`; follow `page.nextCursor` while `page.hasMore`.",
    input: z.object({
      type: z.string().optional().describe("A type, to keep its entities; leave it out to list every type"),
      owner: z.string().optional().describe("An owner's id or address, to keep its entities"),
      order: z.enum(ORDERS).optional().describe("address, where the pages sit, by default; newest or oldest, by when each entity came into the model"),
      ...paged }),
    call: (s, { type, ...options }) => listEntities(s, type, options),
    output: OUTPUTS.list_entities },

  { name: "get_entity",
    description: "One entity as structured data: fields, sections, tables, references both ways. Use to reason over one; for its page as written use fetch. Input: `id` or address, where its page sits, or `type` and `name`; an ambiguous name is refused with candidate ids. Returns `entity`, by id. Reference lists hold at most 50 edges; `referenceCounts` gives totals, list_references the rest.",
    input: z.object({ id: z.string().optional().describe("The entity's id, as any answer gives it, or its address, where its page sits"), type: z.string().optional(), name: z.string().optional().describe("The canonical name, the entity's H1; needs type") }),
    call: (s, args) => entityBy(s, args),
    output: OUTPUTS.get_entity },

  { name: "list_references",
    description: "The model's edges, filtered and paged. Use to inspect one entity's relations or one kind of reference without taking whole entities. Optional `entity` (an id or address), `direction` (out, in, both; needs `entity`), `via`, `type` (the far end's type, or either end's without `entity`), `limit`, `cursor`. Returns `edges`, each `from`, `via`, `to`, `attrs`, and `page`.",
    input: z.object({ entity: z.string().optional(), direction: z.enum(["out", "in", "both"]).optional(), via: z.string().optional(), type: z.string().optional(), ...paged }),
    call: (s, args) => listReferences(s, args),
    output: OUTPUTS.list_references },

  { name: "find_evidence",
    description: "Every edge into one skill, grouped by the type of the page that drew it. Use to check a claimed skill against its evidence. Input: `skill`, an id, canonical name or address; optional `limit`, `cursor`. Returns `skill`, `evidence` and `page`; a profile's claim arrives via Skills.Skill with its level, an evidence row via Evidence.Skill. Attributes are verbatim.",
    input: z.object({ skill: z.string().describe("The skill's id, canonical name or address"), ...paged }),
    call: (s, { skill, ...options }) => findEvidence(s, skill, options),
    output: OUTPUTS.find_evidence },

  { name: "search",
    description: "Find entities by words, substring or exact name. `match: \"words\"` needs every query word's stem in name, tagline, fields, sections or cells; `\"text\"` (default) is a case-insensitive substring over the same; `\"name\"` the exact canonical name. Optional `type`, `owner`, `limit`, `cursor`. Returns `results` with `id`, `title`, `type`, `matched`, `words` in words mode, and `page`: name matches first, then a listing.",
    input: z.object({ query: z.string(), match: z.enum(["text", "name", "words"]).optional(), type: z.string().optional(), owner: z.string().optional().describe("An owner's id or address, to keep its entities"), ...paged }),
    call: (s, { query, ...options }) => search(s, query, options),
    output: OUTPUTS.search },

  { name: "fetch",
    description: "One entity's page as written. Use to quote or display the source; for structured fields and references use get_entity. Input: `id` or address, from search, list_entities or any reference. Returns `id`, `title`, `type`, `url` and `text`, the Markdown source. Takes no name: search with match \"name\" finds the id.",
    input: z.object({ id: z.string() }),
    call: (s, { id }) => fetchEntity(s, id),
    output: OUTPUTS.fetch },

  { name: "diagram",
    description: "A picture of the model as Mermaid, from its edges or its schemas. Use to show connections; for edges as data use list_references. Input: `shape`; `id`, `domain` or `type` narrow it. Returns `mermaid`, `nodes`, `links`, `title`, `edges`, `omitted`, schema's `everyType`. A process draws each gate's failure dashed, to a phase or one Stop node, outside `nodes`. At most 50 nodes.",
    input: z.object({ shape: z.enum(SHAPES), id: z.string().optional().describe("The process to draw, or the entity at the middle of a neighborhood"), domain: z.string().optional().describe("A domain's id or address, to draw its concepts"), type: z.string().optional().describe("A type, to draw its schema and the types it is declared with") }),
    call: (s, args) => diagram(s, args),
    output: OUTPUTS.diagram },
];

/**
 * @param {McpServer} server
 * @param {Snapshot} s
 */
export function registerTools(server, s) {
  for (const tool of TOOLS)
    server.registerTool(tool.name,
      { description: tool.description, inputSchema: listedAs(tool.input), outputSchema: tool.output },
      run(s, tool));
}
