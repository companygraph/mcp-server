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
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
}

// The reference instance, read the way its own site reads it: model/ against the core it vendors.
export function instanceSnapshot() {
  return buildSnapshot({ files: readDir(path.join(instanceRoot, "model")), schemas: readDir(path.join(instanceRoot, "meta", "core")),
    sub: "model/", commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", parserTag: PARSER });
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
