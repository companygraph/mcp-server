// A picture of part of the model, as Mermaid source, built from the snapshot's edges and never
// from prose, so every node is an entity at the served commit and every arrow an edge the model
// draws. Four shapes: the concepts and their Relations, one process's phases in their order,
// one entity with everything one hop from it, and the schemas themselves, the types and what each
// declares about another. The source names its nodes n0, n1 and on, and `nodes` says which entity
// each one is, or for a type which schema, with the schema's file as `url`, so a client links a
// node without reading the source, and `links` says which arrow joins which, its label unescaped.
// A label is a title escaped for Mermaid; nothing here is worded in any one language, so a
// client captions the picture in its reader's.
import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { provenance, allEdges, requireId, requireType, relationsOf, coreUrl } from "./model.mjs";

// How many nodes a picture holds besides the neighborhood's middle. Past it a concepts, a
// process or a schema diagram is refused, since a cut one would draw edges that are not all
// there, and a neighborhood leaves out whole groups of edges and says which.
export const DIAGRAM_CAP = 50;

// A line break, and the spaces around it, fold to one space: a raw link label keeps this fold too,
// since a value holding one would otherwise differ from what the picture shows.
export const plain = (v) => String(v).replace(/\s*[\r\n]+\s*/g, " ");

// Mermaid reads `#name;` and `#number;` as a character, so a title's own `#` goes first, and a
// quote, an angle bracket, a backtick and a line break can then never close a label, start an
// arrow or turn the label into Markdown, which a flowchart node reads a backtick-quoted title as.
export const label = (text) => plain(String(text)
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;"));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byName = (a, b) => cmp(a.name, b.name) || cmp(a.id, b.id);
// A qualifier the parser resolved arrives as the entity it names, and a plain one as its text.
const text = (v) => plain(v && typeof v === "object" ? v.name : typeof v === "string" ? v : "");
const names = (v) => [v].flat().filter((x) => typeof x === "string" && x.trim());

const notA = (argument, e, type) => new ModelError("invalid_argument", `${argument} names ${e.id}, which is a ${e.type} and not a ${type}`,
  { details: { argument, reason: `not a ${type}` } });

// Naming a domain, or for the schemas a type, is the way out of a too-large picture, so the hint
// is only worth saying when none was named; a narrowed picture that is still too large has no
// such fix.
const NARROW = { concepts: "domain", schema: "type" };
export const cannot = (shape, reason, nodes, narrowed) => new ModelError("cannot_draw",
  reason === "empty"
    ? `the ${shape} diagram would draw nothing`
    : `the ${shape} diagram would draw ${nodes} nodes, more than the ${DIAGRAM_CAP} one holds${NARROW[shape] && !narrowed ? `; name a ${NARROW[shape]} to draw part of it` : ""}`,
  { details: { shape, reason, nodes, limit: DIAGRAM_CAP } });

// An association's own text sits outside quotes, the one place Mermaid also ends a label at a
// `:` or a `;`, so there alone both are mapped once `label()` has run, the way it maps `#` first.
const unquoted = (v) => label(v).replace(/[:;]/g, (c) => (c === ":" ? "#58;" : "#59;"));

// Each entity drawn gets the next node name, once, however many edges reach it.
function namer() {
  const nodes = [], at = new Map();
  const of = (e) => {
    if (!at.has(e.id)) { at.set(e.id, `n${nodes.length}`); nodes.push({ node: `n${nodes.length}`, id: e.id, title: e.name, type: e.type }); }
    return at.get(e.id);
  };
  return { nodes, of };
}

function concepts(s, domain) {
  requireType(s, "concept");
  let dom = null;
  if (domain !== undefined) {
    dom = requireId(s, domain);
    if (dom.type !== "domain") throw notA("domain", dom, "domain");
  }
  const edges = allEdges(s);
  const domainOf = new Map(edges.filter((x) => x.via === "domain" && x.from.type === "concept").map((x) => [x.from.id, x.to]));
  const inside = s.entities.filter((e) => e.type === "concept" && (!dom || domainOf.get(e.id)?.id === dom.id)).sort(byName);
  const insideIds = new Set(inside.map((e) => e.id));
  const relations = edges.filter((x) => x.via === "Relations.Concept" && insideIds.has(x.from.id));
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  const outside = [...new Set(relations.map((x) => x.to.id).filter((id) => !insideIds.has(id)))].map((id) => byId.get(id)).sort(byName);
  const drawn = [...inside, ...outside];
  if (drawn.length === 0) throw cannot("concepts", "empty", 0, dom);
  if (drawn.length > DIAGRAM_CAP) throw cannot("concepts", "too_large", drawn.length, dom);
  const { nodes, of } = namer();
  const lines = ["classDiagram"];
  // A concept from another domain carries that domain's name after its own, in the label: a
  // class annotation would say the same, but Mermaid does not read an escaped character there.
  const outsideIds = new Set(outside.map((e) => e.id));
  for (const e of drawn) {
    const home = outsideIds.has(e.id) ? domainOf.get(e.id) : null;
    lines.push(`  class ${of(e)}["${label(home ? `${e.name} · ${home.name}` : e.name)}"]`);
  }
  const links = [];
  for (const x of relations) {
    // The link's label is the same words before Mermaid's own escaping, so a client reads the
    // relation the picture drew without decoding its source.
    const said = [text(x.attrs.Cardinality), text(x.attrs.As)].filter((v) => v.trim());
    lines.push(`  ${of(x.from)} --> ${of(x.to)}${said.length ? ` : ${said.map(unquoted).join(", ")}` : ""}`);
    links.push({ from: of(x.from), to: of(x.to), label: said.join(", ") });
  }
  return { title: dom ? dom.name : null, mermaid: lines.join("\n"), nodes, links, edges: relations.length, omitted: 0 };
}

function process(s, id) {
  requireType(s, "phase");
  const p = requireId(s, id);
  if (p.type !== "process") throw notA("id", p, "process");
  // The phases' order is the process's own table: the edges it draws are sorted by id.
  const table = p.sections.find((x) => x.heading === "Phases")?.tables?.[0];
  const col = table ? table.columns.indexOf("Phase") : -1;
  const owned = s.entities.filter((e) => e.type === "phase" && e.owner === p.id);
  const phases = (col < 0 ? [] : table.rows.map((r) => r[col]))
    .map((name) => owned.find((e) => e.name === name)).filter((e, i, all) => e && all.indexOf(e) === i);
  if (phases.length === 0) throw cannot("process", "empty", 0);
  if (phases.length > DIAGRAM_CAP) throw cannot("process", "too_large", phases.length);
  const { nodes, of } = namer();
  const lines = ["flowchart LR"];
  for (const e of phases) {
    const who = names(e.fields["executed-by"]).map(label).join(", ");
    // The phase's name is the node's heading and who executes it the line under it; `<b>` and
    // `<br/>` are the two tags written here, and a title is escaped, so no title makes one.
    lines.push(`  ${of(e)}["<b>${label(e.name)}</b>${who ? `<br/>${who}` : ""}"]`);
  }
  const drawnIds = new Set(phases.map((e) => e.id));
  const order = (x) => phases.findIndex((e) => e.id === x.from.id);
  const gates = allEdges(s).filter((x) => x.via === "gate-to" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id)).sort((a, b) => order(a) - order(b));
  const byId = new Map(phases.map((e) => [e.id, e]));
  const links = [];
  for (const x of gates) {
    const raw = names(byId.get(x.from.id).fields["gate-approvers"]).map(plain);
    const approvers = raw.map(label).join(", ");
    lines.push(`  ${of(x.from)} -->${approvers ? `|"${approvers}"|` : ""} ${of(x.to)}`);
    links.push({ from: of(x.from), to: of(x.to), label: raw.join(", ") });
  }
  return { title: p.name, mermaid: lines.join("\n"), nodes, links, edges: gates.length, omitted: 0 };
}

