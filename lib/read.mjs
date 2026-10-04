// The one place this package touches a filesystem or the network. Everything below it takes a
// Map(path → text), the shape the meta-model's parser reads, so the parser and the queries can
// be fed fixtures in tests.
import fs from "node:fs";
import path from "node:path";
import { IMAGE_FILE } from "companygraph-meta-model/instance";

/** @import { Files } from "companygraph-meta-model/instance" */

/**
 * Where a commit is read from: the repository, the commit, a token where one is given, and the
 * `fetch` to read through.
 * @typedef {{ repo: string; commit: string; token?: string | undefined; fetch?: typeof globalThis.fetch }} Source
 */

// A directory as the parser wants it: keys relative to the root, forward slashes, sorted.
/**
 * @param {string} root
 * @returns {Files}
 */
export function readDir(root) {
  /** @type {Files} */
  const files = new Map();
  /** @param {string} dir */
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      // A picture beside a page (core 0.38.0) is left out: the snapshot carries text, and a
      // picture read as text is a large field of nothing a client could use.
      else if (!IMAGE_FILE.test(ent.name)) files.set(path.relative(root, p).split(path.sep).join("/"), fs.readFileSync(p, "utf8"));
    }
  };
  walk(root);
  return sorted(files);
}

/** @param {Files} files */
const sorted = (files) => new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
const MANIFEST = ".companygraph/manifest.json";

// The packs an instance takes (meta-model 0.68.0, R20), from its manifest: where its units sit,
// `meta` unless it says otherwise, and the name of each pack, whose schemas sit at
// `<units>/<pack>/`. An instance with no manifest, or one naming no pack, takes none. `where`
// names the manifest in a refusal: one that is not JSON, or whose `packs` is not a list of names,
// is refused by a sentence saying which file and which field, since a bare SyntaxError names
// neither and a string of packs would otherwise be read one letter at a time.
/**
 * @param {string | null | undefined} text
 * @param {string} where
 * @returns {{ units: string; packs: string[] }}
 */
const packsOf = (text, where) => {
  /** @type {{ packs?: string[]; units?: string }} */
  let manifest = {};
  if (text) {
    try { manifest = JSON.parse(text); } catch (err) { throw new Error(`${where} is not JSON: ${(/** @type {Error} */ (err)).message}`); }
  }
  const packs = manifest.packs ?? [];
  if (!Array.isArray(packs) || !packs.every((p) => typeof p === "string" && p))
    throw new Error(`${where}: packs is ${JSON.stringify(packs)}, and it must be a list of pack names, such as ["software"]`);
  return { units: manifest.units ?? "meta", packs };
};

// A pack's files go into the schemas map under `<pack>/<file>`, beside the core's bare keys, the
// way the meta-model's own readInstance passes them, so the parser addresses its types
// `<pack>/<type>`.
/**
 * @param {Files} schemas
 * @param {string} pack
 * @param {Files} files
 */
const addPack = (schemas, pack, files) => {
  for (const [file, text] of files) schemas.set(`${pack}/${file}`, text);
};

// The schemas an instance is read against, given the directory of its core: the core's files,
// and the files of every pack the instance takes. The command lines take the core's directory and
// not the instance's root, so the root is found by walking up from the core to the first
// directory holding the manifest, and is believed only where the manifest's units put the core at
// exactly this directory. A core with no such instance around it, as the meta-model's own
// `core/` has none, is read alone, as it always was.
/**
 * @param {string} coreDir
 * @returns {Files}
 */
export function readSchemas(coreDir) {
  const schemas = readDir(coreDir);
  const core = path.resolve(coreDir);
  for (let dir = path.dirname(core); ; dir = path.dirname(dir)) {
    const manifest = path.join(dir, MANIFEST);
    if (fs.existsSync(manifest)) {
      const { units, packs } = packsOf(fs.readFileSync(manifest, "utf8"), manifest);
      if (path.resolve(dir, units, "core") !== core) break;
      for (const pack of packs) {
        const at = path.join(dir, units, pack);
        if (!fs.existsSync(at)) throw new Error(`${manifest} takes the pack ${pack}, and ${at} is not there`);
        addPack(schemas, pack, readDir(at));
      }
      return sorted(schemas);
    }
    if (path.dirname(dir) === dir) break;
  }
  return schemas;
}

