import { PACKS } from "companygraph-meta-model/checks";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDir, readSchemas } from "../lib/read.mjs";
import { buildSnapshot, parserTag } from "../lib/snapshot.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
export const fixtureRoot = path.join(fixtures, "meta-model");
export const instanceRoot = path.join(fixtures, "mental-model");
// The reference instance the suite runs against, pinned here as test data: a real instance with
// an identity and a profile that share one name.
export const INSTANCE_COMMIT = "f4e8fd22aebcdb4fd92cce386043a3d8ddf7bde7";

export const COMMIT = "0123456789abcdef0123456789abcdef01234567";

// Versions are read, never typed: the parser from the pin, each core from the manifest it ships.
// A literal here went stale with every parser release and failed the suite for no reason.
export const PARSER = parserTag();
export const EXAMPLE_CORE = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "core", "manifest.json"), "utf8")).version;
export const INSTANCE_CORE = JSON.parse(fs.readFileSync(path.join(instanceRoot, "meta", "core", "manifest.json"), "utf8")).version;
// The example has no manifest, so the packs it takes are named here, once (meta-model 0.86.0): the
// organization pack, whose groups, group kinds and jobs the example holds, and (0.89.0) the
// landscape pack, whose systems, system kinds, data objects and services it holds. Their schemas ride along
// with the core's the way readSchemas carries an instance's, under `<pack>/<file>`.
// Mirrors meta-model's verify/example.mjs (not shipped in the package); extended when the example takes another pack.
export const EXAMPLE_PACKS = ["organization", "landscape"];
const schemaCount = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith("-schema.md")).length;
export const EXAMPLE_TYPES = schemaCount(path.join(fixtureRoot, "core"))
  + EXAMPLE_PACKS.reduce((n, pack) => n + schemaCount(path.join(fixtureRoot, "packs", pack)), 0);

// The folders of the pages the example holds for the packs it takes.
// The folders each pack's types sit in, read from the release's own table of them, the first
// segment of a row's folder (`bounded-contexts/<bounded-context>` sits in `bounded-contexts`).
export const PACK_FOLDERS = Object.fromEntries(Object.entries(PACKS).map(([pack, rows]) => [pack, [...new Set(rows.map((r) => r.folder.split("/")[0]))]]));
export const EXAMPLE_PACK_FOLDERS = EXAMPLE_PACKS.flatMap((pack) => PACK_FOLDERS[pack]);

export function exampleFiles() {
  const schemas = readDir(path.join(fixtureRoot, "core"));
  for (const pack of EXAMPLE_PACKS) for (const [file, text] of readDir(path.join(fixtureRoot, "packs", pack))) schemas.set(`${pack}/${file}`, text);
  return { files: readDir(path.join(fixtureRoot, "example", "model")), schemas };
}

