// A picture of part of the model, as Mermaid source, built from the snapshot's edges and never
// from prose, so every node is an entity at the served commit and every arrow an edge the model
// draws. The shapes: the concepts and their Relations, one process's phases in their order
// with where each gate's failure leads, one entity with everything one hop from it, the
// schemas themselves, the types and what each declares about another, a bounded context's map
// of its neighbours and its aggregates with what they hold, a system in its landscape and what
// it holds among the systems that hold the same. The source names its
// nodes n0, n1 and on, and `nodes` says which entity each one is, or for a type which schema,
// with the schema's file as `url`, so a client links a node without reading the source, and
// `links` says which arrow joins which, its label unescaped. A label is a title escaped for
// Mermaid; nothing here is worded in any one language, so a client captions the picture in its
// reader's.
import { typeOfAddress } from "companygraph-meta-model/instance";
import { lastDayOf } from "companygraph-meta-model/checks";
import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { provenance, allEdges, requireId, requireType, relationsOf, schemaOf, schemaUrl, place } from "./model.mjs";

/**
 * @import { Entity, Edge, Table } from "companygraph-meta-model/instance"
 * @import { Snapshot } from "./snapshot.mjs"
 * @import { Ref, ServedEdge } from "./model.mjs"
 * @import { OUTPUTS } from "./schemas.mjs"
 * @import { z } from "zod"
 */

/**
 * @typedef {typeof SHAPES[number]} DiagramKind
 */
/**
 * @typedef {ReturnType<typeof relationsOf>["relations"][number]} Relation
 */
/**
 * A node of a picture: the name its source gives it, and what it stands for. For a type, `id` is the schema's own address and `url` its file.
 * @typedef {{ node: string; id: string; title: string; type: string; url?: string | null }} DiagramNode
 */
/**
 * An arrow of a picture by the names its source gives its ends, its label unescaped.
 * @typedef {{ from: string; to: string; label: string }} DiagramLink
 */
/**
 * What one shape draws, before the tool adds the shape and where the model came from.
 * @typedef {{ title: string | null; mermaid: string; nodes: DiagramNode[]; links: DiagramLink[]; edges: number; omitted: number }} Drawing
 */

// How many nodes a picture holds besides the neighborhood's middle. Past it a concepts, a
// process or a schema diagram is refused, since a cut one would draw edges that are not all
// there, and a neighborhood leaves out whole groups of edges and says which.
export const DIAGRAM_CAP = 50;

// A line break, and the spaces around it, fold to one space: a raw link label keeps this fold too,
// since a value holding one would otherwise differ from what the picture shows.
/** @param {unknown} v */
export const plain = (v) => String(v).replace(/\s*[\r\n]+\s*/g, " ");

