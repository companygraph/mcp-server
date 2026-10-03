// A picture of part of the model, as Mermaid source, built from the snapshot's edges and never
// from prose, so every node is an entity at the served commit and every arrow an edge the model
// draws. Four shapes: the concepts and their Relations, one process's phases in their order
// with where each gate's failure leads, one entity with everything one hop from it, and the
// schemas themselves, the types and what each declares about another. The source names its
// nodes n0, n1 and on, and `nodes` says which entity each one is, or for a type which schema,
// with the schema's file as `url`, so a client links a node without reading the source, and
// `links` says which arrow joins which, its label unescaped. A label is a title escaped for
// Mermaid; nothing here is worded in any one language, so a client captions the picture in its
// reader's.
import { typeOfAddress } from "companygraph-meta-model/instance";
import { ModelError } from "./errors.mjs";
import { SHAPES } from "./schemas.mjs";
import { provenance, allEdges, requireId, requireType, relationsOf, schemaOf, schemaUrl, place } from "./model.mjs";

/**
 * @import { Entity, Edge } from "companygraph-meta-model/instance"
 * @import { Snapshot } from "./snapshot.mjs"
 * @import { Ref, ServedEdge } from "./model.mjs"
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
/** @param {unknown} text */
export const label = (text) => plain(String(text)
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;"));

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

// Naming a domain, or for the schemas a type, is the way out of a too-large picture, so the hint
// is only worth saying when none was named; a narrowed picture that is still too large has no
// such fix.
/** @type {Partial<Record<DiagramKind, string>>} */
const NARROW = { concepts: "domain", schema: "type" };
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

// An association's own text sits outside quotes, the one place Mermaid also ends a label at a
// `:` or a `;`, so there alone both are mapped once `label()` has run, the way it maps `#` first.
/** @param {unknown} v */
const unquoted = (v) => label(v).replace(/[:;]/g, (c) => (c === ":" ? "#58;" : "#59;"));

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

// Which shape takes which argument: `id` names what a process or a neighborhood is of, `domain`
// narrows the concepts and `type` the schemas.
/** @type {Record<string, DiagramKind[]>} */
const TAKES = { id: ["process", "neighborhood"], domain: ["concepts"], type: ["schema"] };

/**
 * @param {Snapshot} s
 * @param {{ shape?: DiagramKind | undefined; id?: string | undefined; domain?: string | undefined; type?: string | undefined }} [options]
 */
export function diagram(s, { shape, id, domain, type } = {}) {
  if (!SHAPES.includes(/** @type {DiagramKind} */ (shape))) throw new ModelError("invalid_argument", `shape is one of ${SHAPES.join(", ")}`, { details: { argument: "shape", reason: `one of ${SHAPES.join(", ")}` } });
  for (const [argument, value] of Object.entries({ id, domain, type }))
    if (value !== undefined && !TAKES[argument].includes(/** @type {DiagramKind} */ (shape)))
      throw new ModelError("invalid_argument", `the ${shape} diagram takes no ${argument}${argument === "id" && NARROW[/** @type {DiagramKind} */ (shape)] ? `; name a ${NARROW[/** @type {DiagramKind} */ (shape)]} to draw part of it` : ""}`, { details: { argument, reason: `not taken by ${shape}` } });
  if (TAKES.id.includes(/** @type {DiagramKind} */ (shape)) && id === undefined) throw new ModelError("invalid_argument", `the ${shape} diagram needs the id of what it draws`, { details: { argument: "id", reason: `needed by ${shape}` } });
  if (shape === "process") requireType(s, "phase");
  const drawn = shape === "concepts" ? concepts(s, domain) : shape === "process" ? processDiagram(s, /** @type {string} */ (id)) : shape === "neighborhood" ? neighborhood(s, /** @type {string} */ (id)) : schemas(s, type);
  return { shape, ...drawn, model: provenance(s) };
}
