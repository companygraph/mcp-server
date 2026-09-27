// A picture of part of the model, as Mermaid source, built from the snapshot's edges and never
// from prose, so every node is an entity at the served commit and every arrow an edge the model
// draws. Three shapes: the concepts and their Relations, one process's phases in their order,
// and one entity with everything one hop from it. The source names its nodes n0, n1 and on, and
// `nodes` says which entity each one is, so a client links a node without reading the source.
// A label is a title escaped for Mermaid; nothing here is worded in any one language, so a
// client captions the picture in its reader's.
import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { provenance, allEdges, requireId, requireType } from "./model.mjs";

// How many nodes a picture holds besides the neighborhood's middle. Past it a neighborhood
// leaves out whole groups of edges and says which.
export const DIAGRAM_CAP = 50;

// Mermaid reads `#name;` and `#number;` as a character, so a title's own `#` goes first, and a
// quote, an angle bracket and a line break can then never close a label or start an arrow.
export const label = (text) => String(text)
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/\s*[\r\n]+\s*/g, " ");

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byName = (a, b) => cmp(a.name, b.name) || cmp(a.id, b.id);
// A qualifier the parser resolved arrives as the entity it names, and a plain one as its text.
const text = (v) => (v && typeof v === "object" ? v.name : typeof v === "string" ? v : "");
const names = (v) => [v].flat().filter((x) => typeof x === "string" && x.trim());

const notA = (argument, e, type) => new ModelError("invalid_argument", `${argument} names ${e.id}, which is a ${e.type} and not a ${type}`,
  { details: { argument, reason: `not a ${type}` } });

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
  const { nodes, of } = namer();
  const lines = ["classDiagram"];
  // A concept from another domain carries that domain's name after its own, in the label: a
  // class annotation would say the same, but Mermaid does not read an escaped character there.
  const outsideIds = new Set(outside.map((e) => e.id));
  for (const e of drawn) {
    const home = outsideIds.has(e.id) ? domainOf.get(e.id) : null;
    lines.push(`  class ${of(e)}["${label(home ? `${e.name} · ${home.name}` : e.name)}"]`);
  }
  for (const x of relations) {
    const said = [text(x.attrs.Cardinality), text(x.attrs.As)].filter((v) => v.trim()).map(label).join(", ");
    lines.push(`  ${of(x.from)} --> ${of(x.to)}${said ? ` : ${said}` : ""}`);
  }
  return { title: dom ? dom.name : null, mermaid: lines.join("\n"), nodes, edges: relations.length, omitted: 0 };
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
  for (const x of gates) {
    const approvers = names(byId.get(x.from.id).fields["gate-approvers"]).map(label).join(", ");
    lines.push(`  ${of(x.from)} -->${approvers ? `|"${approvers}"|` : ""} ${of(x.to)}`);
  }
  return { title: p.name, mermaid: lines.join("\n"), nodes, edges: gates.length, omitted: 0 };
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
  // The middle is the one the picture is of, so its name is set in bold, as a phase's is.
  const lines = ["flowchart LR", `  ${of(e)}["<b>${label(e.name)}</b>"]`];
  const sorted = (g) => [...g.arrows].sort((x, y) => byName(x.far, y.far));
  // An entity both referenced and referencing is one node with two arrows, declared once.
  const declared = new Set([e.id]);
  for (const g of kept) for (const a of sorted(g)) if (!declared.has(a.far.id)) { declared.add(a.far.id); lines.push(`  ${of(a.far)}["${label(a.far.name)}"]`); }
  let edges = 0;
  for (const g of kept) {
    for (const a of sorted(g)) {
      const said = label(a.count > 1 ? `${a.via} ×${a.count}` : a.via);
      lines.push(a.out ? `  ${of(e)} -->|"${said}"| ${of(a.far)}` : `  ${of(a.far)} -->|"${said}"| ${of(e)}`);
      edges += a.count;
    }
  }
  const omitted = left.reduce((n, g) => n + g.arrows.reduce((m, a) => m + a.count, 0), 0);
  if (left.length) {
    lines.push(`  more["${label(`+${omitted}: ${left.map((g) => g.via).join(", ")}`)}"]`);
    lines.push(`  ${of(e)} -.- more`);
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, edges, omitted };
}

export function diagram(s, { shape, id, domain } = {}) {
  if (!SHAPES.includes(shape)) throw new ModelError("invalid_argument", `shape is one of ${SHAPES.join(", ")}`, { details: { argument: "shape", reason: `one of ${SHAPES.join(", ")}` } });
  if (shape === "concepts" && id !== undefined) throw new ModelError("invalid_argument", "the concepts diagram takes no id; name a domain to draw part of it", { details: { argument: "id", reason: "not taken by concepts" } });
  if (shape !== "concepts" && domain !== undefined) throw new ModelError("invalid_argument", `the ${shape} diagram takes no domain`, { details: { argument: "domain", reason: `not taken by ${shape}` } });
  if (shape !== "concepts" && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? process(s, id) : neighborhood(s, id);
  return { shape, ...drawn, model: provenance(s) };
}
