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

const withReferences = (s, e) => {
  const byId = index(s);
  const { markdown, ...rest } = e;
  const references = s.edges.filter((x) => x.from === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.to)), attrs: resolveAttrs(byId, x.attrs) }));
  const referencedBy = s.edges.filter((x) => x.to === e.id).map((x) => ({ via: x.via, ...ref(byId.get(x.from)), attrs: resolveAttrs(byId, x.attrs) }));
  return { ...rest, url: fileUrl(s, e), references, referencedBy };
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
  return { type, name: schema.name, tagline: schema.tagline, sections: schema.sections, model: provenance(s) };
}

export function listEntities(s, type) {
  requireType(s, type);
  const entities = s.entities.filter((e) => e.type === type).map(({ id, name, tagline, owner }) => ({ id, name, tagline, owner }));
  return { type, entities, model: provenance(s) };
}

export function getEntity(s, type, name) {
  return { entity: withReferences(s, resolveTyped(s, type, name)), model: provenance(s) };
}