// Mermaid reads `#name;` and `#number;` as a character, so a title's own `#` goes first, and a
// quote, an angle bracket, a backtick and a line break can then never close a label, start an
// arrow or turn the label into Markdown, which a flowchart node reads a backtick-quoted title as.
// A title holding `fas:fa-x` would be drawn as a Font Awesome mark, in a frame's title and in a
// box's label alike; a zero-width space after the colon stops that in both, and the text still
// reads `fas:fa-x`. Writing the colon as `#58;` stops it in a title only: a box decodes it first.
/** @param {unknown} text */
export const label = (text) => plain(String(text)
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;").replace(/(fa[bklrs]?):(?=fa-)/g, "$1:#8203;"));

/**
 * @param {string} a
 * @param {string} b
 */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Two of one name keep the order of where their pages sit, as every list does.
/**
 * @param {{ id: string; name: string; address?: string }} a
 * @param {{ id: string; name: string; address?: string }} b
 */
const byName = (a, b) => cmp(a.name, b.name) || cmp(place(a), place(b));
// A qualifier the parser resolved arrives as the entity it names, and a plain one as its text.
/** @param {unknown} v */
const text = (v) => plain(v && typeof v === "object" ? /** @type {Ref} */ (v).name : typeof v === "string" ? v : "");
/**
 * @param {unknown} v
 * @returns {string[]}
 */
const names = (v) => /** @type {string[]} */ ([v].flat().filter((x) => typeof x === "string" && x.trim()));

/**
 * @param {string} argument
 * @param {Ref} e
 * @param {string} type
 */
const notA = (argument, e, type) => new ModelError("invalid_argument", `${argument} names ${e.id}, which is a ${e.type} and not a ${type}`,
  { details: { argument, reason: `not a ${type}` } });

// Naming a domain, for the schemas a type and for the organization a group, is the way out of a
// too-large picture, so the hint is only worth saying when none was named; a narrowed picture
// that is still too large has no such fix.
/** @type {Partial<Record<DiagramKind, string>>} */
const NARROW = { concepts: "domain", schema: "type", organization: "group" };
/**
 * @param {DiagramKind} shape
 * @param {"empty" | "too_large"} reason
 * @param {number} nodes
 * @param {unknown} [narrowed]
 */
export const cannot = (shape, reason, nodes, narrowed) => new ModelError("cannot_draw",
  reason === "empty"
    ? `the ${shape} diagram would draw nothing`
    : `the ${shape} diagram would draw ${nodes} nodes, more than the ${DIAGRAM_CAP} one holds${NARROW[shape] && !narrowed ? `; name a ${NARROW[shape]} to draw part of it` : ""}`,
  { details: { shape, reason, nodes, limit: DIAGRAM_CAP } });

// An association's own text, and a class's member line, sit outside quotes, where Mermaid also
// ends a label at a `:` or a `;` and a member at a brace. Every character is mapped in one pass:
// mapping after `label()` would turn the `;` that closes its own `#quot;` into `#59;`.
/** @type {Record<string, string>} */
const CODES = { "#": "35", '"': "quot", "<": "lt", ">": "gt", "`": "96", ":": "58", ";": "59", "{": "123", "}": "125" };
/** @param {unknown} v */
const unquoted = (v) => plain(String(v)).replace(/[#"<>`:;{}]/g, (c) => `#${CODES[c]};`);

// Each entity drawn gets the next node name, once, however many edges reach it.
function namer() {
  const /** @type {DiagramNode[]} */ nodes = [], /** @type {Map<string, string>} */ at = new Map();
  /** @param {Ref} e */
  const of = (e) => {
    if (!at.has(e.id)) { at.set(e.id, `n${nodes.length}`); nodes.push({ node: `n${nodes.length}`, id: e.id, title: e.name, type: e.type }); }
    return /** @type {string} */ (at.get(e.id));
  };
  return { nodes, of };
}

/**
 * @param {Snapshot} s
 * @param {string | undefined} domain
 * @returns {Drawing}
 */
function concepts(s, domain) {
  requireType(s, "concept");
  /** @type {Entity | null} */
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
  const outside = [...new Set(relations.map((x) => x.to.id).filter((id) => !insideIds.has(id)))].map((id) => /** @type {Entity} */ (byId.get(id))).sort(byName);
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

// One process's picture, read from the entities and edges alone, so the parser's artifact a site
// already serves as its model.json draws the same picture the tool does, with no snapshot built
// around it: a site draws its processes at build time, from the commit it pins, with this.
/**
 * @param {{ entities: Entity[]; edges: Edge[] }} s
 * @param {string} id
 * @returns {Drawing}
 */
export function processDiagram(s, id) {
  const p = requireId(s, id);
  if (p.type !== "process") throw notA("id", p, "process");
  // The phases' order is the process's own table: the edges it draws are sorted by id.
  const table = p.sections.find((x) => x.heading === "Phases")?.tables?.[0];
  const col = table ? table.columns.indexOf("Phase") : -1;
  const owned = s.entities.filter((e) => e.type === "phase" && e.owner === p.id);
  const phases = /** @type {Entity[]} */ ((col < 0 ? [] : /** @type {NonNullable<typeof table>} */ (table).rows.map((r) => r[col]))
    .map((name) => owned.find((e) => e.name === name)).filter((e, i, all) => e && all.indexOf(e) === i));
  if (phases.length === 0) throw cannot("process", "empty", 0);
  if (phases.length > DIAGRAM_CAP) throw cannot("process", "too_large", phases.length);
  const { nodes, of } = namer();
  const lines = ["flowchart LR"];
  for (const e of phases) {
    const who = names(e.fields["executed-by"]).map(label).join(", ");
    // The phase's name is the node's heading and who executes it the line under it, set in
    // `<small>` so a client can style it apart from the name; `<b>`, `<br/>` and `<small>` are
    // the three tags written here, and a title is escaped, so no title makes one.
    lines.push(`  ${of(e)}["<b>${label(e.name)}</b>${who ? `<br/><small>${who}</small>` : ""}"]`);
  }
  const drawnIds = new Set(phases.map((e) => e.id));
  /** @param {ServedEdge} x */
  const order = (x) => phases.findIndex((e) => e.id === x.from.id);
  const gates = allEdges(s).filter((x) => x.via === "gate-to" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id)).sort((a, b) => order(a) - order(b));
  const byId = new Map(phases.map((e) => [e.id, e]));
  const links = [];
  for (const x of gates) {
    const raw = names(/** @type {Entity} */ (byId.get(x.from.id)).fields["gate-approvers"]).map(plain);
    const approvers = raw.map(label).join(", ");
    lines.push(`  ${of(x.from)} -->${approvers ? `|"${approvers}"|` : ""} ${of(x.to)}`);
    links.push({ from: of(x.from), to: of(x.to), label: raw.join(", ") });
  }
  // What each phase says happens when its gate fails, after the way forward: one dashed arrow
  // per phase and target, its outcomes in table order after the seat that decides them, the
  // way a gate's arrow names the seats that approve it. An arrow between phases is an edge the
  // model draws, `If not met.Leads to`, and goes into `links`; a row leading nowhere draws no
  // edge, and is read from the phase's own table to an arrow into one Stop node, which is no
  // entity, so neither it nor its arrows are in `nodes` or `links` for a client to link.
  const back = allEdges(s).filter((x) => x.via === "If not met.Leads to" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id));
  /** @type {string[]} */
  const stops = [];
  let drawnBack = 0;
  for (const e of phases) {
    const t = e.sections.find((x) => x.heading === "If not met")?.tables?.[0];
    if (!t) continue;
    const oc = t.columns.indexOf("Outcome"), lt = t.columns.indexOf("Leads to");
    if (oc < 0) continue;
    const who = names(e.fields["escalation-authority"]).map(plain).join(", ");
    const mine = back.filter((x) => x.from.id === e.id);
    /** @type {Map<string, string[]>} */
    const groups = new Map(); // target id, or "" for a stop, to its outcomes in table order
    for (const row of t.rows) {
      const outcome = plain(row[oc] ?? "").trim();
      const target = lt < 0 ? "" : String(row[lt] ?? "").trim();
      if (!outcome) continue;
      let to = "";
      if (target) {
        const edge = mine.find((x) => x.to.name === target && text(x.attrs?.Outcome) === outcome);
        if (!edge) continue; // a row whose target resolved to nothing draws nothing
        to = edge.to.id;
        drawnBack += 1;
      }
      if (!groups.has(to)) groups.set(to, []);
      /** @type {string[]} */ (groups.get(to)).push(outcome);
    }
    for (const [to, outcomes] of groups) {
      const raw = `${who ? `${who}: ` : ""}${outcomes.join(", ")}`;
      if (to === "") { stops.push(`  ${of(e)} -.->|"${label(raw)}"| stop`); continue; }
      lines.push(`  ${of(e)} -.->|"${label(raw)}"| ${of(/** @type {Entity} */ (byId.get(to)))}`);
      links.push({ from: of(e), to: of(/** @type {Entity} */ (byId.get(to))), label: raw });
    }
  }
  if (stops.length) lines.push("  stop((Stop))", ...stops, "  classDef stop fill:none,stroke-dasharray:3 3", "  class stop stop");
  return { title: p.name, mermaid: lines.join("\n"), nodes, links, edges: gates.length + drawnBack, omitted: 0 };
}

// The edges between the middle and one entity by one `via` are one arrow; the arrows of one
// `via` and one direction are a group. Groups are taken smallest first and whole, while their
// entities fit, so an entity's many kinds of connection are drawn before the one it has most
// of; a group that does not fit is left out whole and named on a last node.
/**
 * @param {{ entities: Entity[]; edges: Edge[] }} s
 * @param {string} id
 * @returns {Drawing}
 */
function neighborhood(s, id) {
  const e = requireId(s, id);
  /** @typedef {{ out: boolean; via: string; far: Ref; count: number }} Arrow */
  /** @type {Map<string, Arrow>} */
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
  /** @type {Map<string, { out: boolean; via: string; arrows: Arrow[] }>} */
  const groups = new Map();
  for (const a of arrows.values()) {
    const key = `${a.out ? ">" : "<"}\u0000${a.via}`;
    if (!groups.has(key)) groups.set(key, { out: a.out, via: a.via, arrows: [] });
    /** @type {{ arrows: Arrow[] }} */ (groups.get(key)).arrows.push(a);
  }
  const ordered = [...groups.values()].sort((a, b) => a.arrows.length - b.arrows.length || Number(b.out) - Number(a.out) || cmp(a.via, b.via));
  const /** @type {{ out: boolean; via: string; arrows: Arrow[] }[]} */ kept = [], /** @type {{ out: boolean; via: string; arrows: Arrow[] }[]} */ left = [], /** @type {Set<string>} */ far = new Set();
  for (const g of ordered) {
    const fresh = new Set(g.arrows.map((a) => a.far.id).filter((x) => !far.has(x)));
    if (far.size + fresh.size <= DIAGRAM_CAP) { kept.push(g); for (const x of fresh) far.add(x); }
    else left.push(g);
  }
  const { nodes, of } = namer();
  // A neighborhood mixes types a title alone cannot tell apart, so every node's label opens with
  // its type in guillemets, a stereotype as UML writes one, above the title on its own line and
  // set in `<small>` so a client can style it apart from the name; the type is escaped through
  // `label()` like any other text, though a schema slug never needs it.
  /** @param {string} t */
  const stereotype = (t) => `<small>«${label(t)}»</small>`;
  // The middle is the one the picture is of, so its name is set in bold, as a phase's is.
  const lines = ["flowchart LR", `  ${of(e)}["${stereotype(e.type)}<br/><b>${label(e.name)}</b>"]`];
  const byId = new Map(s.entities.map((x) => [x.id, x]));
  /** @param {{ arrows: Arrow[] }} g */
  const sorted = (g) => [...g.arrows].sort((x, y) => byName(byId.get(x.far.id) ?? x.far, byId.get(y.far.id) ?? y.far));
  // An entity both referenced and referencing is one node with two arrows, declared once.
  const declared = new Set([e.id]);
  for (const g of kept) for (const a of sorted(g)) if (!declared.has(a.far.id)) { declared.add(a.far.id); lines.push(`  ${of(a.far)}["${stereotype(a.far.type)}<br/>${label(a.far.name)}"]`); }
  let edges = 0;
  /** @type {DiagramLink[]} */
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
/** @param {{ min: number; max: number | null }} bounds */
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
/**
 * @param {Snapshot} s
 * @param {string | undefined} type
 * @returns {Drawing & { everyType: { via: string; to: string; multiplicity: string }[] }}
 */
function schemas(s, type) {
  const { relations, ownership } = relationsOf(s);
  if (type !== undefined) requireType(s, type);
  const all = [...new Set(s.schemas.map((x) => typeOfAddress(x.address)))];
  /** @param {{ via: string; to: string | null }} x */
  const key = (x) => `${x.via}\u0000${x.to}`;
  /** @type {Map<string, Set<string>>} */
  const declarers = new Map();
  for (const x of relations) if (x.to !== null) declarers.set(key(x), (declarers.get(key(x)) ?? new Set()).add(x.from));
  const common = new Set([...declarers].filter(([k, from]) => {
    const to = k.split("\u0000")[1], others = all.filter((t) => t !== to);
    return others.length > 1 && others.every((t) => from.has(t));
  }).map(([k]) => k));
  const everyType = [...common].map((k) => /** @type {Relation} */ (relations.find((x) => key(x) === k))).map((x) => ({ via: x.via, to: /** @type {string} */ (x.to), multiplicity: multiplicity(x) })).sort((a, b) => cmp(a.via, b.via));
  /**
   * @param {string} a
   * @param {string} b
   */
  const touches = (a, b) => type === undefined || a === type || b === type;
  const declared = /** @type {(Relation & { to: string })[]} */ (relations.filter((x) => x.to !== null && !common.has(key(x)) && touches(x.from, x.to)));
  const unread = relations.filter((x) => (x.to === null || common.has(key(x))) && touches(x.from, x.to ?? x.from)).length;
  const nests = ownership.filter((x) => touches(x.owned, x.owner));
  const reached = new Set(type === undefined ? all : [type, ...declared.flatMap((x) => [x.from, x.to]), ...nests.flatMap((x) => [x.owned, x.owner])]);
  const drawn = all.filter((t) => reached.has(t)).sort(cmp);
  if (drawn.length === 0) throw cannot("schema", "empty", 0, type);
  if (drawn.length > DIAGRAM_CAP) throw cannot("schema", "too_large", drawn.length, type);
  const /** @type {DiagramNode[]} */ nodes = [], /** @type {Map<string, string>} */ at = new Map();
  for (const t of drawn) {
    at.set(t, `n${nodes.length}`);
    const schema = /** @type {Entity} */ (schemaOf(s, t));
    nodes.push({ node: `n${nodes.length}`, id: schema.address, title: t, type: "schema", url: schemaUrl(s, schema) });
  }
  const lines = ["classDiagram", ...drawn.map((t) => `  class ${at.get(t)}["${label(t)}"]`)];
  /** @type {DiagramLink[]} */
  const links = [];
  const sorted = [...declared].sort((a, b) => cmp(a.from, b.from) || cmp(a.via, b.via) || cmp(a.to, b.to));
  for (const x of sorted) {
    const many = multiplicity(x);
    lines.push(`  ${at.get(x.from)} ${x.form === "ref" ? "-->" : "..>"} "${many}" ${at.get(x.to)} : ${unquoted(x.via)}`);
    links.push({ from: /** @type {string} */ (at.get(x.from)), to: /** @type {string} */ (at.get(x.to)), label: `${plain(x.via)} ${many}` });
  }
  for (const x of [...nests].sort((a, b) => cmp(a.owned, b.owned))) {
    lines.push(`  ${at.get(x.owned)} --* ${at.get(x.owner)} : nested-in`);
    links.push({ from: /** @type {string} */ (at.get(x.owned)), to: /** @type {string} */ (at.get(x.owner)), label: "nested-in" });
  }
  return { title: type ?? null, mermaid: lines.join("\n"), nodes, links, everyType, edges: links.length, omitted: unread };
}

// A bounded context's map: the context, every context its Relationships names and every context
// whose Relationships names it, one hop and contexts only. A row is written on the downstream
// side and names its upstream, so its arrow runs from the context it names to the one that wrote
// it, and a top-to-bottom flow puts upstream above downstream, as a context map is read. Three
// patterns have no upstream side and are drawn with a head at each end; two rows naming each
// other with one of them are one arrow, and two rows that disagree each keep their own.
const SYMMETRIC = new Set(["partnership", "shared kernel", "separate ways"]);
/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function contextMap(s, id) {
  requireType(s, "bounded-context");
  const c = requireId(s, id);
  if (c.type !== "bounded-context") throw notA("id", c, "bounded-context");
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  // The column a row names its upstream in is read from the schema, the one reference a bounded
  // context declares to another, so that column's name is never written here.
  const vias = new Set(relationsOf(s).relations.filter((r) => r.from === "bounded-context" && r.to === "bounded-context").map((r) => r.via));
  const rows = allEdges(s).filter((x) => vias.has(x.via) && x.from.id !== x.to.id && (x.from.id === c.id || x.to.id === c.id));
  const /** @type {{ up: Entity; down: Entity; pattern: string; both: boolean }[]} */ arrows = [], /** @type {Set<string>} */ merged = new Set();
  for (const x of rows) {
    const pattern = text(x.attrs?.Pattern), both = SYMMETRIC.has(pattern);
    if (both) {
      const key = `${[x.from.id, x.to.id].sort().join("\u0000")}\u0000${pattern}`;
      if (merged.has(key)) continue;
      merged.add(key);
    }
    // A symmetric arrow has no upstream, so its pair is ordered by name and never by which row
    // came first.
    const [up, down] = [/** @type {Entity} */ (byId.get(x.to.id)), /** @type {Entity} */ (byId.get(x.from.id))];
    arrows.push(both && byName(up, down) > 0 ? { up: down, down: up, pattern, both } : { up, down, pattern, both });
  }
  const others = [...new Map(arrows.flatMap((a) => [a.up, a.down]).filter((e) => e.id !== c.id).map((e) => [e.id, e])).values()].sort(byName);
  if (others.length + 1 > DIAGRAM_CAP) throw cannot("context", "too_large", others.length + 1);
  const { nodes, of } = namer();
  // Each node opens with its type and its classification, as a neighborhood's opens with its
  // type, set in `<small>`, and the middle's name is bold, as the neighborhood's is.
  /** @param {Entity} e */
  const head = (e) => `<small>«bounded-context»${e.fields?.classification ? ` · ${label(text(e.fields.classification))}` : ""}</small>`;
  const lines = ["flowchart TB", `  ${of(c)}["${head(c)}<br/><b>${label(c.name)}</b>"]`];
  for (const e of others) lines.push(`  ${of(e)}["${head(e)}<br/>${label(e.name)}"]`);
  /** @type {DiagramLink[]} */
  const links = [];
  const sorted = arrows.sort((a, b) => byName(a.up, b.up) || byName(a.down, b.down) || cmp(a.pattern, b.pattern));
  for (const a of sorted) {
    const raw = a.both ? a.pattern : `U → D · ${a.pattern}`;
    lines.push(`  ${of(a.up)} ${a.both ? "<-->" : "-->"}|"${label(raw)}"| ${of(a.down)}`);
    links.push({ from: of(a.up), to: of(a.down), label: raw });
  }
  return { title: c.name, mermaid: lines.join("\n"), nodes, links, edges: rows.length, omitted: 0 };
}

// The aggregates a flow or a lifecycle is drawn for: the one an id names, or every aggregate the
// context an id names holds, in name order, as the aggregate picture takes them.
/**
 * @param {Snapshot} s
 * @param {string} id
 */
function aggregatesOf(s, id) {
  requireType(s, "aggregate");
  const e = requireId(s, id);
  if (e.type !== "aggregate" && e.type !== "bounded-context")
    throw new ModelError("invalid_argument", `id names ${e.id}, which is a ${e.type} and not an aggregate or a bounded-context`, { details: { argument: "id", reason: "not an aggregate or a bounded-context" } });
  return { e, aggs: e.type === "aggregate" ? [e] : s.entities.filter((x) => x.type === "aggregate" && x.owner === e.id).sort(byName) };
}
// An aggregate's picture, or every aggregate of one context in one: each root and member a class
// annotated with its kind, the root `aggregate root`, holding its Attributes as members; the root
// joined to each member by a composition with the cardinality the root's Relations gives it; any
// other Relations row between two drawn terms an association, as the concepts picture draws one;
// and every event the aggregate emits a class of its own, reached by a dashed `emits`. A term the
// root reaches but the aggregate does not hold is not drawn: the picture is of what it holds.
/** @type {Record<string, string>} */
const CARDINALITY = { one: "1", "maybe one": "0..1", many: "*", "one to many": "1..*" };
/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function aggregates(s, id) {
  const { e, aggs: drawnAggs } = aggregatesOf(s, id);
  if (drawnAggs.length === 0) throw cannot("aggregate", "empty", 0);
  const byId = new Map(s.entities.map((x) => [x.id, x]));
  const edges = allEdges(s);
  const /** @type {Set<string>} */ roots = new Set(), /** @type {Ref[]} */ held = [], /** @type {{ root: Ref; m: Ref; card: string }[]} */ compositions = [];
  for (const a of drawnAggs) {
    const root = edges.find((x) => x.via === "root" && x.from.id === a.id)?.to;
    if (!root) continue;
    roots.add(root.id);
    held.push(root);
    const mine = edges.filter((x) => x.via === "members" && x.from.id === a.id);
    for (const name of names(a.fields.members)) {
      const m = mine.find((x) => x.to.name === name)?.to;
      if (!m) continue;
      held.push(m);
      const rel = edges.find((x) => x.via === "Relations.Concept" && x.from.id === root.id && x.to.id === m.id);
      compositions.push({ root, m, card: CARDINALITY[text(rel?.attrs?.Cardinality)] ?? "" });
    }
  }
  const terms = [...new Map(held.map((x) => [x.id, /** @type {Entity} */ (byId.get(x.id))])).values()];
  const aggIds = new Set(drawnAggs.map((a) => a.id));
  const events = /** @type {{ event: Entity; root: Ref }[]} */ (edges.filter((x) => x.via === "emitted-by" && aggIds.has(x.to.id))
    .map((x) => ({ event: /** @type {Entity} */ (byId.get(x.from.id)), root: edges.find((y) => y.via === "root" && y.from.id === x.to.id)?.to })).filter((x) => x.root))
    .sort((a, b) => byName(a.event, b.event));
  const count = terms.length + new Set(events.map((x) => x.event.id)).size;
  if (count === 0) throw cannot("aggregate", "empty", 0);
  if (count > DIAGRAM_CAP) throw cannot("aggregate", "too_large", count);
  const { nodes, of } = namer();
  const lines = ["classDiagram"];
  for (const t of terms) {
    const table = t.sections.find((x) => x.heading === "Attributes")?.tables?.[0];
    const at = table ? table.columns.indexOf("Attribute") : -1, ty = table ? table.columns.indexOf("Type") : -1;
    const attrs = at < 0 ? [] : /** @type {Table} */ (table).rows.filter((r) => text(r[at]).trim()).map((r) => {
      const type = ty < 0 ? "" : text(r[ty]).trim();
      return `    ${unquoted(text(r[at]).trim())}${type ? ` : ${unquoted(type)}` : ""}`;
    });
    lines.push(`  class ${of(t)}["${label(t.name)}"] {`, `    <<${roots.has(t.id) ? "aggregate root" : label(text(t.fields.kind))}>>`, ...attrs, "  }");
  }
  for (const { event } of events) lines.push(`  class ${of(event)}["${label(event.name)}"] {`, "    <<domain event>>", "  }");
  /** @type {DiagramLink[]} */
  const links = [];
  for (const { root, m, card } of compositions) {
    lines.push(`  ${of(root)} *--${card ? ` "${card}"` : ""} ${of(m)}`);
    links.push({ from: of(root), to: of(m), label: card });
  }
  const drawnIds = new Set(terms.map((t) => t.id));
  const composed = new Set(compositions.map(({ root, m }) => `${root.id}\u0000${m.id}`));
  for (const x of edges.filter((x) => x.via === "Relations.Concept" && drawnIds.has(x.from.id) && drawnIds.has(x.to.id) && !composed.has(`${x.from.id}\u0000${x.to.id}`))) {
    const said = [text(x.attrs.Cardinality), text(x.attrs.As)].filter((v) => v.trim());
    lines.push(`  ${of(x.from)} --> ${of(x.to)}${said.length ? ` : ${said.map(unquoted).join(", ")}` : ""}`);
    links.push({ from: of(x.from), to: of(x.to), label: said.join(", ") });
  }
  for (const { event, root } of events) {
    lines.push(`  ${of(root)} ..> ${of(event)} : emits`);
    links.push({ from: of(root), to: of(event), label: "emits" });
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0 };
}

// A table's cell by its column's name, blank where the table has no such column.
/**
 * @param {Table} table
 * @param {string[]} row
 * @param {string} column
 */
const cellOf = (table, row, column) => { const i = table.columns.indexOf(column); return i < 0 ? "" : text(row[i]).trim(); };

// A flow: a command sent to an aggregate and the events it emits, read from the aggregate's
// handled commands in the order its table writes them. The section and the column an event is
// named in are read from the one reference an aggregate declares to a domain event, so neither is
// written here. A command of several rows is an alt, one branch per row under its When; a row that
// names no event is a branch in which nothing is emitted, holding a dash. The sender is one participant, Caller,
// which is no entity: the model does not say who sends a command.
/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function flow(s, id) {
  const { e, aggs } = aggregatesOf(s, id);
  const decl = relationsOf(s).relations.find((r) => r.from === "aggregate" && r.to === "domain-event");
  if (!decl) throw cannot("flow", "empty", 0);
  const [section, column] = decl.via.split(".");
  const edges = allEdges(s).filter((x) => x.via === decl.via);
  /** @type {{ a: Entity; groups: { command: string; rows: { event: Ref | null; when: string }[] }[] }[]} */
  const drawn = [];
  for (const a of aggs) {
    const table = a.sections.find((x) => x.heading === section)?.tables?.[0];
    if (!table || !table.rows.length) continue;
    /** @type {{ command: string; rows: { event: Ref | null; when: string }[] }[]} */
    const groups = [];
    for (const row of table.rows) {
      const command = cellOf(table, row, "Command"), named = cellOf(table, row, column), when = cellOf(table, row, "When");
      if (!command) continue;
      const event = named ? edges.find((x) => x.from.id === a.id && x.to.name === named && text(x.attrs?.Command) === command)?.to ?? null : null;
      let g = groups.find((x) => x.command === command);
      if (!g) { g = { command, rows: [] }; groups.push(g); }
      g.rows.push({ event, when });
    }
    if (groups.length) drawn.push({ a, groups });
  }
  if (!drawn.length) throw cannot("flow", "empty", 0);
  const messages = drawn.reduce((n, d) => n + d.groups.reduce((m, g) => m + 1 + g.rows.filter((r) => r.event).length, 0), 0);
  // The cap counts what a sequence diagram holds: the caller, each aggregate's participant and each message.
  if (drawn.length + 1 + messages > DIAGRAM_CAP) throw cannot("flow", "too_large", drawn.length + 1 + messages);
  const { nodes, of } = namer();
  const lines = ["sequenceDiagram", "  participant caller as Caller"];
  for (const { a } of drawn) lines.push(`  participant ${of(a)} as ${unquoted(a.name)}`);
  /** @type {DiagramLink[]} */
  const links = [];
  for (const { a, groups } of drawn) {
    for (const { command, rows } of groups) {
      lines.push(`  caller->>${of(a)}: ${unquoted(command)}`);
      // A branch in which nothing comes back holds a note of one dash: an empty last branch puts its
      // condition below the frame, and a word would be the one text in the source written in a language.
      /** @param {{ event: Ref | null; when: string }} r */
      const back = (r) => (r.event ? `${of(a)}--)caller: ${unquoted(r.event.name)}` : `Note over ${of(a)}: —`);
      if (rows.length === 1) { if (rows[0].event) lines.push(`  ${back(rows[0])}`); }
      else { rows.forEach((r, i) => lines.push(`  ${i ? "else" : "alt"} ${unquoted(r.when)}`, `    ${back(r)}`)); lines.push("  end"); }
      for (const r of rows) if (r.event) links.push({ from: of(a), to: of(r.event), label: plain(r.when ? `${command} · ${r.when}` : command) });
    }
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0 };
}

// A lifecycle: the states an aggregate passes through, one transition per row of its table, read in
// the table's order. A blank From starts it, a state that is never a From ends it, and a step with
// no command is one the aggregate takes on its own. A state is a word in a cell and no entity, so
// it is named s0, s1 and on with its words as the label; a context's aggregates are each a
// composite state under its name.
/**
 * @param {Snapshot} s
 * @param {string} id
 */
function lifecycle(s, id) {
  const { e, aggs } = aggregatesOf(s, id);
  /** @type {{ a: Entity; rows: { from: string; command: string; to: string }[] }[]} */
  const drawn = [];
  for (const a of aggs) {
    const table = a.sections.find((x) => x.heading === "State transitions")?.tables?.[0];
    const rows = (table?.rows ?? []).map((r) => ({ from: cellOf(/** @type {Table} */ (table), r, "From"), command: cellOf(/** @type {Table} */ (table), r, "Command"), to: cellOf(/** @type {Table} */ (table), r, "To") })).filter((r) => r.to);
    if (rows.length) drawn.push({ a, rows });
  }
  if (!drawn.length) throw cannot("lifecycle", "empty", 0);
  const states = drawn.reduce((n, d) => n + new Set(d.rows.flatMap((r) => [r.from, r.to]).filter(Boolean)).size, 0);
  if (states > DIAGRAM_CAP) throw cannot("lifecycle", "too_large", states);
  const { nodes, of } = namer();
  const lines = ["stateDiagram-v2"];
  /** @type {{ aggregate: string; from: string | null; to: string; command: string | null }[]} */
  const transitions = [];
  let k = 0;
  const composite = drawn.length > 1 || e.type === "bounded-context";
  for (const { a, rows } of drawn) {
    /** @type {Map<string, string>} */
    const ids = new Map();
    /** @param {string} name */
    const sid = (name) => { if (!ids.has(name)) ids.set(name, `s${k++}`); return ids.get(name); };
    const pad = composite ? "    " : "  ";
    /** @type {string[]} */
    const body = [];
    for (const name of [...new Set(rows.flatMap((r) => [r.from, r.to]).filter(Boolean))]) body.push(`${pad}state "${label(name)}" as ${sid(name)}`);
    for (const r of rows) {
      body.push(`${pad}${r.from ? sid(r.from) : "[*]"} --> ${sid(r.to)}${r.command ? ` : ${unquoted(r.command)}` : ""}`);
      transitions.push({ aggregate: a.name, from: r.from || null, to: r.to, command: r.command || null });
    }
    const froms = new Set(rows.map((r) => r.from).filter(Boolean));
    for (const name of new Set(rows.map((r) => r.to))) if (!froms.has(name)) body.push(`${pad}${sid(name)} --> [*]`);
    if (composite) lines.push(`  state "${label(a.name)}" as ${of(a)} {`, ...body, "  }");
    else { of(a); lines.push(...body); }
  }
  return { title: e.name, mermaid: lines.join("\n"), nodes, links: [], transitions, edges: transitions.length, omitted: 0 };
}

// An org chart: one box per person and per open position, framed by the group they sit in. The
// frames stand side by side in the company's order and the line between their leads carries the
// hierarchy, since Mermaid lays out frames nested deep poorly. A person's name is bold, their job
// the `<small>` line under it, and before the name a token Mermaid swaps for the mark a client
// registers under `fak`, a person's or an agent's, as the processes page marks them; a client
// without the pack shows the name alone. Nothing here is a word: what a dashed box or the shaded
// frame means is the client's reading line.
const PLACES = ["Lead", "Deputy", "Member", "Staff"];
/** @param {string | undefined} place */
const placeAt = (place) => { const i = PLACES.indexOf(String(place)); return i < 0 ? PLACES.length : i; };
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const todayUtc = () => new Date().toISOString().slice(0, 10);
/**
 * @param {Snapshot} s
 * @param {string | undefined} id
 * @param {string} [today]
 * @returns {Drawing}
 */
function organization(s, id, today = todayUtc()) {
  requireType(s, "group");
  /** @param {string} type */
  const named = (type) => new Map(s.entities.filter((e) => e.type === type).map((e) => [e.name, e]));
  const kinds = named("group-kind"), profiles = named("profile"), jobs = named("job");
  /** @param {Entity} g @param {string} field */
  const kindSays = (g, field) => text(kinds.get(text(g.fields?.kind))?.fields?.[field]) === "yes";
  /** @param {Entity} g */
  const inLine = (g) => kindSays(g, "in-line");
  // A group exists from the first day its `start` covers until the last day its `end` covers has
  // passed, as R9 reads a date; one that is no date in R9's forms is ignored.
  /** @param {Entity} g */
  const exists = (g) => {
    const start = text(g.fields?.start).trim(), end = text(g.fields?.end).trim();
    const first = DATE.test(start) ? (start.length === 4 ? `${start}-01-01` : start.length === 7 ? `${start}-01` : start) : "";
    return (!first || first <= today) && (!DATE.test(end) || lastDayOf(end) >= today);
  };
  const groups = s.entities.filter((e) => e.type === "group");
  const byGroupName = new Map(groups.map((g) => [g.name, g]));
  const current = groups.filter(exists);
  /** @param {Entity} g */
  const rank = (g) => { const r = Number(text(g.fields?.rank)); return text(g.fields?.rank).trim() && Number.isFinite(r) ? r : Infinity; };
  /** @param {Entity} a @param {Entity} b */
  const order = (a, b) => (rank(a) === rank(b) ? byName(a, b) : rank(a) < rank(b) ? -1 : 1);
  /** @param {Entity} g */
  const parentOf = (g) => byGroupName.get(text(g.fields?.["part-of"]));
  /** @type {Entity | null} */
  let middle = null;
  let set, omitted = 0;
  if (id !== undefined) {
    middle = requireId(s, id);
    if (middle.type !== "group") throw notA("id", middle, "group");
    const top = middle;
    // Every unit whose `part-of` reaches the one named, however many steps up; a loop the checks
    // refuse stops the walk instead of the tool.
    /** @param {Entity} g */
    const under = (g) => { const seen = new Set(); for (let p = parentOf(g); p && !seen.has(p.id); p = parentOf(p)) { if (p.id === top.id) return true; seen.add(p.id); } return false; };
    set = !exists(middle) ? [] : inLine(middle) ? current.filter((g) => g.id === top.id || (inLine(g) && under(g))) : [middle];
  } else {
    const line = current.filter(inLine);
    set = line.length ? line : current;
    omitted = line.length ? current.length - line.length : 0;
  }
  set = [...set].sort(order);
  // A table's rows by column, each cell its text, so a missing column reads as empty.
  /** @param {Entity} g @param {string} heading @returns {Record<string, string>[]} */
  const rows = (g, heading) => {
    const t = g.sections.find((x) => x.heading === heading)?.tables?.[0];
    return t ? t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, text(r[i]).trim()]))) : [];
  };
  /** @typedef {{ who: Entity; job: string; place: string }} Seated */
  /** @typedef {{ job: Entity; place: string; count: number }} Open */
  const frames = set.map((g) => {
    /** @type {Seated[]} */
    const people = rows(g, "People").flatMap((r) => { const who = profiles.get(r.Profile ?? ""); return who ? [{ who, job: r.Job ?? "", place: r.Place ?? "" }] : []; });
    const human = people.filter((p) => text(p.who.fields?.nature) === "human")
      .map((p, i) => ({ p, i })).sort((a, b) => placeAt(a.p.place) - placeAt(b.p.place) || a.i - b.i).map((x) => x.p);
    const agents = people.filter((p) => text(p.who.fields?.nature) !== "human");
    /** @type {Open[]} */
    const openings = rows(g, "Openings").flatMap((r) => { const job = jobs.get(r.Job ?? ""); return job ? [{ job, place: r.Place ?? "", count: Number(r.Count) }] : []; });
    return { g, human, agents, openings };
  });
  const boxes = frames.reduce((n, f) => n + f.human.length + f.agents.length + f.openings.length, 0);
  if (boxes === 0) throw cannot("organization", "empty", 0);
  if (boxes > DIAGRAM_CAP) throw cannot("organization", "too_large", boxes, middle);
  // Every box is a node of its own, so one job open in two units is two boxes naming it; a frame
  // is a node too, named `g` and its place, so a client can tell which group it draws.
  const /** @type {DiagramNode[]} */ nodes = [];
  let count = 0;
  /** @param {Entity} e */
  const box = (e) => { const n = `n${count++}`; nodes.push({ node: n, id: e.id, title: e.name, type: e.type }); return n; };
  /** @param {Seated} p @param {"human" | "agent"} mark */
  const person = (p, mark) => `fak:fa-${mark} <b>${label(p.who.name)}</b>${p.job ? `<br/><small>${label(p.job)}</small>` : ""}`;
  const lines = ["flowchart TB"];
  const /** @type {DiagramLink[]} */ links = [];
  // Where an arrow between frames ends: the unit's lead, else its open Lead, else the frame.
  const /** @type {Map<string, string>} */ head = new Map();
  const /** @type {Set<string>} */ used = new Set();
  frames.forEach(({ g, human, agents, openings }, i) => {
    const frame = `g${i}`;
    nodes.push({ node: frame, id: g.id, title: g.name, type: g.type });
    lines.push(`  subgraph ${frame} ["${label(g.name)}"]`);
    /** @type {string | null} */
    let lead = null, last = null, openLead = null;
    const /** @type {string[]} */ below = [], /** @type {string[]} */ beside = [];
    for (const p of human) {
      const n = box(p.who), leads = p.place === "Lead" && !lead;
      if (leads) used.add("lead");
      lines.push(`    ${n}["${person(p, "human")}"]${leads ? ":::lead" : ""}`);
      if (leads) lead = n;
      else (p.place === "Staff" ? beside : below).push(n);
      last = n;
    }
    // An open Lead stands beside the lead who stays, the search for a successor; every other
    // opening stands below the lead.
    for (const o of openings) {
      const n = box(o.job);
      used.add("open");
      lines.push(`    ${n}["<b>${label(o.job.name)}</b>${Number.isInteger(o.count) && o.count > 1 ? `<br/><small>× ${o.count}</small>` : ""}"]:::open`);
      if (o.place !== "Lead") below.push(n);
      else if (!openLead) openLead = n;
      last = n;
    }
    if (agents.length) {
      used.add("agents");
      lines.push(`    subgraph ${frame}a [" "]`);
      if (agents.length > 1) lines.push("      direction LR");
      const /** @type {string[]} */ row = [];
      for (const p of agents) { const n = box(p.who); row.push(n); lines.push(`      ${n}["${person(p, "agent")}"]`); }
      // Mermaid stacks unlinked nodes in a column even under `direction LR`; an invisible link
      // between neighbors puts them in a row, in the order they are listed.
      for (let k = 1; k < row.length; k++) lines.push(`      ${row[k - 1]} ~~~ ${row[k]}`);
      lines.push("    end");
    }
    if (lead) for (const n of below) lines.push(`    ${lead} ~~~ ${n}`);
    if (lead) for (const n of beside) { lines.push(`    ${lead} -.- ${n}`); links.push({ from: lead, to: n, label: "Staff" }); }
    if (agents.length && last) lines.push(`    ${last} ~~~ ${frame}a`);
    lines.push("  end");
    head.set(g.id, lead ?? openLead ?? frame);
  });
  for (const { g } of frames) {
    const p = parentOf(g);
    if (!p || !head.has(p.id)) continue;
    const from = /** @type {string} */ (head.get(p.id)), to = /** @type {string} */ (head.get(g.id));
    const staff = kindSays(g, "staff");
    lines.push(`  ${from} ${staff ? "-.-" : "-->"} ${to}`);
    links.push({ from, to, label: staff ? "staff" : "part-of" });
  }
  frames.forEach(({ agents }, i) => { if (agents.length) lines.push(`  class g${i}a agents`); });
  if (used.has("lead")) lines.push("  classDef lead stroke-width:2px");
  if (used.has("open")) lines.push("  classDef open stroke-dasharray:5 4");
  if (used.has("agents")) lines.push("  classDef agents stroke-dasharray:2 3");
  return { title: middle ? middle.name : null, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted };
}