// The edges between the middle and one entity by one `via` are one arrow; the arrows of one
// `via` and one direction are a group. Groups are taken smallest first and whole, while their
// entities fit, so an entity's many kinds of connection are drawn before the one it has most
// of; a group that does not fit is left out whole and named on a last node.
function neighborhood(s, id) {
  const e = requireId(s, id);
  const arrows = new Map();
  for (const x of allEdges(s)) {
    const out = x.from.id === e.id, into = x.to.id === e.id;
    if (!(out || into) || (out && into)) continue;
    const far = out ? x.to : x.from;
    const key = `${out ? ">" : "<"}\u0000${x.via}\u0000${far.id}`;
    const arrow = arrows.get(key) ?? { out, via: x.via, far, count: 0 };
    arrow.count++;
    arrows.set(key, arrow);
  }
  const groups = new Map();
  for (const a of arrows.values()) {
    const key = `${a.out ? ">" : "<"}\u0000${a.via}`;
    if (!groups.has(key)) groups.set(key, { out: a.out, via: a.via, arrows: [] });
    groups.get(key).arrows.push(a);
  }
  const ordered = [...groups.values()].sort((a, b) => a.arrows.length - b.arrows.length || Number(b.out) - Number(a.out) || cmp(a.via, b.via));
  const kept = [], left = [], far = new Set();
  for (const g of ordered) {
    const fresh = new Set(g.arrows.map((a) => a.far.id).filter((x) => !far.has(x)));
    if (far.size + fresh.size <= DIAGRAM_CAP) { kept.push(g); for (const x of fresh) far.add(x); }
    else left.push(g);
  }
  const { nodes, of } = namer();
  // A neighborhood mixes types a title alone cannot tell apart, so every node's label opens with
  // its type in guillemets, a stereotype as UML writes one, above the title on its own line; the
  // type is escaped through `label()` like any other text, though a schema slug never needs it.
  const stereotype = (t) => `«${label(t)}»`;
  // The middle is the one the picture is of, so its name is set in bold, as a phase's is.
  const lines = ["flowchart LR", `  ${of(e)}["${stereotype(e.type)}<br/><b>${label(e.name)}</b>"]`];
  const sorted = (g) => [...g.arrows].sort((x, y) => byName(x.far, y.far));
  // An entity both referenced and referencing is one node with two arrows, declared once.
  const declared = new Set([e.id]);
  for (const g of kept) for (const a of sorted(g)) if (!declared.has(a.far.id)) { declared.add(a.far.id); lines.push(`  ${of(a.far)}["${stereotype(a.far.type)}<br/>${label(a.far.name)}"]`); }
  let edges = 0;
  const links = [];
  for (const g of kept) {
    for (const a of sorted(g)) {
      const raw = plain(a.count > 1 ? `${a.via} ×${a.count}` : a.via);
      lines.push(a.out ? `  ${of(e)} -->|"${label(raw)}"| ${of(a.far)}` : `  ${of(a.far)} -->|"${label(raw)}"| ${of(e)}`);
      links.push(a.out ? { from: of(e), to: of(a.far), label: raw } : { from: of(a.far), to: of(e), label: raw });
      edges += a.count;
    }
  }
  const omitted = left.reduce((n, g) => n + g.arrows.reduce((m, a) => m + a.count, 0), 0);
  if (left.length) {
    lines.push(`  more["${label(`+${omitted}: ${left.map((g) => g.via).join(", ")}`)}"]`);
    lines.push(`  ${of(e)} -.- more`);
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, links, edges, omitted };
}

