import { ModelError } from "./errors.mjs";
import { paginate } from "./paging.mjs";

// The queries over a snapshot. Pure: a snapshot in, a JSON-shaped answer out, and every
// answer carries where it came from. Types and their descriptions come from the parsed
// schemas, so nothing here enumerates the vocabulary; references come from the parser's edges,
// so nothing here decides what a field means. A name resolves within a type (R2); a name that
// resolves to nothing is an error (R4); a name asked without a type that more than one type
// holds is refused with the types named, never given to the first match.

export { ModelError };

export const provenance = (s) => ({ commit: s.commit, repo: s.repo, core: s.core.version, parser: s.core.parser });

const declaredTypes = (s) => s.schemas.map((x) => x.id.slice("core/".length));
const schemaOf = (s, type) => s.schemas.find((x) => x.id === "core/" + type);
const requireType = (s, type) => {
  const schema = schemaOf(s, type);
  if (!schema) throw new ModelError("unknown_type", `no schema declares "${type}"; the declared types are ${declaredTypes(s).join(", ")}`, { details: { type, declared: declaredTypes(s) } });
  return schema;
};
const index = (s) => new Map(s.entities.map((e) => [e.id, e]));
const fileUrl = (s, e) => (s.repo && s.commit ? `https://github.com/${s.repo}/blob/${s.commit}/${e.path}` : null);
const ref = (e) => ({ id: e.id, type: e.type, name: e.name });

// An entity as a candidate: what a caller needs to pick one of several holding a name.
const candidate = (e) => ({ ...ref(e), owner: e.owner ?? null });

// A qualifier the parser resolved arrives as an id; the reader wants the name beside it.
const resolveAttrs = (byId, attrs) =>
  Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, byId.has(v) ? ref(byId.get(v)) : v]));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// An edge as every answer serves it: both ends named, since a list of edges belongs to no single
// entity, and an entity's own answer uses the same shape so a client reads one thing.
const edgeOf = (byId, x) => ({ from: ref(byId.get(x.from)), via: x.via, to: ref(byId.get(x.to)), attrs: resolveAttrs(byId, x.attrs) });

// Every edge of the instance in one fixed order, which is what lets a cursor be an offset. Who
// owns an entity is nesting on disk, so the parser records it as the entity's `owner` rather
// than as an edge; it is served as one, from the owned to its owner, via `owner`. A schema's own
// `owner` field draws an edge of that name too, as it always has, and the far end's type tells
// the two apart. The sort is stable, so two rows that draw the same edge keep the page's order.
const allEdges = (s) => {
  const byId = index(s);
  const nesting = s.entities.filter((e) => e.owner && byId.has(e.owner)).map((e) => ({ from: e.id, via: "owner", to: e.owner, attrs: {} }));
  return [...s.edges, ...nesting].map((x) => edgeOf(byId, x))
    .sort((a, b) => cmp(a.from.id, b.from.id) || cmp(a.via, b.via) || cmp(a.to.id, b.to.id));
};

const requireId = (s, id) => {
  const e = index(s).get(id);
  if (!e) throw new ModelError("unknown_entity", `nothing has the id "${id}"; search with match "name" finds an entity's id by its name`, { details: { id } });
  return e;
};

// The parser gives a section its first table twice, as `tables[0]` and as `table`, one object
// in memory and two copies once written out. An answer carries `tables` alone.
const serveSections = (sections) => sections.map(({ table, ...section }) => section);

// An entity as an answer serves it: the page's content as data and its edges both ways, in the
// shape and the order `list_references` gives them. An entity's own content is never cut. Its
// edges are, at a cap, because one profile of the reference instance draws several hundred and
// an answer is read whole; `referenceCounts` says how many exist, so a client sees when it holds
// a part and takes the rest where edges are paged.
export const REFERENCE_CAP = 50;

