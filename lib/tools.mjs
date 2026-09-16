// The seven tools, each a thin wrapper over one query: the arguments in, the query's answer
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

export function registerTools(server, s) {
  server.registerTool("list_types", {
    description: "Every type the instance's schemas declare, with its tagline, its owner type and how many entities it holds.",
    inputSchema: z.object({}), outputSchema: output,
  }, run(() => listTypes(s)));

  server.registerTool("describe_schema", {
    description: "One type's schema as the instance vendors it: file location, frontmatter fields, sections and their columns, purpose and writing rules.",
    inputSchema: z.object({ type: z.string().describe("A type name from list_types, such as skill") }), outputSchema: output,
  }, run(({ type }) => describeSchema(s, type)));

  server.registerTool("list_entities", {
    description: "The id, canonical name and tagline of every entity of one type.",
    inputSchema: z.object({ type: z.string() }), outputSchema: output,
  }, run(({ type }) => listEntities(s, type)));

  server.registerTool("get_entity", {
    description: "One entity by type and canonical name: its frontmatter, sections and tables, with every reference it makes and every reference made to it. A name resolves within its type.",
    inputSchema: z.object({ type: z.string(), name: z.string().describe("The canonical name, the entity's H1") }), outputSchema: output,
  }, run(({ type, name }) => getEntity(s, type, name)));

  server.registerTool("find_evidence", {
    description: "Everything the model says about one skill: each profile's claimed level with its Evidence verbatim, each experience that lists the skill, and any other page that references it.",
    inputSchema: z.object({ skill: z.string().describe("The skill's canonical name") }), outputSchema: output,
  }, run(({ skill }) => findEvidence(s, skill)));

  server.registerTool("search", {
    description: "Entities whose name, tagline, fields, sections or table cells contain the query, case-insensitive, listed by type then name with the fields that matched. Use fetch with a result's id.",
    inputSchema: z.object({ query: z.string() }), outputSchema: output,
  }, run(({ query }) => search(s, query)));

  server.registerTool("fetch", {
    description: "One entity by the id search returned, with its page as written. A bare name is accepted only when exactly one type holds it.",
    inputSchema: z.object({ id: z.string() }), outputSchema: output,
  }, run(({ id }) => fetchEntity(s, id)));
}
