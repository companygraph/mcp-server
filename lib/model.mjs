// The queries over a snapshot. Pure: a snapshot in, a JSON-shaped answer out, and every
// answer carries where it came from. Types and their descriptions come from the parsed
// schemas, so nothing here enumerates the vocabulary; references come from the parser's edges,
// so nothing here decides what a field means. A name resolves within a type (R2); a name that
// resolves to nothing is an error (R4); a name asked without a type that more than one type
// holds is refused with the types named, never given to the first match.

import { declarationOf } from "companygraph-meta-model/instance";

export class ModelError extends Error {}

export const provenance = (s) => ({ commit: s.commit, repo: s.repo, core: s.core.version, parser: s.core.parser });

const declaredTypes = (s) => s.schemas.map((x) => x.id.slice("core/".length));
const schemaOf = (s, type) => s.schemas.find((x) => x.id === "core/" + type);
const requireType = (s, type) => {
  const schema = schemaOf(s, type);
  if (!schema) throw new ModelError(`no schema declares "${type}"; the declared types are ${declaredTypes(s).join(", ")}`);
  return schema;
};
const index = (s) => new Map(s.entities.map((e) => [e.id, e]));
const fileUrl = (s, e) => (s.repo && s.commit ? `https://github.com/${s.repo}/blob/${s.commit}/${e.path}` : null);
const ref = (e) => ({ id: e.id, type: e.type, name: e.name });

// A qualifier the parser resolved arrives as an id; the reader wants the name beside it.
const resolveAttrs = (byId, attrs) =>
  Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, byId.has(v) ? ref(byId.get(v)) : v]));

// The parser gives a section its first table twice, as `tables[0]` and as `table`, one object
// in memory and two copies once written out. An answer carries `tables` alone.
const serveSections = (sections) => sections.map(({ table, ...section }) => section);

// Who owns an entity is nesting on disk, so the parser records it as the entity's `owner` rather
// than as an edge. An answer serves it as one anyway, both ways and under the name the schema
// graph gives it, so a page lists what nests under it.
const withReferences = (s, e) => {
  const byId = index(s);
  const { markdown, sections, ...rest } = e;
  const owner = e.owner && byId.has(e.owner) ? [{ via: "owner", ...ref(byId.get(e.owner)), attrs: {} }] : [];
  const owned = s.entities.filter((x) => x.owner === e.id).map((x) => ({ via: "owner", ...ref(x), attrs: {} }));
  const references = s.edges.filter((x) => x.from === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.to)), attrs: resolveAttrs(byId, x.attrs) }));
  const referencedBy = s.edges.filter((x) => x.to === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.from)), attrs: resolveAttrs(byId, x.attrs) }));
  return { ...rest, sections: serveSections(sections), url: fileUrl(s, e), references: [...owner, ...references], referencedBy: [...referencedBy, ...owned] };
};