// One commit's tree from GitHub, listed once by the trees API, and a reader of the blobs under any
// part of it, each fetched as a raw file, a small pool of these in flight at once rather than one
// at a time. No tarball, nothing to untar. A token is sent when given and never printed.
const BLOB_CONCURRENCY = 8;
/** @param {string} sub */
const slashed = (sub) => (sub && !sub.endsWith("/") ? sub + "/" : sub);

/** @param {{ repo: string; commit: string; token: string | undefined; fetch: typeof globalThis.fetch }} source */
async function treeOf({ repo, commit, token, fetch }) {
  /** @type {Record<string, string>} */
  const headers = { "user-agent": "companygraph-mcp-server" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`, { headers });
  if (!res.ok) throw new Error(`trees API for ${repo}@${commit}: HTTP ${res.status}`);
  const { tree, truncated } = /** @type {{ tree: { type: string; path: string }[]; truncated?: boolean }} */ (await res.json());
  if (truncated) throw new Error(`trees API truncated the listing of ${repo}@${commit}`);
  const blobs = tree.filter((e) => e.type === "blob").map((e) => e.path);
  // Every file under `sub`, keyed relative to it. A picture beside a page is left out here as in
  // readDir, and not fetched at all.
  /** @param {string} p */
  const get = async (p) => {
    const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${p}`, { headers });
    if (!raw.ok) throw new Error(`${p}: HTTP ${raw.status}`);
    return raw.text();
  };
  /** @param {string} sub */
  const under = async (sub) => {
    const paths = blobs.filter((p) => p.startsWith(sub) && !IMAGE_FILE.test(p));
    /** @type {Files} */
    const files = new Map();
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const p = paths[next++];
        files.set(p.slice(sub.length), await get(p));
      }
    };
    await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, paths.length) }, worker));
    return sorted(files);
  };
  // A single file, or null where the commit has none at that path.
  /** @param {string} p */
  const file = (p) => (blobs.includes(p) ? get(p) : null);
  return { file, under, hasUnder: (/** @type {string} */ sub) => blobs.some((p) => p.startsWith(sub)) };
}

// One commit's worth of files under `sub`, from GitHub.
/**
 * @param {Source & { sub: string }} source
 * @returns {Promise<Files>}
 */
export async function readGitHub({ repo, commit, sub, token = process.env.GITHUB_TOKEN, fetch = globalThis.fetch }) {
  return (await treeOf({ repo, commit, token, fetch })).under(slashed(sub));
}

// The schemas a commit's instance is read against, from GitHub: the core under `core`, and every
// pack the commit's manifest names at `<units>/<pack>/`, as readSchemas reads them from a
// directory. The repository's root is the instance's here, so its manifest is read where it sits,
// and is believed, as there, only where its units put the core at the `core` read; a core read
// from anywhere else is read alone.
/**
 * @param {Source & { core: string }} source
 * @returns {Promise<Files>}
 */
export async function readGitHubSchemas({ repo, commit, core, token = process.env.GITHUB_TOKEN, fetch = globalThis.fetch }) {
  const tree = await treeOf({ repo, commit, token, fetch });
  const [schemas, manifest] = await Promise.all([tree.under(slashed(core)), tree.file(MANIFEST)]);
  const { units, packs } = packsOf(manifest, `${repo}@${commit}:${MANIFEST}`);
  if (slashed(core) !== `${slashed(units)}core/`) return schemas;
  for (const pack of packs) {
    const at = `${slashed(units)}${pack}/`;
    if (!tree.hasUnder(at)) throw new Error(`${repo}@${commit} takes the pack ${pack}, and ${at} is not in that commit`);
    addPack(schemas, pack, await tree.under(at));
  }
  return sorted(schemas);
}