const serveEntity = (s, e) => {
  const { markdown, sections, ...rest } = e;
  const edges = allEdges(s);
  const references = edges.filter((x) => x.from.id === e.id);
  const referencedBy = edges.filter((x) => x.to.id === e.id);
  return { ...rest, owner: e.owner ?? null, sections: serveSections(sections), url: fileUrl(s, e),
    references: references.slice(0, REFERENCE_CAP), referencedBy: referencedBy.slice(0, REFERENCE_CAP),
    referenceCounts: { references: references.length, referencedBy: referencedBy.length } };
};

// A name resolves within its type, and since core 0.31.0 an owned type's names within their owner,
// so two owners may each hold one name. Handed the first, a caller would get another owner's
// entity without being told; two are refused with every id named, and an id reaches each.
const resolveTyped = (s, type, name) => {
  requireType(s, type);
  const found = s.entities.filter((x) => x.type === type && x.name === name);
  if (found.length === 0) throw new ModelError("unknown_entity", `R4: "${name}" names no ${type}`, { rule: "R4", details: { type, name } });
  if (found.length > 1)
    throw new ModelError("ambiguous_name", `R2: "${name}" is the name of ${found.length} ${type} entities, one in each of their owners (${found.map((x) => x.id).join(", ")}); ask for the one meant by its id`,
      { rule: "R2", details: { type, name, candidates: found.map(candidate) } });
  return found[0];
};

