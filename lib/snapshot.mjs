// One instance, parsed once, into the document the server serves. The parser is the
// meta-model's own and is imported, never copied: an instance is read against the schemas it
// vendors, at the commit it is read from, and the result is the parser's graph untouched, plus
// where it came from and each entity's page as written.
import fs from "node:fs";
import { parseInstance, parseSchemas, constraintsOf } from "companygraph-meta-model/instance";
import { instanceChecks } from "companygraph-meta-model/checks";
import { parseRules } from "./rules.mjs";

/**
 * @import { Entity, Edge, GraphType, Files, Constraints } from "companygraph-meta-model/instance"
 * @import { Rules } from "./rules.mjs"
 */

/**
 * The parser's entity, with its page as written.
 * @typedef {Entity & { markdown: string }} SnapshotEntity
 */
/**
 * A check the instance's gate runs, as the checker names it.
 * @typedef {{ name: string; rule: string; notes: boolean }} CheckName
 */
/**
 * The document the server serves: the parser's graph untouched, plus where it came from, the
 * vocabulary's own graph, what the schemas constrain, the rules and the checks.
 * @typedef {object} Snapshot
 * @property {string | null} commit
 * @property {string | null} repo
 * @property {{ version: string; parser: string; path: string | null }} core
 * @property {string} root
 * @property {string} rootId
 * @property {GraphType[]} types
 * @property {Entity[]} schemas
 * @property {Edge[]} schemaEdges
 * @property {Record<string, Constraints>} constraints
 * @property {Rules | null} rules
 * @property {CheckName[]} checks
 * @property {SnapshotEntity[]} entities
 * @property {Edge[]} edges
 */

/** @type {{ dependencies: Record<string, string> }} */
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// The parser's release is a fact about every answer, so it is read from the pin rather than typed.
/** @returns {string} */
export function parserTag() {
  return pkg.dependencies["companygraph-meta-model"].split("#")[1];
}

// The checks the pinned release of the checker runs over an instance, as the checker names
// them: what each is called, the rule it cites and whether it only notes, a fact worth seeing
// that fails nothing. Built and never run here. An instance's own gate runs them on every change,
// and a snapshot is only built from a commit that passed it, so the list says what the model was
// held to and claims no verdict of this package's own.
const checksOf = () => instanceChecks({ files: new Map(), fail() {} }).map(({ name, rule, notes }) => ({ name, rule, notes: notes === true }));

/**
 * @param {{ files: Files; schemas: Files; sub?: string; core?: string | null; commit?: string | null; repo?: string | null; parserTag?: string }} source
 * @returns {Snapshot}
 */
export function buildSnapshot({ files, schemas, sub = "", core = null, commit = null, repo = null, parserTag: tag = parserTag() }) {
  sub = sub && !sub.endsWith("/") ? sub + "/" : sub;
  // Where the core sits in the repository, as the builder was told. A schema's own path is
  // relative to the core, so without this a schema and a rule cannot say where their file is,
  // as an entity can. Null is "nobody said"; an empty string is a core at the repository's root.
  const corePath = typeof core === "string" ? (core && !core.endsWith("/") ? core + "/" : core) : null;
  const manifest = schemas.get("manifest.json");
  if (!manifest) throw new Error("the core carries no manifest.json, so its version cannot be reported");
  const { version } = JSON.parse(manifest);
  const graph = parseInstance(files, { sub, schemas });
  // The schemas as a graph of their own: what each type declares about the others. Its edges
  // are kept beside its entities, since they are the one copy of which type references which.
  const vocabulary = parseSchemas(schemas);
  // The parser read every entity from one of these files, so each finds its own.
  const entities = graph.entities.map((e) => ({ ...e, markdown: /** @type {string} */ (files.get(e.path.slice(sub.length))) }));
  return {
    commit, repo,
    core: { version, parser: tag, path: corePath },
    root: graph.root, rootId: graph.rootId,
    types: graph.types,
    schemas: vocabulary.entities,
    schemaEdges: vocabulary.edges,
    // What the schemas constrain, as the parser package reads it: every reference with how
    // many a page may hold, the joins between a schema's tables, the list sections.
    constraints: constraintsOf(schemas),
    rules: parseRules(schemas.get("CONVENTIONS.md")),
    checks: checksOf(),
    entities,
    edges: graph.edges,
  };
}
