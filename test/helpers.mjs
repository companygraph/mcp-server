import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDir } from "../lib/read.mjs";
import { buildSnapshot } from "../lib/snapshot.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
export const fixtureRoot = path.join(fixtures, "meta-model");
export const instanceRoot = path.join(fixtures, "mental-model");
// The reference instance the suite runs against, pinned here as test data: 143 entities, 608
// edges, core 0.25.2 vendored, and an identity and a profile that share one name.
export const INSTANCE_COMMIT = "2fd146fe669ef80f7d7b8090ad1cf533b9020ebc";

export const COMMIT = "0123456789abcdef0123456789abcdef01234567";

export function exampleFiles() {
  return { files: readDir(path.join(fixtureRoot, "example", "model")), schemas: readDir(path.join(fixtureRoot, "core")) };
}

export function exampleSnapshot() {
  const { files, schemas } = exampleFiles();
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: "v0.25.2" });
}

// The reference instance, read the way its own site reads it: model/ against the core it vendors.
export function instanceSnapshot() {
  return buildSnapshot({ files: readDir(path.join(instanceRoot, "model")), schemas: readDir(path.join(instanceRoot, "meta", "core")),
    sub: "model/", commit: INSTANCE_COMMIT, repo: "robertblust/mental-model", parserTag: "v0.25.2" });
}

// The company of one: an identity and a profile with the same name. The example has no such
// pair, so one is added — a profile page carries only what the parser needs to read it.
export function withSharedName() {
  const { files, schemas } = exampleFiles();
  const root = files.get("identity.md").match(/^# (.+)$/m)[1];
  const slug = root.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  files.set(`profiles/${slug}/${slug}.md`, `---\nsource: Local\nnature: human\n---\n\n# ${root}\n\n> The founder, profiled under the company's own name.\n\n## Summary\n\nOne person.\n`);
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: "v0.25.2" });
}