export function listTypes(s) {
  const counts = new Map();
  for (const e of s.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  const types = s.schemas.map((schema) => {
    const type = schema.id.slice("core/".length);
    const t = s.types.find((x) => x.type === type);
    return { type, name: schema.name, tagline: schema.tagline, owner: t?.owner ?? null, count: counts.get(type) ?? 0 };
  });
  return { types, model: provenance(s) };
}

// What the schemas declare about each other. The parser package reads all of it: the vocabulary
// as a graph, whose ownership edges say which type nests in which, and `constraintsOf`, which
// gives every declared reference with its form and how many of it a page may hold, the values
// every enum permits, the joins a schema declares between its tables, and the kind of list a
// section holds. Nothing here reads
// a cell or a Description, so nothing here decides what one means. A snapshot built before
// these were kept cannot answer, and says so: an empty list would read as a vocabulary in
// which nothing references anything and nothing is constrained.
const typeOf = (id) => id.slice("core/".length);

const relationsOf = (s) => {
  if (!Array.isArray(s.schemaEdges) || !s.constraints || Object.values(s.constraints).some((c) => !Array.isArray(c.enums)))
    throw new ModelError("unsupported_snapshot", "this snapshot was written before the schemas' declarations and constraints were kept in it; rebuild it with this release to ask what the types declare about each other", { details: { missing: "schemaEdges and constraints" } });
  const ownership = s.schemaEdges.filter((e) => e.attrs?.type === undefined).map((e) => ({ owner: typeOf(e.to), owned: typeOf(e.from) }));
  const relations = [], enums = [], joins = [], lists = [];
  for (const [type, c] of Object.entries(s.constraints)) {
    for (const { via, form, target, array, required, min, max } of c.references)
      relations.push({ from: type, via, to: target, form, array, required, min, max });
    for (const e of c.enums) enums.push({ type, ...e });
    for (const j of c.joins) joins.push({ type, ...j });
    for (const l of c.lists) lists.push({ type, ...l });
  }
  return { relations, ownership, enums, joins, lists };
};

// Said once, beside the data that uses them, in the words R9 and R16 give them.
const FORMS = {
  "ref": "A reference. The value is the canonical name of an entity of the named type, it must resolve, and it draws an edge.",
  "ref?": "A reference where it resolves. The value draws an edge when it names an entity of the named type and stays a plain fact when it names anything else.",
  "qualifier": "A qualifier. The value must resolve to an entity of the named type and draws no edge of its own: it is an attribute of the edge its row's reference drew.",
};

// How to read the numbers and the joins, in the words R9 and R16 give them.
const READING = {
  "required": "Of a frontmatter field, whether a page may leave it out. Of a column or a grouped heading, whether each row or heading must fill it.",
  "min and max": "How many of the reference one page may hold. A field holds one value or a list, and a required list carries at least one entry. A column and a heading are of a row, and nothing bounds how many rows a table has, so there min is 0 and max is open. A max of null is open.",
  "under": "A join: the section's table and the one it stands under reference the same entities, both ways, so nothing here stands under something the other never names and nothing named there is left without a row here.",
  "lists": "A join: the entity the column's cell names carries, in the named field, the entity the same row's `by` column names. A blank cell is held to nothing.",
  "roles": "A join: where two rows of the section's table name the same entity in the `by` column, each carries a value in the named column and no two carry the same one, because that value is the only thing telling the two edges apart.",
  "enums": "The values a field or a column typed enum permits, named by `via` as a reference is. A value outside them is an error; `required` reads as it does for a reference.",
};

export function describeRelations(s) {
  return { ...relationsOf(s), forms: FORMS, reading: READING, model: provenance(s) };
}

export function describeSchema(s, type) {
  const schema = requireType(s, type);
  const { relations, ownership, enums, joins, lists } = relationsOf(s);
  const own = {
    owner: ownership.find((x) => x.owned === type)?.owner ?? null,
    owns: ownership.filter((x) => x.owner === type).map((x) => x.owned),
    references: relations.filter((x) => x.from === type).map(({ from, ...x }) => x),
    referencedBy: relations.filter((x) => x.to === type).map(({ to, ...x }) => x),
    enums: enums.filter((x) => x.type === type).map(({ type: _, ...x }) => x),
    joins: joins.filter((x) => x.type === type).map(({ type: _, ...x }) => x),
    lists: lists.filter((x) => x.type === type).map(({ type: _, ...x }) => x),
  };
  return { type, name: schema.name, tagline: schema.tagline, sections: serveSections(schema.sections), relations: own, model: provenance(s) };
}

// The rules the instance's core ships, from the CONVENTIONS.md it vendors. A core without the
// file is refused by name, since an empty list would say the instance is held to nothing.
const rulesOf = (s) => {
  if (!s.rules) throw new ModelError("unsupported_snapshot", "the core this instance vendors carries no CONVENTIONS.md, or the snapshot was written before its rules were kept; the rules cannot be reported", { details: { missing: "rules" } });
  return s.rules;
};

export function listRules(s) {
  const { tagline, rules } = rulesOf(s);
  return { tagline, rules: rules.map(({ rule, title, part }) => ({ rule, title, part })), model: provenance(s) };
}

export function describeRule(s, rule) {
  const { rules } = rulesOf(s);
  const wanted = String(rule ?? "").trim().toUpperCase();
  const found = rules.find((x) => x.rule === wanted);
  if (!found) throw new ModelError("unknown_rule", `"${rule}" names no rule; the rules are ${rules.map((x) => x.rule).join(", ")}`, { details: { rule: String(rule ?? ""), rules: rules.map((x) => x.rule) } });
  return { ...found, model: provenance(s) };
}

// The entities of one type, by id, a page at a time. An owned type's entities are kept to one
// owner where one is named, which is how a client lists one profile's experiences.
export function listEntities(s, type, { owner, limit, cursor } = {}) {
  requireType(s, type);
  if (owner !== undefined) requireId(s, owner);
  const all = s.entities.filter((e) => e.type === type && (owner === undefined || e.owner === owner))
    .map((e) => ({ id: e.id, type: e.type, name: e.name, tagline: e.tagline, owner: e.owner ?? null }))
    .sort((a, b) => cmp(a.id, b.id));
  const { items, page } = paginate(all, { limit, cursor }, s.commit);
  return { type, entities: items, page, model: provenance(s) };
}

// By type and name, by id, and the tool's own entry, which takes either. A name of an owned type
// may be held by two owners, and an id is what reaches one of them; given both, the id wins,
// since it cannot be ambiguous. The first keeps its arguments because a deployment's suite calls it.
export function getEntity(s, type, name) {
  return { entity: serveEntity(s, resolveTyped(s, type, name)), model: provenance(s) };
}

export function getEntityById(s, id) {
  return { entity: serveEntity(s, requireId(s, id)), model: provenance(s) };
}

export function entityBy(s, { id, type, name } = {}) {
  if (id !== undefined) return getEntityById(s, id);
  if (type !== undefined && name !== undefined) return getEntity(s, type, name);
  throw new ModelError("invalid_argument", "get_entity takes an id, or a type and a name", { details: { argument: "id", reason: "give an id, or a type and a name" } });
}

// The instance's edges, filtered and paged. Direction reads relative to an entity, so without
// one it has nothing to be relative to and is refused rather than ignored; `type` is the far
// end's type when an entity is given and either end's when none is.
const DIRECTIONS = ["out", "in", "both"];

export function listReferences(s, { entity, direction, via, type, limit, cursor } = {}) {
  if (direction !== undefined && !DIRECTIONS.includes(direction))
    throw new ModelError("invalid_argument", `direction is one of ${DIRECTIONS.join(", ")}`, { details: { argument: "direction", reason: `one of ${DIRECTIONS.join(", ")}` } });
  if (entity === undefined && direction !== undefined)
    throw new ModelError("invalid_argument", "direction reads relative to an entity; name one with `entity`, or leave direction out", { details: { argument: "direction", reason: "needs entity" } });
  if (entity !== undefined) requireId(s, entity);
  if (type !== undefined) requireType(s, type);
  const dir = direction ?? "both";
  const kept = allEdges(s).filter((x) => {
    if (via !== undefined && x.via !== via) return false;
    if (entity === undefined) return type === undefined || x.from.type === type || x.to.type === type;
    const out = dir !== "in" && x.from.id === entity;
    const into = dir !== "out" && x.to.id === entity;
    if (!out && !into) return false;
    return type === undefined || (out && x.to.type === type) || (into && x.from.type === type);
  });
  const { items, page } = paginate(kept, { limit, cursor }, s.commit);
  return { edges: items, page, model: provenance(s) };
}

// Every edge into the skill, grouped by the type of the page that drew it. A profile's rows
// arrive with the columns its schema declares beside the reference, under their own names and
// verbatim — in core the Skills row's Level, and each Evidence row's What it shows and the
// Experience it came from — and `via` says which table drew each; an experience arrives with its
// stamp and owner. Nothing here names a column. The skill is named by id or by canonical name.
export function findEvidence(s, skill) {
  const byId = index(s);
  const held = byId.get(skill);
  const e = held?.type === "skill" ? held : resolveTyped(s, "skill", skill);
  const evidence = {};
  for (const x of allEdges(s).filter((x) => x.to.id === e.id)) {
    const from = byId.get(x.from.id);
    const entry = { ...x, owner: from.owner ?? null };
    if (from.stamp) entry.stamp = from.stamp;
    (evidence[from.type] ??= []).push(entry);
  }
  return { skill: { ...ref(e), tagline: e.tagline }, evidence, model: provenance(s) };
}

// Two ways to find an entity. `text` is a substring over everything an entity says, reported by
// where it hit; `name` is the exact canonical name, which is how a caller holding a name reaches
// the ids of everything that carries it, under whichever type or owner. Both are case-insensitive
// and both answer in one order, type then name then id: a listing, not a ranking.
const MATCHES = ["text", "name"];

export function search(s, query, { match = "text", type, owner, limit, cursor } = {}) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) throw new ModelError("invalid_argument", "search needs a query", { details: { argument: "query", reason: "empty" } });
  if (!MATCHES.includes(match)) throw new ModelError("invalid_argument", `match is one of ${MATCHES.join(", ")}`, { details: { argument: "match", reason: `one of ${MATCHES.join(", ")}` } });
  if (type !== undefined) requireType(s, type);
  if (owner !== undefined) requireId(s, owner);
  const hit = (text) => typeof text === "string" && text.toLowerCase().includes(q);
  const matchedIn = (e) => {
    if (match === "name") return e.name.toLowerCase() === q ? [{ where: "name", key: null }] : [];
    const matched = [];
    if (hit(e.name)) matched.push({ where: "name", key: null });
    if (hit(e.tagline)) matched.push({ where: "tagline", key: null });
    for (const [k, v] of Object.entries(e.fields)) if ([v].flat().some(hit)) matched.push({ where: "field", key: k });
    for (const sec of e.sections) {
      if (hit(sec.text)) matched.push({ where: "section", key: sec.heading });
      if (sec.tables.some((t) => t.rows.some((row) => row.some(hit)))) matched.push({ where: "table", key: sec.heading });
    }
    return matched;
  };
  const results = [];
  for (const e of s.entities) {
    if ((type !== undefined && e.type !== type) || (owner !== undefined && e.owner !== owner)) continue;
    const matched = matchedIn(e);
    if (matched.length) results.push({ id: e.id, title: e.name, type: e.type, owner: e.owner ?? null, tagline: e.tagline, url: fileUrl(s, e), matched });
  }
  results.sort((a, b) => cmp(a.type, b.type) || cmp(a.title, b.title) || cmp(a.id, b.id));
  const { items, page } = paginate(results, { limit, cursor }, s.commit);
  return { query, match, results: items, page, model: provenance(s) };
}

