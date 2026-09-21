// The tools, each a thin wrapper over one query: the arguments in, the query's answer out as
// structured content and as the same JSON in text. A refusal goes out as a tool error whose text
// is its sentence and whose structured content is the same refusal as data, under `error`, so a
// client branches on a code and reads candidates from a list. Each tool names the schema of what
// it answers, and the SDK holds every successful answer to it before it leaves.
import { z } from "zod";
import { ModelError, provenance, listTypes, describeSchema, describeRelations, listRules, describeRule, listChecks, listEntities, entityBy, listReferences, findEvidence, search, fetchEntity } from "./model.mjs";
import { OUTPUTS } from "./schemas.mjs";

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

// Each tool as data: its name, what it does, what it takes and the query it runs. The list is
// the single copy — `registerTools` builds the server from it and the landing page prints it,
// so a tool cannot appear in one and not the other.
export const TOOLS = [
  { name: "list_types",
    description: "Every type the instance's schemas declare, with its tagline, its owner type and how many entities it holds.",
    input: z.object({}),
    call: (s) => listTypes(s),
    output: OUTPUTS.list_types },

  { name: "describe_schema",
    description: "One type's schema as the instance vendors it: file location, frontmatter fields, sections and their columns, purpose and writing rules. Its relations come beside it as data, both ways: the type that owns it, the types it owns, each reference it declares and each reference another schema declares to it, with how many a page may hold, the values each of its enums permits, and the joins and list kinds the schema declares.",
    input: z.object({ type: z.string().describe("A type name from list_types, such as skill") }),
    call: (s, { type }) => describeSchema(s, type),
    output: OUTPUTS.describe_schema },

  { name: "describe_relations",
    description: "Every reference the schemas declare between types, as data read from their tables: the type that declares it, the field or Section.Column it is declared on, the type it names, its form (ref, ref? or qualifier), whether it is a list, whether it is required and how many of it a page may hold (min and max); which type owns which; the values every field or column typed enum permits; the joins a schema declares between its tables, among them the tables whose repeated references carry distinct roles; and the kind of list each list section holds. Every term is explained in the answer. The whole vocabulary and what it constrains in one answer, for a diagram or an audit.",
    input: z.object({ type: z.string().optional(), direction: z.enum(["declares", "declared-to", "both"]).optional(), via: z.string().optional() }),
    call: (s, args) => describeRelations(s, args),
    output: OUTPUTS.describe_relations },

  { name: "list_rules",
    description: "The rules the instance is held to, from the CONVENTIONS.md its core vendors: each rule's number, its title and the part of the file it stands in. A schema cites a rule by number, such as R9, and this is where the number is read.",
    input: z.object({}),
    call: (s) => listRules(s),
    output: OUTPUTS.list_rules },

  { name: "describe_rule",
    description: "One rule as written, by its number.",
    input: z.object({ rule: z.string().describe("A rule's number from list_rules, such as R9") }),
    call: (s, { rule }) => describeRule(s, rule),
    output: OUTPUTS.describe_rule },

  { name: "list_checks",
    description: "Every check the checker runs over an instance, from the checker release this server was built with: what each is called, the rule it cites and that rule's title. A list and no verdict, since this server runs none of them; the answer says who does. It shows which rules a script enforces and which are left to a reader.",
    input: z.object({}),
    call: (s) => listChecks(s),
    output: OUTPUTS.list_checks },

  { name: "list_entities",
    description: "The id, canonical name and tagline of every entity of one type.",
    input: z.object({ type: z.string(), owner: z.string().optional().describe("An owner's id, to keep its entities"), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, { type, ...options }) => listEntities(s, type, options),
    output: OUTPUTS.list_entities },

  { name: "get_entity",
    description: "One entity by type and canonical name: its frontmatter, sections and tables, with every reference it makes and every reference made to it. A name resolves within its type; a name of an owned type, such as an experience or a phase, is unique only within its owner, and one held by two owners is refused with every id named, for fetch.",
    input: z.object({ id: z.string().optional().describe("The entity's id, as any answer gives it"), type: z.string().optional(), name: z.string().optional().describe("The canonical name, the entity's H1; needs type") }),
    call: (s, args) => entityBy(s, args),
    output: OUTPUTS.get_entity },

  { name: "list_references",
    description: "The model's edges, filtered and paged. Use to inspect one entity's relations or one kind of reference without taking whole entities. Optional `entity` (an id), `direction` (out, in, both; needs `entity`), `via`, `type` (the far end's type, or either end's without `entity`), `limit`, `cursor`. Returns `edges`, each `from`, `via`, `to`, `attrs`, and `page`.",
    input: z.object({ entity: z.string().optional(), direction: z.enum(["out", "in", "both"]).optional(), via: z.string().optional(), type: z.string().optional(), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, args) => listReferences(s, args),
    output: OUTPUTS.list_references },

  { name: "find_evidence",
    description: "Everything the model says about one skill, every edge into it grouped by the type of the page that drew it: a profile's claim, via Skills.Skill, with its level; each evidence row under that claim, via Evidence.Skill, with what it shows and the experience it came from; each experience that lists the skill; and any other page that references it. Attributes are verbatim.",
    input: z.object({ skill: z.string().describe("The skill's id or canonical name") }),
    call: (s, { skill }) => findEvidence(s, skill),
    output: OUTPUTS.find_evidence },

  { name: "search",
    description: "Entities whose name, tagline, fields, sections or table cells contain the query, case-insensitive, listed by type then name with the fields that matched. Use fetch with a result's id.",
    input: z.object({ query: z.string(), match: z.enum(["text", "name"]).optional(), type: z.string().optional(), owner: z.string().optional().describe("An owner's id, to keep its entities"), limit: z.number().int().optional(), cursor: z.string().optional() }),
    call: (s, { query, ...options }) => search(s, query, options),
    output: OUTPUTS.search },

  { name: "fetch",
    description: "One entity by the id search returned, with its page as written. A bare name is accepted only when exactly one type holds it.",
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
