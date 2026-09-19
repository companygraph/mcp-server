// The tools, each a thin wrapper over one query: the arguments in, the query's answer
// out as structured content and as the same JSON in text, a ModelError out as a tool error
// with its sentence. Descriptions say what a tool does and name no instance fact.
import { z } from "zod";
import { ModelError, listTypes, describeSchema, listEntities, getEntity, findEvidence, search, fetchEntity } from "./model.mjs";

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
    description: "One type's schema as the instance vendors it: file location, frontmatter fields, sections and their columns, purpose and writing rules.",
    input: z.object({ type: z.string().describe("A type name from list_types, such as skill") }),
    call: (s, { type }) => describeSchema(s, type) },

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