// The landscape pack, read once for both of a system's pictures: its kinds, which carry the
// ArchiMate element a client draws as a mark before the name and whose name is the stereotype
// under it, and the services, data objects and concepts its tables reach. Nothing here is a word:
// a box's second line is the kind's own name, an arrow's label the interface or the access token
// as the row writes it, and what a dotted line or a heavy arrow means is the client's reading line.
const ACCESS_ARROW = { master: "==>", writes: "-->", reads: "-.->" };
// The six elements a kind may name; any other text draws no mark, as a kind with no page does.
const ELEMENTS = new Set(["application-component", "node", "system-software", "device", "equipment", "communication-network"]);
/**
 * @param {Snapshot} s
 */
function landscapeOf(s) {
  requireType(s, "system");
  /** @param {string} type */
  const named = (type) => new Map(s.entities.filter((e) => e.type === type).map((e) => [e.name, e]));
  const kinds = named("system-kind"), objects = named("data-object"), concepts = named("concept");
  const systems = s.entities.filter((e) => e.type === "system"), services = s.entities.filter((e) => e.type === "service");
  // A table's rows by column, each cell its text, so a missing column reads as empty.
  /** @param {Entity} e @param {string} heading @returns {Record<string, string>[]} */
  const rows = (e, heading) => {
    const t = e.sections.find((x) => x.heading === heading)?.tables?.[0];
    return t ? t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, text(r[i]).trim()]))) : [];
  };
  // A kind that resolves to no page gives the name alone: no mark of an element nobody named.
  /** @param {Entity} sys */
  const box = (sys) => {
    const kind = kinds.get(text(sys.fields?.kind)), element = text(kind?.fields?.element);
    return `${kind && ELEMENTS.has(element) ? `fak:fa-${element} ` : ""}<b>${label(sys.name)}</b>${kind ? `<br/><small>«${label(kind.name)}»</small>` : ""}`;
  };
  /** @param {Entity} sys */
  const lifecycle = (sys) => { const l = text(sys.fields?.lifecycle); return l === "planned" ? "planned" : l === "retiring" || l === "retired" ? "retiring" : ""; };
  /** @param {Record<string, string>} r */
  const connection = (r) => [r.As, r.Carries, r.Via].filter(Boolean).join(" · ");
  // A held row's concept is the row's own cell, or the data object's own `realizes` where the
  // cell is blank, read the same way by both shapes so they agree about every row.
  /** @param {Record<string, string>} r */
  const conceptOf = (r) => r.Concept || text(objects.get(r["Data object"] ?? "")?.fields?.realizes);
  // A held row's cylinder: the data object over its concept, or the concept alone where the
  // system keeps it in no modeled form; a row that resolves to neither draws nothing.
  /** @param {Record<string, string>} r @returns {{ e: Entity; text: string } | null} */
  const cylinder = (r) => {
    const obj = objects.get(r["Data object"] ?? ""), under = conceptOf(r), con = concepts.get(under);
    if (obj) return { e: obj, text: `${label(obj.name)}${under ? `<br/><small>${label(under)}</small>` : ""}` };
    return con ? { e: con, text: label(con.name) } : null;
  };
  /** @param {Snapshot} s @param {string} id */
  const middleOf = (s, id) => { const e = requireId(s, id); if (e.type !== "system") throw notA("id", e, "system"); return e; };
  return { kinds, systems, services, rows, box, lifecycle, connection, conceptOf, cylinder, middleOf };
}

