// The tools, each a thin wrapper over one query: the arguments in, the query's answer
// out as structured content and as the same JSON in text, a ModelError out as a tool error
// with its sentence. Descriptions say what a tool does and name no instance fact.
import { z } from "zod";
import { ModelError, listTypes, describeSchema, describeRelations, listRules, describeRule, listChecks, listEntities, getEntity, findEvidence, search, fetchEntity } from "./model.mjs";

const model = z.object({ commit: z.string().nullable(), repo: z.string().nullable(), core: z.string(), parser: z.string() });
const output = z.looseObject({ model });

const run = (fn) => async (args) => {
  try {
    const data = fn(args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
  } catch (err) {
    if (err instanceof ModelError) return { isError: true, content: [{ type: "text", text: err.message }] };
    throw err;
  }
};

// Each tool as data: its name, what it does, what it takes and the query it runs. The list is
// the single copy — `registerTools` builds the server from it and the landing page prints it,
// so a tool cannot appear in one and not the other.
export const TOOLS = [
  { name: "list_types",
    description: "Every type the instance's schemas declare, with its tagline, its owner type and how many entities it holds.",
    input: z.object({}),
    call: (s) => listTypes(s) },

  { name: "describe_schema",
    description: "One type's schema as the instance vendors it: file location, frontmatter fields, sections and their columns, purpose and writing rules. Its relations come beside it as data, both ways: the type that owns it, the types it owns, each reference it declares and each reference another schema declares to it, with how many a page may hold, the values each of its enums permits, and the joins and list kinds the schema declares.",
    input: z.object({ type: z.string().describe("A type name from list_types, such as skill") }),
    call: (s, { type }) => describeSchema(s, type) },

  { name: "describe_relations",
    description: "Every reference the schemas declare between types, as data read from their tables: the type that declares it, the field or Section.Column it is declared on, the type it names, its form (ref, ref? or qualifier), whether it is a list, whether it is required and how many of it a page may hold (min and max); which type owns which; the values every field or column typed enum permits; the joins a schema declares between its tables, among them the tables whose repeated references carry distinct roles; and the kind of list each list section holds. Every term is explained in the answer. The whole vocabulary and what it constrains in one answer, for a diagram or an audit.",
    input: z.object({}),
    call: (s) => describeRelations(s) },

  { name: "list_rules",
    description: "The rules the instance is held to, from the CONVENTIONS.md its core vendors: each rule's number, its title and the part of the file it stands in. A schema cites a rule by number, such as R9, and this is where the number is read.",
    input: z.object({}),
    call: (s) => listRules(s) },

  { name: "describe_rule",
    description: "One rule as written, by its number.",
    input: z.object({ rule: z.string().describe("A rule's number from list_rules, such as R9") }),
    call: (s, { rule }) => describeRule(s, rule) },

  { name: "list_checks",
    description: "Every check the checker runs over an instance, from the checker release this server was built with: what each is called, the rule it cites and that rule's title. A list and no verdict, since this server runs none of them; the answer says who does. It shows which rules a script enforces and which are left to a reader.",
    input: z.object({}),
    call: (s) => listChecks(s) },

  { name: "list_entities",
    description: "The id, canonical name and tagline of every entity of one type.",
    input: z.object({ type: z.string() }),
    call: (s, { type }) => listEntities(s, type) },

  { name: "get_entity",
    description: "One entity by type and canonical name: its frontmatter, sections and tables, with every reference it makes and every reference made to it. A name resolves within its type; a name of an owned type, such as an experience or a phase, is unique only within its owner, and one held by two owners is refused with every id named, for fetch.",
    input: z.object({ type: z.string(), name: z.string().describe("The canonical name, the entity's H1") }),
    call: (s, { type, name }) => getEntity(s, type, name) },

  { name: "find_evidence",
    description: "Everything the model says about one skill, every edge into it grouped by the type of the page that drew it: a profile's claim, via Skills.Skill, with its level; each evidence row under that claim, via Evidence.Skill, with what it shows and the experience it came from; each experience that lists the skill; and any other page that references it. Attributes are verbatim.",
    input: z.object({ skill: z.string().describe("The skill's canonical name") }),
    call: (s, { skill }) => findEvidence(s, skill) },

  { name: "search",
    description: "Entities whose name, tagline, fields, sections or table cells contain the query, case-insensitive, listed by type then name with the fields that matched. Use fetch with a result's id.",
    input: z.object({ query: z.string() }),
    call: (s, { query }) => search(s, query) },

  { name: "fetch",
    description: "One entity by the id search returned, with its page as written. A bare name is accepted only when exactly one type holds it.",
    input: z.object({ id: z.string() }),
    call: (s, { id }) => fetchEntity(s, id) },
];

export function registerTools(server, s) {
  for (const tool of TOOLS)
    server.registerTool(tool.name,
      { description: tool.description, inputSchema: tool.input, outputSchema: output },
      run((args) => tool.call(s, args ?? {})));
}
