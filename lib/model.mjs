// The seven queries over a snapshot. Pure: a snapshot in, a JSON-shaped answer out, and every
// answer carries where it came from. Types and their descriptions come from the parsed
// schemas, so nothing here enumerates the vocabulary; references come from the parser's edges,
// so nothing here decides what a field means. A name resolves within a type (R2); a name that
// resolves to nothing is an error (R4); a name asked without a type that more than one type
// holds is refused with the types named, never given to the first match.

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

const resolveTyped = (s, type, name) => {
  requireType(s, type);
  const e = s.entities.find((x) => x.type === type && x.name === name);
  if (!e) throw new ModelError(`R4: "${name}" names no ${type}`);
  return e;
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

export function describeSchema(s, type) {
  const schema = requireType(s, type);
  return { type, name: schema.name, tagline: schema.tagline, sections: serveSections(schema.sections), model: provenance(s) };
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
      throw new ModelError(`R2: "${id}" is the name of ${named.length} entities of different types (${named.map((x) => x.type).join(", ")}); ask by type with get_entity`);
    }
    if (named.length === 0) throw new ModelError(`nothing has the id or the name "${id}"`);
    e = named[0];
  }
  return { id: e.id, title: e.name, text: e.markdown, url: fileUrl(s, e), entity: withReferences(s, e), model: provenance(s) };
}