// The drawing both shapes share: a box per system, declared once with its lifecycle's class,
// a cylinder per held row, and the classes the source used, the middle's always.
/** @param {ReturnType<typeof landscapeOf>} L @param {Entity} middle */
function landscapeDrawing(L, middle) {
  const { nodes, of } = namer();
  const lines = ["flowchart LR"];
  const /** @type {DiagramLink[]} */ links = [];
  const /** @type {Set<string>} */ declared = new Set(), /** @type {Set<string>} */ used = new Set();
  /** @param {Entity} sys */
  const system = (sys) => {
    const n = of(sys);
    if (declared.has(n)) return n;
    declared.add(n);
    // The middle's heavier border is its class on the line; a lifecycle's dash is a class line of
    // its own, so a planned middle carries both.
    const life = L.lifecycle(sys), cls = sys.id === middle.id ? "middle" : life;
    if (life) used.add(life);
    lines.push(`  ${n}["${L.box(sys)}"]${cls ? `:::${cls}` : ""}`);
    if (cls === "middle" && life) lines.push(`  class ${n} ${life}`);
    return n;
  };
  /** @param {string} from @param {Record<string, string>} r */
  const held = (from, r) => {
    const c = L.cylinder(r);
    if (!c) return;
    const n = of(c.e);
    if (!declared.has(n)) { declared.add(n); lines.push(`  ${n}[("${c.text}")]`); }
    const access = r.Access ?? "";
    lines.push(`  ${from} ${ACCESS_ARROW[/** @type {keyof typeof ACCESS_ARROW} */ (access)] ?? "-->"}${access ? `|"${label(access)}"|` : ""} ${n}`);
    links.push({ from, to: n, label: access });
  };
  /** @param {DiagramKind} shape */
  const finish = (shape) => {
    if (nodes.length > DIAGRAM_CAP) throw cannot(shape, "too_large", nodes.length, middle);
    lines.push("  classDef middle stroke-width:2px");
    if (used.has("planned")) lines.push("  classDef planned stroke-dasharray:5 4");
    if (used.has("retiring")) lines.push("  classDef retiring stroke-dasharray:2 3");
    return { title: middle.name, mermaid: lines.join("\n"), nodes, links, edges: links.length, omitted: 0 };
  };
  return { nodes, of, lines, links, system, held, finish };
}

