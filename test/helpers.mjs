import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDir } from "../lib/read.mjs";
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
export const EXAMPLE_TYPES = fs.readdirSync(path.join(fixtureRoot, "core")).filter((f) => f.endsWith("-schema.md")).length;

export function exampleFiles() {
  return { files: readDir(path.join(fixtureRoot, "example", "model")), schemas: readDir(path.join(fixtureRoot, "core")) };
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

// Core 0.31.0: a name of an owned type is unique within its owner, so two profiles may each own a
// period of one title. The example's first profile's first experience is copied, title and all,
// under the second profile, which is valid and parses.
export function withOwnedNameTwice() {
  const { files, schemas } = exampleFiles();
  const periods = [...files.keys()].filter((k) => /^profiles\/[^/]+\/experiences\/[^/]+\.md$/.test(k) && !k.endsWith("/README.md"));
  const [first, second] = [...new Set(periods.map((k) => k.split("/")[1]))].sort();
  const source = periods.filter((k) => k.startsWith(`profiles/${first}/experiences/`)).sort()[0];
  files.set(source.replace(`profiles/${first}/`, `profiles/${second}/`), files.get(source));
  const title = files.get(source).match(/^# (.+)$/m)[1];
  const snapshot = buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  return { snapshot, title, owners: [`profiles/${first}`, `profiles/${second}`] };
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
  const id = (p) => `processes/delivery/phases/${p}`;
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
// association's unquoted text must escape that a quoted label does not.
export function withPunctuation() {
  const { files, schemas } = exampleFiles();
  files.set("concepts/bond.md", concept("Bond", [["Glue", "a: b; c"]]));
  files.set("concepts/glue.md", concept("Glue", []));
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