// An id first. A bare name resolves only when exactly one type holds it; two types holding it
// is the R2 case, refused with both named, never handed to the first.
export function fetchEntity(s, id) {
  const byId = index(s);
  let e = byId.get(id);
  if (!e) {
    const named = s.entities.filter((x) => x.name === id);
    if (named.length > 1) {
      const types = [...new Set(named.map((x) => x.type))];
      throw new ModelError("ambiguous_name",
        types.length > 1
          ? `R2: "${id}" is the name of ${named.length} entities of different types (${types.join(", ")}); ask by type with get_entity, or fetch by id (${named.map((x) => x.id).join(", ")})`
          : `R2: "${id}" is the name of ${named.length} ${types[0]} entities, one in each of their owners (${named.map((x) => x.id).join(", ")}); fetch the one meant by its id`,
        { rule: "R2", details: { type: types.length === 1 ? types[0] : null, name: id, candidates: named.map(candidate) } });
    }
    if (named.length === 0) throw new ModelError("unknown_entity", `nothing has the id or the name "${id}"`, { details: { id } });
    e = named[0];
  }
  return { id: e.id, title: e.name, text: e.markdown, url: fileUrl(s, e), entity: serveEntity(s, e), model: provenance(s) };
}

// The checks an instance is held to, from the checker release this snapshot was built with,
// each with the rule it cites and that rule's title where the core ships its rules. It is a
// list and no verdict: this package runs no check, and the answer says who does.
const RAN_BY = "The instance's own gate runs these on every change to it, with the checker release its manifest pins, and a commit reaches its main branch only when they pass. They are listed here and not run by this server.";

export function listChecks(s) {
  if (!Array.isArray(s.checks))
    throw new ModelError("unsupported_snapshot", "this snapshot was written before the checker's list of checks was kept in it; rebuild it with this release to ask what the instance is held to", { details: { missing: "checks" } });
  const titles = new Map((s.rules?.rules ?? []).map((r) => [r.rule, r.title]));
  return { checks: s.checks.map((c) => ({ ...c, title: titles.get(c.rule) ?? null })), ranBy: RAN_BY, model: provenance(s) };
}