/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function systemDiagram(s, id) {
  const L = landscapeOf(s), middle = L.middleOf(s, id);
  const D = landscapeDrawing(L, middle);
  const me = D.system(middle);
  const byNameOf = new Map(L.systems.map((x) => [x.name, x]));
  const host = byNameOf.get(text(middle.fields?.["part-of"]));
  if (host && host.id !== middle.id) { const n = D.system(host); D.lines.push(`  ${me} -.- ${n}`); D.links.push({ from: me, to: n, label: "part-of" }); }
  for (const part of [...L.systems].sort(byName)) {
    if (part.id === middle.id || text(part.fields?.["part-of"]) !== middle.name) continue;
    const n = D.system(part); D.lines.push(`  ${n} -.- ${me}`); D.links.push({ from: n, to: me, label: "part-of" });
  }
  /** @param {string} from @param {string} to @param {Record<string, string>} r */
  const connect = (from, to, r) => { const l = L.connection(r); D.lines.push(`  ${from} -->${l ? `|"${label(l)}"|` : ""} ${to}`); D.links.push({ from, to, label: l }); };
  for (const r of L.rows(middle, "Connects to")) { const src = byNameOf.get(r.System ?? ""); if (src) connect(D.system(src), me, r); }
  for (const taker of [...L.systems].sort(byName)) {
    if (taker.id === middle.id) continue;
    for (const r of L.rows(taker, "Connects to")) if (r.System === middle.name) connect(me, D.system(taker), r);
  }
  for (const svc of [...L.services].sort(byName)) {
    if (!names(svc.fields?.["provided-by"]).includes(middle.name)) continue;
    const n = D.of(svc); D.lines.push(`  ${n}(["${label(svc.name)}"])`, `  ${me} --o ${n}`); D.links.push({ from: me, to: n, label: "provided-by" });
  }
  for (const r of L.rows(middle, "Holds")) D.held(me, r);
  return D.finish("system");
}