// How many of a reference one page may hold, as UML writes a multiplicity: `1`, `0..1`, `0..*`.
const multiplicity = ({ min, max }) => (max === null ? `${min}..*` : min === max ? `${min}` : `${min}..${max}`);

// The schemas as a class diagram: each type a class, named by its slug, each declared reference an
// association from the type that declares it, labeled with its field or Section.Column and with
// its multiplicity at the far end, drawn solid where it must resolve (`ref`) and dashed where it
// may stay a plain fact or only qualifies its row's edge (`ref?`, `qualifier`), and each owned
// type joined to its owner by a composition labeled `nested-in`, the name nesting has everywhere
// else the server answers. A reference whose type its own row names (R9's `by`) is declared to no
// one type, so it has no arrow to draw and is counted in `omitted`. A field every other type
// declares to one type, as every schema but the source's own declares `source`, would draw an
// arrow from each class into one and bury the rest, so it is drawn by none, counted in `omitted` and named once in `everyType`.
// A type narrows the picture to itself and every type it declares, is declared to or nests with,
// and to those declarations only.
function schemas(s, type) {
  const { relations, ownership } = relationsOf(s);
  if (type !== undefined) requireType(s, type);
  const all = s.schemas.map((x) => x.id.slice("core/".length));
  const key = (x) => `${x.via}\u0000${x.to}`;
  const declarers = new Map();
  for (const x of relations) if (x.to !== null) declarers.set(key(x), (declarers.get(key(x)) ?? new Set()).add(x.from));
  const common = new Set([...declarers].filter(([k, from]) => {
    const to = k.split("\u0000")[1], others = all.filter((t) => t !== to);
    return others.length > 1 && others.every((t) => from.has(t));
  }).map(([k]) => k));
  const everyType = [...common].map((k) => relations.find((x) => key(x) === k)).map((x) => ({ via: x.via, to: x.to, multiplicity: multiplicity(x) })).sort((a, b) => cmp(a.via, b.via));
  const touches = (a, b) => type === undefined || a === type || b === type;
  const declared = relations.filter((x) => x.to !== null && !common.has(key(x)) && touches(x.from, x.to));
  const unread = relations.filter((x) => (x.to === null || common.has(key(x))) && touches(x.from, x.to ?? x.from)).length;
  const nests = ownership.filter((x) => touches(x.owned, x.owner));
  const reached = new Set(type === undefined ? all : [type, ...declared.flatMap((x) => [x.from, x.to]), ...nests.flatMap((x) => [x.owned, x.owner])]);
  const drawn = all.filter((t) => reached.has(t)).sort(cmp);
  if (drawn.length === 0) throw cannot("schema", "empty", 0, type);
  if (drawn.length > DIAGRAM_CAP) throw cannot("schema", "too_large", drawn.length, type);
  const nodes = [], at = new Map();
  for (const t of drawn) {
    at.set(t, `n${nodes.length}`);
    nodes.push({ node: `n${nodes.length}`, id: `core/${t}`, title: t, type: "schema", url: coreUrl(s, s.schemas.find((x) => x.id === `core/${t}`).path) });
  }
  const lines = ["classDiagram", ...drawn.map((t) => `  class ${at.get(t)}["${label(t)}"]`)];
  const links = [];
  const sorted = [...declared].sort((a, b) => cmp(a.from, b.from) || cmp(a.via, b.via) || cmp(a.to, b.to));
  for (const x of sorted) {
    const many = multiplicity(x);
    lines.push(`  ${at.get(x.from)} ${x.form === "ref" ? "-->" : "..>"} "${many}" ${at.get(x.to)} : ${unquoted(x.via)}`);
    links.push({ from: at.get(x.from), to: at.get(x.to), label: `${plain(x.via)} ${many}` });
  }
  for (const x of [...nests].sort((a, b) => cmp(a.owned, b.owned))) {
    lines.push(`  ${at.get(x.owned)} --* ${at.get(x.owner)} : nested-in`);
    links.push({ from: at.get(x.owned), to: at.get(x.owner), label: "nested-in" });
  }
  return { title: type ?? null, mermaid: lines.join("\n"), nodes, links, everyType, edges: links.length, omitted: unread };
}

// Which shape takes which argument: `id` names what a process or a neighborhood is of, `domain`
// narrows the concepts and `type` the schemas.
const TAKES = { id: ["process", "neighborhood"], domain: ["concepts"], type: ["schema"] };

export function diagram(s, { shape, id, domain, type } = {}) {
  if (!SHAPES.includes(shape)) throw new ModelError("invalid_argument", `shape is one of ${SHAPES.join(", ")}`, { details: { argument: "shape", reason: `one of ${SHAPES.join(", ")}` } });
  for (const [argument, value] of Object.entries({ id, domain, type }))
    if (value !== undefined && !TAKES[argument].includes(shape))
      throw new ModelError("invalid_argument", `the ${shape} diagram takes no ${argument}${argument === "id" && NARROW[shape] ? `; name a ${NARROW[shape]} to draw part of it` : ""}`, { details: { argument, reason: `not taken by ${shape}` } });
  if (TAKES.id.includes(shape) && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? process(s, id) : shape === "neighborhood" ? neighborhood(s, id) : schemas(s, type);
  return { shape, ...drawn, model: provenance(s) };
}
