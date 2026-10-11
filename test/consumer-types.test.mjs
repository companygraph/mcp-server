import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The declarations as a TypeScript consumer meets them: the package as `npm pack` writes it,
// installed beside a strict NodeNext project with skipLibCheck off. `build:check` holds `types/`
// to the JSDoc; this holds the tarball to the exports, every subpath packed and resolving its `types`, and a
// few public calls to the signature they promise. A `@ts-expect-error` that finds no error fails
// the compile, so each wrong call below is a check that the type refuses it.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const tsc = path.join(path.dirname(createRequire(import.meta.url).resolve("typescript/package.json")), "bin", "tsc");

const CALLS = `
import type { Snapshot } from "${pkg.name}/snapshot";
import { schemaOf, fetchEntity } from "${pkg.name}/model";
import { diagram } from "${pkg.name}/diagram";
declare const s: Snapshot;

const text: string = fetchEntity(s, "x").text;
// @ts-expect-error text is a string, and nothing wider
const notText: number = fetchEntity(s, "x").text;
const schema = schemaOf(s, "x");
// @ts-expect-error a type no schema declares has none
schema.name;
const name: string | undefined = schema?.name;

const drawn = diagram(s, { shape: "schema", type: "x" });
const shape: "schema" | "process" | "concepts" | "neighborhood" | "context" | "aggregate" | "flow" | "lifecycle" | "organization" | "system" | "holds" = drawn.shape;
const everyType: { via: string; to: string; multiplicity: string }[] | undefined = drawn.everyType;
// @ts-expect-error everyType is a list, and nothing wider
const notEveryType: number = drawn.everyType;
diagram(s, { shape: "process", id: "x" });
// @ts-expect-error a process is drawn of one
diagram(s, { shape: "process" });
// @ts-expect-error the concepts are narrowed by a domain, not an id
diagram(s, { shape: "concepts", id: "x" });
// @ts-expect-error a shape the tool does not draw
diagram(s, { shape: "map" });
// @ts-expect-error an id is a string
fetchEntity(s, 1);

export { text, notText, name, shape, everyType, notEveryType };
`;

test("a strict TypeScript consumer of the packed package types every subpath and refuses a wrong call", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-server-consumer-"));
  try {
    const packed = spawnSync("npm", ["pack", "--silent", "--pack-destination", dir], { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
    assert.equal(packed.status, 0, packed.stderr);
    const tarball = path.join(dir, packed.stdout.trim().split("\n").at(-1));
    const installed = path.join(dir, "node_modules", pkg.name);
    fs.mkdirSync(installed, { recursive: true });
    const unpacked = spawnSync("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"], { encoding: "utf8" });
    assert.equal(unpacked.status, 0, unpacked.stderr);
    // The package's own dependencies, as npm would have put them beside it; each resolves its
    // own from this repository's node_modules, where the link leads.
    for (const dep of [...Object.keys(pkg.dependencies), "@types/node"]) {
      fs.mkdirSync(path.dirname(path.join(dir, "node_modules", dep)), { recursive: true });
      fs.symlinkSync(path.join(ROOT, "node_modules", dep), path.join(dir, "node_modules", dep), "junction");
    }

    const subpaths = Object.keys(pkg.exports).map((k) => (k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`));
    const imports = subpaths.map((p, i) => `import * as m${i} from "${p}";`).join("\n");
    fs.writeFileSync(path.join(dir, "subpaths.mts"), `${imports}\nexport const all = [${subpaths.map((_, i) => `m${i}`).join(", ")}];\n`);
    fs.writeFileSync(path.join(dir, "calls.mts"), CALLS);
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
    fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: {
      target: "ES2024", lib: ["ES2024"], types: ["node"], module: "NodeNext", moduleResolution: "NodeNext",
      strict: true, exactOptionalPropertyTypes: true, noEmit: true, skipLibCheck: false,
    }, files: ["subpaths.mts", "calls.mts"] }));

    // Every subpath the package exports, and every one of them packed.
    for (const [k, v] of Object.entries(pkg.exports))
      for (const file of [v.types, v.default])
        assert.ok(fs.existsSync(path.join(installed, file)), `${k} names ${file}, and the tarball holds no such file`);
    const checked = spawnSync(process.execPath, [tsc, "--project", dir], { cwd: dir, encoding: "utf8" });
    assert.equal(checked.status, 0, `${checked.stdout}${checked.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