/**
 * @param {Snapshot} s
 * @param {string} id
 * @returns {Drawing}
 */
function holdsDiagram(s, id) {
  const L = landscapeOf(s), middle = L.middleOf(s, id);
  const mine = new Set(L.rows(middle, "Holds").map(L.conceptOf).filter(Boolean));
  const others = L.systems.filter((x) => x.id !== middle.id).sort(byName);
  const held = [middle, ...others].flatMap((sys) => L.rows(sys, "Holds").filter((r) => mine.has(L.conceptOf(r)) && L.cylinder(r)).map((r) => ({ sys, r })));
  if (!held.length) throw cannot("holds", "empty", 0);
  const D = landscapeDrawing(L, middle);
  for (const { sys, r } of held) D.held(D.system(sys), r);
  return D.finish("holds");
}

// Which shape takes which argument: `id` names what a process, a neighborhood, a context map or an
// aggregate is of, `domain` narrows the concepts and `type` the schemas.
/** @type {Record<string, DiagramKind[]>} */
const TAKES = { id: ["process", "neighborhood", "context", "aggregate", "flow", "lifecycle", "organization", "system", "holds"], domain: ["concepts"], type: ["schema"] };
// The shapes whose `id` only narrows, as `domain` narrows the concepts: without one they draw the whole.
const NARROWS_BY_ID = ["organization"];

