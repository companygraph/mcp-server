// The contract as something to run: one call of every tool with arguments read from whatever
// snapshot is served, and the parse of a call's result against the schema its tool declares.
// This package's suite uses both over its fixtures and a deployment's suite uses both over the
// model it actually serves, so the two hold one contract and not two readings of it.
import { z } from "zod";
import { OUTPUTS, ErrorResult } from "./schemas.mjs";

// Arguments for every tool, from the snapshot alone. A tool the snapshot gives nothing to be
// asked about maps to undefined, and the caller skips it by name, never in silence:
// `find_evidence` where no skill is claimed, `list_rules` and `describe_rule` where the core
// ships no CONVENTIONS.md, and `list_checks` where the snapshot carries no checks array — an
// instance a deployment serves is under no obligation to have either, so a call made up against
// what isn't there would be refused for a reason the contract itself created.
export function sampleCalls(s) {
  const held = s.entities.find((e) => e.id !== s.rootId) ?? s.entities[0];
  const skill = s.entities.find((e) => e.type === "skill");
  return {
    list_types: {}, describe_schema: { type: held.type }, describe_relations: {},
    list_rules: s.rules ? {} : undefined,
    describe_rule: s.rules?.rules?.[0] ? { rule: s.rules.rules[0].rule } : undefined,
    list_checks: Array.isArray(s.checks) ? {} : undefined,
    list_entities: { type: held.type }, get_entity: { id: s.rootId }, list_references: { entity: s.rootId },
    find_evidence: skill ? { skill: skill.id } : undefined,
    search: { query: s.root, match: "name" }, fetch: { id: s.rootId },
  };
}

// The structured content of one call, held to its tool's schema, or to the error schema where
// the call was refused. The message names the tool and every field at fault.
export function checkAnswer(name, result) {
  const schema = result.isError ? ErrorResult : OUTPUTS[name];
  if (!schema) throw new Error(`${name} declares no output schema`);
  const parsed = schema.safeParse(result.structuredContent);
  if (!parsed.success) throw new Error(`${name} answered outside its schema:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