export function exampleSnapshot() {
  const { files, schemas } = exampleFiles();
  return buildSnapshot({ files, schemas, sub: "example/model/", core: "core/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
}

// The reference instance, read the way its own site reads it: model/ against the core it vendors.
export function instanceSnapshot() {
  return buildSnapshot({ files: readDir(path.join(instanceRoot, "model")), schemas: readDir(path.join(instanceRoot, "meta", "core")),
    sub: "model/", core: "meta/core/", commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", parserTag: PARSER });
}

// The reference instance read from a root other than the vendored fixture, such as a local
// checkout on another branch, for a preview run before that branch's own commit is pinned here.
export function instanceSnapshotAt(root) {
  return buildSnapshot({ files: readDir(path.join(root, "model")), schemas: readDir(path.join(root, "meta", "core")),
    sub: "model/", core: "meta/core/", commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", parserTag: PARSER });
}

// The company of one: an identity and a profile with the same name. The example has no such
// pair, so one is added — a profile page carries only what the parser needs to read it.
export function withSharedName() {
  const { files, schemas } = exampleFiles();
  const root = files.get("identity.md").match(/^# (.+)$/m)[1];
  const slug = root.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  files.set(`profiles/${slug}/${slug}.md`, `---\nsource: Local\nnature: human\n---\n\n# ${root}\n\n> The founder, profiled under the company's own name.\n\n## Summary\n\nOne person.\n`);
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
}

// An id made up for a page a fixture adds, in the form the example's own ids take, so that a
// test of a stable id meets one on every page and never the page's address standing in for it.
export const FRESH_ID = "01a0ffff-0000-7000-8000-000000000001";

// The entity a snapshot holds at an address, the folder and slug where its page sits. A test
// names an entity the way a person writing it would, by where its page is, and takes the id the
// snapshot gives it from here, since a stable id is read off the page and never derived.
export const at = (s, address) => {
  const e = s.entities.find((x) => x.address === address);
  if (!e) throw new Error(`nothing sits at ${address}`);
  return e;
};
export const idAt = (s, address) => at(s, address).id;

// Core 0.31.0: a name of an owned type is unique within its owner, so two profiles may each own a
// period of one title. The example's first profile's first experience is copied, title and all,
// under the second profile, which is valid and parses. The copy is another entity, so it carries
// an id of its own and not the original's. `owners` are the two profiles' ids, `addresses` where
// their pages sit.
export function withOwnedNameTwice() {
  const { files, schemas } = exampleFiles();
  const periods = [...files.keys()].filter((k) => /^profiles\/[^/]+\/experiences\/[^/]+\.md$/.test(k) && !k.endsWith("/README.md"));
  const [first, second] = [...new Set(periods.map((k) => k.split("/")[1]))].sort();
  const source = periods.filter((k) => k.startsWith(`profiles/${first}/experiences/`)).sort()[0];
  files.set(source.replace(`profiles/${first}/`, `profiles/${second}/`), files.get(source).replace(/^id: .+$/m, `id: ${FRESH_ID}`));
  const title = files.get(source).match(/^# (.+)$/m)[1];
  const snapshot = buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  const addresses = [`profiles/${first}`, `profiles/${second}`];
  return { snapshot, title, owners: addresses.map((a) => idAt(snapshot, a)), addresses };
}

// Concepts made for the diagram tests, in the example's own form: a page, a tagline, and a
// Relations table naming other concepts by title. A row of `related` is a name, or a `[name, as]`
// pair when the row's own As cell matters to the test, and is empty otherwise. The example holds
// no concept with more than a handful of edges, none that names itself, and no title with
// Mermaid's own syntax in it.
const concept = (name, related) => `---\nsource: Local\n---\n\n# ${name}\n\n> A concept made for a test.\n`
  + (related.length ? `\n## Relations\n\n| Concept | Cardinality | As |\n| --- | --- | --- |\n${related
      .map((r) => (Array.isArray(r) ? r : [r, ""])).map(([rel, as]) => `| ${rel} | one | ${as} |`).join("\n")}\n` : "");

const built = (files, schemas) => buildSnapshot({ files, schemas, sub: "example/model/", core: "core/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });

// A concept, Hub, that names `out` leaves and is named by `into` feeders: past the cap when
// `out` is large, and exactly at it when the leaves, the feeders and its source make fifty.
export function withHub({ out = 60, into = 5 } = {}) {
  const { files, schemas } = exampleFiles();
  const leaves = Array.from({ length: out }, (_, i) => `Leaf ${String(i).padStart(2, "0")}`);
  files.set("concepts/hub.md", concept("Hub", leaves));
  leaves.forEach((name, i) => files.set(`concepts/leaf-${String(i).padStart(2, "0")}.md`, concept(name, [])));
  for (let i = 0; i < into; i++) files.set(`concepts/feeder-${i}.md`, concept(`Feeder ${i}`, ["Hub"]));
  return built(files, schemas);
}

// Loop names itself and Partner; Partner names Loop back, under a title full of Mermaid syntax.
export const ODD = 'Partner "A" <B> #1 --> C';
export function withLoops() {
  const { files, schemas } = exampleFiles();
  files.set("concepts/loop.md", concept("Loop", ["Loop", ODD]));
  files.set("concepts/partner.md", concept(ODD, ["Loop"]));
  return built(files, schemas);
}

// The example's Delivery, with Build's table rewritten to two rows leading back to Specify, one
// of them with Mermaid's own characters in its outcome, and Release's stop row made a stay, so
// Delivery holds merged back arrows and, with Specify's stop removed too, no stop at all.
export function withBackFlows() {
  const s = structuredClone(exampleSnapshot());
  const id = (p) => idAt(s, `processes/delivery/phases/${p}`);
  const table = (e) => e.sections.find((x) => x.heading === "If not met").tables[0];
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  table(byId.get(id("specify"))).rows = [["reshaped", "Specify"]];
  table(byId.get(id("build"))).rows = [["respecified", "Specify"], ['held "for now" <#1>', "Specify"]];
  table(byId.get(id("release"))).rows = [["held", "Release"]];
  s.edges = s.edges.filter((x) => x.via !== "If not met.Leads to");
  s.edges.push(
    { from: id("specify"), via: "If not met.Leads to", to: id("specify"), attrs: { Outcome: "reshaped" } },
    { from: id("build"), via: "If not met.Leads to", to: id("specify"), attrs: { Outcome: "respecified" } },
    { from: id("build"), via: "If not met.Leads to", to: id("specify"), attrs: { Outcome: 'held "for now" <#1>' } },
    { from: id("release"), via: "If not met.Leads to", to: id("release"), attrs: { Outcome: "held" } },
  );
  return s;
}

// Bond names Glue with an As cell holding both a colon and a semicolon, the two characters an
// association's unquoted text must escape that a quoted label does not. Quoted names Glue with an
// As holding a quote and a semicolon, which must be mapped in one pass, since mapping after
// `label()` would break its `#quot;`.
export function withPunctuation() {
  const { files, schemas } = exampleFiles();
  files.set("concepts/bond.md", concept("Bond", [["Glue", "a: b; c"]]));
  files.set("concepts/glue.md", concept("Glue", []));
  files.set("concepts/quoted.md", concept("Quoted", [["Glue", 'the "glue"; a']]));
  return built(files, schemas);
}

// A domain no concept names, a process with no phases yet, and a concept in Pricing that names
// a concept of no domain at all.
export function withNothingToDraw() {
  const { files, schemas } = exampleFiles();
  files.set("domains/support.md", "---\nsource: Local\n---\n\n# Support\n\n> A domain made for a test, which no concept names.\n");
  files.set("processes/intake/intake.md", "---\nsource: Local\n---\n\n# Intake\n\n> A process made for a test, which has no phases yet.\n");
  files.set("concepts/stray.md", concept("Stray", []));
  files.set("concepts/priced.md", concept("Priced", ["Stray"]).replace("source: Local\n", "source: Local\ndomain: Pricing\n"));
  return built(files, schemas);
}

// An instance that takes the software pack (meta-model 0.68.0): the example's model with one
// bounded context added, its core at `meta/core/` and the pack's schemas, as the pinned release
// ships them, at `meta/software/`, beside it, with the manifest naming the pack. Written to a
// fresh directory each call, so a test reads it the way a CLI reads a checkout.
export const CONTEXT_ID = "01a0ffff-0000-7000-8000-0000000000bc";
export function packInstanceDir({ packs = ["software"] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pack-instance-"));
  fs.mkdirSync(path.join(root, ".companygraph"));
  fs.writeFileSync(path.join(root, ".companygraph", "manifest.json"), JSON.stringify({ packs }) + "\n");
  fs.cpSync(path.join(fixtureRoot, "core"), path.join(root, "meta", "core"), { recursive: true });
  for (const pack of packs) fs.cpSync(path.join(fixtureRoot, "packs", pack), path.join(root, "meta", pack), { recursive: true });
  fs.cpSync(path.join(fixtureRoot, "example", "model"), path.join(root, "model"), { recursive: true });
  // The example holds the pages of the packs it takes; an instance that takes none of them
  // holds none of those pages, which R13 would otherwise refuse.
  for (const [pack, folders] of Object.entries(PACK_FOLDERS)) if (!packs.includes(pack)) for (const folder of folders) fs.rmSync(path.join(root, "model", folder), { recursive: true, force: true });
  if (!packs.includes("software")) return root;
  fs.mkdirSync(path.join(root, "model", "bounded-contexts", "quoting"), { recursive: true });
  fs.writeFileSync(path.join(root, "model", "bounded-contexts", "quoting", "quoting.md"),
    `---\nid: ${CONTEXT_ID}\nsource: Local\nclassification: core\nrealizes:\n  - Pricing\n---\n\n# Quoting\n\n> Prices an order. Invoicing it is left to another context.\n\n## Responsibilities\n\n- Price an order before it is placed\n`);
  return root;
}

// The example as a command line reads it: model/ beside a vendored core and the packs the example
// takes, with the manifest that names them, since a directory of pages and a bare core is an
// instance that takes no pack.
export const exampleInstanceDir = () => packInstanceDir({ packs: EXAMPLE_PACKS });

// Bounded contexts drawn as the software pack draws them: the pack instance with four contexts
// beside Quoting and two aggregates inside it. Quoting conforms to Catalog and shares a kernel
// with Invoicing, which names the kernel back, so the two rows draw one arrow; Ordering is
// Quoting's customer; Archive relates to nothing. `disagree` has Catalog name Quoting as a
// partner as well, which Quoting's own row contradicts. Quote holds a line, Money and a Discount
// its root names no cardinality for, reaches a Customer it does not hold, and emits two events;
// Price list holds Money too, so a context's aggregates share one Money. `crowd` adds that many
// contexts conforming to Quoting and as many value objects Quote holds, to reach the cap.
export const CONTEXT_IDS = {
  catalog: "01a0ffff-0000-7000-8000-000000000101", invoicing: "01a0ffff-0000-7000-8000-000000000102",
  ordering: "01a0ffff-0000-7000-8000-000000000103", archive: "01a0ffff-0000-7000-8000-000000000104",
  quote: "01a0ffff-0000-7000-8000-000000000111", priceList: "01a0ffff-0000-7000-8000-000000000112",
  quoteDesign: "01a0ffff-0000-7000-8000-000000000121", lineDesign: "01a0ffff-0000-7000-8000-000000000122",
  money: "01a0ffff-0000-7000-8000-000000000123", discount: "01a0ffff-0000-7000-8000-000000000124",
  customer: "01a0ffff-0000-7000-8000-000000000125", priceListDesign: "01a0ffff-0000-7000-8000-000000000126",
  sent: "01a0ffff-0000-7000-8000-000000000131", accepted: "01a0ffff-0000-7000-8000-000000000132",
};
export const ODD_ATTRIBUTE = 'Note "a" #1: {x}';
const C = CONTEXT_IDS;
const table = (head, rows) => `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
const context = (id, name, classification, relationships) =>
  `---\nid: ${id}\nsource: Local\nclassification: ${classification}\n---\n\n# ${name}\n\n> A context made for a test. What it leaves to another is not its point.\n\n## Responsibilities\n\n- Stand in a test\n${relationships.length ? `\n## Relationships\n\n${table(["Context", "Pattern"], relationships)}` : ""}`;
const design = (id, name, kind, attributes, relations) =>
  `---\nid: ${id}\nsource: Local\nkind: ${kind}\n---\n\n# ${name}\n\n> A term made for a test.\n${attributes.length ? `\n## Attributes\n\n${table(["Attribute", "Type"], attributes)}` : ""}${relations.length ? `\n## Relations\n\n${table(["Concept", "Cardinality"], relations)}` : ""}`;
const aggregate = (id, name, root, members, commands = [], transitions = []) =>
  `---\nid: ${id}\nsource: Local\nroot: ${root}\nmembers:\n${members.map((m) => `  - ${m}\n`).join("")}---\n\n# ${name}\n\n> What the test needs kept consistent.\n\n## Invariants\n\n${table(["Label", "Invariant"], [["INV-T1", "It holds after every change."]])}`
  + (commands.length ? `\n## Handled commands\n\n${table(["Command", "Emits", "When", "Description"], commands)}` : "")
  + (transitions.length ? `\n## State transitions\n\n${table(["From", "Command", "To"], transitions)}` : "");
const event = (id, name, by) => `---\nid: ${id}\nsource: Local\nemitted-by: ${by}\n---\n\n# ${name}\n\n> Something happened in a test.\n`;

export function withContexts({ disagree = false, crowd = 0 } = {}) {
  const root = packInstanceDir();
  const dir = (...p) => path.join(root, "model", "bounded-contexts", ...p);
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write(dir("quoting", "quoting.md"), context(CONTEXT_ID, "Quoting", "core", [["Catalog", "conformist"], ["Invoicing", "shared kernel"]]));
  write(dir("catalog", "catalog.md"), context(C.catalog, "Catalog", "supporting", disagree ? [["Quoting", "partnership"]] : []));
  write(dir("invoicing", "invoicing.md"), context(C.invoicing, "Invoicing", "core", [["Quoting", "shared kernel"]]));
  write(dir("ordering", "ordering.md"), context(C.ordering, "Ordering", "generic", [["Quoting", "customer/supplier"]]));
  write(dir("archive", "archive.md"), context(C.archive, "Archive", "generic", []));
  const crowded = Array.from({ length: crowd }, (_, i) => String(i).padStart(2, "0"));
  for (const n of crowded) {
    write(dir(`crowd-${n}`, `crowd-${n}.md`), context(`01a0ffff-0000-7000-8000-0000000002${n}`, `Crowd ${n}`, "generic", [["Quoting", "conformist"]]));
    write(dir("quoting", "concept-designs", `part-${n}.md`), design(`01a0ffff-0000-7000-8000-0000000003${n}`, `Part ${n}`, "value object", [], []));
  }
  write(dir("quoting", "aggregates", "quote.md"), aggregate(C.quote, "Quote", "Quote", ["Quote line", "Money", "Discount", ...crowded.map((n) => `Part ${n}`)],
    [["Send quote", "Quote sent", "", "Sends it to the customer"], ["Accept quote", "Quote accepted", "the customer signs before it expires", ""], ["Accept quote", "", "it has expired (INV-T1)", ""]],
    [["", "Send quote", "Sent"], ["Sent", "Accept quote", "Accepted"], ["Sent", "", "Expired"]]));
  write(dir("quoting", "aggregates", "price-list.md"), aggregate(C.priceList, "Price list", "Price list", ["Money"], [["Publish price list", "", "", ""]]));
  write(dir("quoting", "concept-designs", "quote.md"), design(C.quoteDesign, "Quote", "entity",
    [["Number", "string"], ["Total", "Money"], [ODD_ATTRIBUTE, "string"]], [["Quote line", "one to many"], ["Money", "one"], ["Customer", "maybe one"]]));
  write(dir("quoting", "concept-designs", "quote-line.md"), design(C.lineDesign, "Quote line", "entity", [["Quantity", "number"]], [["Money", "one"]]));
  write(dir("quoting", "concept-designs", "money.md"), design(C.money, "Money", "value object", [["Amount", "decimal"], ["Currency", "ISO 4217 code"]], []));
  write(dir("quoting", "concept-designs", "discount.md"), design(C.discount, "Discount", "value object", [], []));
  write(dir("quoting", "concept-designs", "customer.md"), design(C.customer, "Customer", "value object", [], []));
  write(dir("quoting", "concept-designs", "price-list.md"), design(C.priceListDesign, "Price list", "entity", [], [["Money", "many"]]));
  write(dir("quoting", "domain-events", "quote-sent.md"), event(C.sent, "Quote sent", "Quote"));
  write(dir("quoting", "domain-events", "quote-accepted.md"), event(C.accepted, "Quote accepted", "Quote"));
  return buildSnapshot({ files: readDir(path.join(root, "model")), schemas: readSchemas(path.join(root, "meta", "core")),
    sub: "model/", core: "meta/core/", commit: COMMIT, repo: "companygraph/pack-instance", parserTag: PARSER });
}