// What a caller may ask for, by the same table: the shapes that take an id need one, and the two
// that narrow by something else take that alone. The checks below hold an untyped caller to it.
/**
 * @typedef {{ shape: Exclude<DiagramKind, "concepts" | "schema" | "organization">; id: string }
 *   | { shape: "organization"; id?: string | undefined }
 *   | { shape: "concepts"; domain?: string | undefined }
 *   | { shape: "schema"; type?: string | undefined }} DiagramRequest
 */

/**
 * @param {Snapshot} s
 * @param {DiagramRequest} request
 * @returns {z.infer<typeof OUTPUTS.diagram>}
 */
export function diagram(s, request) {
  const { shape, id, domain, type } = /** @type {{ shape?: DiagramKind; id?: string; domain?: string; type?: string }} */ (request === undefined ? {} : request);
  if (!SHAPES.includes(/** @type {DiagramKind} */ (shape))) throw new ModelError("invalid_argument", `shape is one of ${SHAPES.join(", ")}`, { details: { argument: "shape", reason: `one of ${SHAPES.join(", ")}` } });
  for (const [argument, value] of Object.entries({ id, domain, type }))
    if (value !== undefined && !TAKES[argument].includes(/** @type {DiagramKind} */ (shape)))
      throw new ModelError("invalid_argument", `the ${shape} diagram takes no ${argument}${argument === "id" && NARROW[/** @type {DiagramKind} */ (shape)] ? `; name a ${NARROW[/** @type {DiagramKind} */ (shape)]} to draw part of it` : ""}`, { details: { argument, reason: `not taken by ${shape}` } });
  if (TAKES.id.includes(/** @type {DiagramKind} */ (shape)) && !NARROWS_BY_ID.includes(/** @type {DiagramKind} */ (shape)) && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
  if (shape === "process") requireType(s, "phase");
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? processDiagram(s, /** @type {string} */ (id)) : shape === "neighborhood" ? neighborhood(s, /** @type {string} */ (id))
    : shape === "context" ? contextMap(s, /** @type {string} */ (id)) : shape === "aggregate" ? aggregates(s, /** @type {string} */ (id))
    : shape === "flow" ? flow(s, /** @type {string} */ (id)) : shape === "lifecycle" ? lifecycle(s, /** @type {string} */ (id))
    : shape === "system" ? systemDiagram(s, /** @type {string} */ (id)) : shape === "holds" ? holdsDiagram(s, /** @type {string} */ (id))
    : shape === "organization" ? organization(s, id) : schemas(s, type);
  return { shape: /** @type {DiagramKind} */ (shape), ...drawn, model: provenance(s) };
}
