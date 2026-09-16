// The one place this package touches a filesystem or the network. Everything below it takes a
// Map(path → text), the shape the meta-model's parser reads, so the parser and the queries can
// be fed fixtures in tests.
import fs from "node:fs";
import path from "node:path";

// A directory as the parser wants it: keys relative to the root, forward slashes, sorted.
export function readDir(root) {
  const files = new Map();
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else files.set(path.relative(root, p).split(path.sep).join("/"), fs.readFileSync(p, "utf8"));
    }
  };
  walk(root);
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// One commit's worth of files under `sub`, from GitHub: the trees API for the listing, then
// each file under it as a raw blob, a small pool of these in flight at once rather than one at
// a time. No tarball, nothing to untar. A token is sent when given and never printed.
const BLOB_CONCURRENCY = 8;

export async function readGitHub({ repo, commit, sub, token = process.env.GITHUB_TOKEN, fetch = globalThis.fetch }) {
  sub = sub && !sub.endsWith("/") ? sub + "/" : sub;
  const headers = { "user-agent": "companygraph-mcp-server" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`, { headers });
  if (!res.ok) throw new Error(`trees API for ${repo}@${commit}: HTTP ${res.status}`);
  const { tree, truncated } = await res.json();
  if (truncated) throw new Error(`trees API truncated the listing of ${repo}@${commit}`);
  const blobs = tree.filter((e) => e.type === "blob" && e.path.startsWith(sub));
  const files = new Map();
  let next = 0;
  const worker = async () => {
    while (next < blobs.length) {
      const e = blobs[next++];
      const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${e.path}`, { headers });
      if (!raw.ok) throw new Error(`${e.path}: HTTP ${raw.status}`);
      files.set(e.path.slice(sub.length), await raw.text());
    }
  };
  await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, blobs.length) }, worker));
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}