// A name resolves within its type, and since core 0.31.0 an owned type's names within their owner,
// so two owners may each hold one name. Handed the first, a caller would get another owner's
// entity without being told; two are refused with every id named, and `fetch` takes the id.
const resolveTyped = (s, type, name) => {
  requireType(s, type);
  const found = s.entities.filter((x) => x.type === type && x.name === name);
  if (found.length === 0) throw new ModelError(`R4: "${name}" names no ${type}`);
  if (found.length > 1)
    throw new ModelError(`R2: "${name}" is the name of ${found.length} ${type} entities, one in each of their owners (${found.map((x) => x.id).join(", ")}); fetch the one meant by its id`);
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

// What the schemas declare about each other. The parser draws the vocabulary as a graph — an
// edge per Type cell that names a type, the cell travelling on it as written, and an edge per
// owner line a schema opens with — and the forms are read by the parser's own `declarationOf`, so nothing
// here decides what a cell means. The one thing read here is the row's Required cell, which the
// parser has no use for. A snapshot built before the edges were kept cannot answer, and says so:
// an empty list would read as a vocabulary in which nothing references anything.
const bare = (cell) => (cell ?? "").replace(/`/g, "").trim();
const typeOf = (id) => id.slice("core/".length);

const vocabularyEdges = (s) => {
  if (!Array.isArray(s.schemaEdges))
    throw new ModelError("this snapshot was written before the schemas' declarations were kept in it; rebuild it with this release to ask what the types declare about each other");
  return s.schemaEdges;
};

// The row an edge was read from: a frontmatter field by its name, a column or a grouped
// section's heading by `Section.Name`, found under the caption that names the section.
const declaringRow = (schema, via) => {
  const dot = via.indexOf(".");
  const tables = dot < 0
    ? (schema.sections.find((x) => x.heading === "Frontmatter")?.tables ?? []).slice(0, 1)
    : (schema.sections.find((x) => x.heading === "Sections")?.tables ?? [])
        .filter((t) => t.caption && bare(t.caption.split("`")[1] ?? "").replace(/^##\s*/, "") === via.slice(0, dot));
  const name = dot < 0 ? via : via.slice(dot + 1);
  for (const t of tables) {
    const key = ["Field", "Column", "Heading"].map((c) => t.columns.indexOf(c)).find((i) => i >= 0);
    const row = key === undefined ? null : t.rows.find((r) => bare(r[key]) === name);
    if (row) return { columns: t.columns, row };
  }
  return null;
};

const relationsOf = (s) => {
  const byId = new Map(s.schemas.map((x) => [x.id, x]));
  const relations = [], ownership = [];
  for (const e of vocabularyEdges(s)) {
    const cell = e.attrs?.type;
    if (cell === undefined) { ownership.push({ owner: typeOf(e.to), owned: typeOf(e.from) }); continue; }
    const declared = declaringRow(byId.get(e.from), e.via);
    const required = declared ? bare(declared.row[declared.columns.indexOf("Required")]) === "Yes" : false;
    relations.push({ from: typeOf(e.from), via: e.via, to: typeOf(e.to), form: declarationOf(cell).form,
                     array: bare(cell).startsWith("array of "), required });
  }
  return { relations, ownership };
};

// Said once, beside the data that uses them, in the words R9 and R16 give them.
const FORMS = {
  "ref": "A reference. The value is the canonical name of an entity of the named type, it must resolve, and it draws an edge.",
  "ref?": "A reference where it resolves. The value draws an edge when it names an entity of the named type and stays a plain fact when it names anything else.",
  "qualifier": "A qualifier. The value must resolve to an entity of the named type and draws no edge of its own: it is an attribute of the edge its row's reference drew.",
};

export function describeRelations(s) {
  return { ...relationsOf(s), forms: FORMS, model: provenance(s) };
}

export function describeSchema(s, type) {
  const schema = requireType(s, type);
  const { relations, ownership } = relationsOf(s);
  const own = {
    owner: ownership.find((x) => x.owned === type)?.owner ?? null,
    owns: ownership.filter((x) => x.owner === type).map((x) => x.owned),
    references: relations.filter((x) => x.from === type).map(({ from, ...x }) => x),
    referencedBy: relations.filter((x) => x.to === type).map(({ to, ...x }) => x),
  };
  return { type, name: schema.name, tagline: schema.tagline, sections: serveSections(schema.sections), relations: own, model: provenance(s) };
}

// The rules the instance's core ships, from the CONVENTIONS.md it vendors. A core without the
// file is refused by name, since an empty list would say the instance is held to nothing.
const rulesOf = (s) => {
  if (!s.rules) throw new ModelError("the core this instance vendors carries no CONVENTIONS.md, or the snapshot was written before its rules were kept; the rules cannot be reported");
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
  if (!found) throw new ModelError(`"${rule}" names no rule; the rules are ${rules.map((x) => x.rule).join(", ")}`);
  return { ...found, model: provenance(s) };
}

export function listEntities(s, type) {
  requireType(s, type);
  const entities = s.entities.filter((e) => e.type === type).map(({ id, name, tagline, owner }) => ({ id, name, tagline, owner }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { type, entities, model: provenance(s) };
}

export function getEntity(s, type, name) {
  return { entity: withReferences(s, resolveTyped(s, type, name)), model: provenance(s) };
}

// Every edge into the skill, grouped by the type of the page that drew it. A profile's rows
// arrive with the columns its schema declares beside the reference, under their own names and
// verbatim — in core the Skills row's Level, and each Evidence row's What it shows and the
// Experience it came from — and `via` says which table drew each; an experience arrives with its
// stamp and owner. Nothing here names a column.
export function findEvidence(s, skill) {
  const e = resolveTyped(s, "skill", skill);
  const byId = index(s);
  const evidence = {};
  for (const x of s.edges.filter((x) => x.to === e.id)) {
    const from = byId.get(x.from);
    const entry = { via: x.via, ...ref(from), owner: from.owner, attrs: resolveAttrs(byId, x.attrs) };
    if (from.stamp) entry.stamp = from.stamp;
    (evidence[from.type] ??= []).push(entry);
  }
  return { skill: { ...ref(e), tagline: e.tagline }, evidence, model: provenance(s) };
}

// A substring match over everything an entity says, reported by where it hit. The order is
// type then name — a listing, not a ranking.
export function search(s, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) throw new ModelError("search needs a query");
  const hit = (text) => typeof text === "string" && text.toLowerCase().includes(q);
  const results = [];
  for (const e of s.entities) {
    const matched = [];
    if (hit(e.name)) matched.push("name");
    if (hit(e.tagline)) matched.push("tagline");
    for (const [k, v] of Object.entries(e.fields)) if ([v].flat().some(hit)) matched.push(`field:${k}`);
    for (const sec of e.sections) {
      if (hit(sec.text)) matched.push(`section:${sec.heading}`);
      if (sec.tables.some((t) => t.rows.some((row) => row.some(hit)))) matched.push(`table:${sec.heading}`);
    }
    if (matched.length) results.push({ id: e.id, title: e.name, url: fileUrl(s, e), type: e.type, tagline: e.tagline, matched });
  }
  results.sort((a, b) => (a.type === b.type ? (a.title < b.title ? -1 : 1) : a.type < b.type ? -1 : 1));
  return { query, total: results.length, results, model: provenance(s) };
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
      throw new ModelError(
        types.length > 1
          ? `R2: "${id}" is the name of ${named.length} entities of different types (${types.join(", ")}); ask by type with get_entity, or fetch by id (${named.map((x) => x.id).join(", ")})`
          : `R2: "${id}" is the name of ${named.length} ${types[0]} entities, one in each of their owners (${named.map((x) => x.id).join(", ")}); fetch the one meant by its id`,
      );
    }
    if (named.length === 0) throw new ModelError(`nothing has the id or the name "${id}"`);
    e = named[0];
  }
  return { id: e.id, title: e.name, text: e.markdown, url: fileUrl(s, e), entity: withReferences(s, e), model: provenance(s) };
}
