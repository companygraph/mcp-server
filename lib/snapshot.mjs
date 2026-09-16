// One instance, parsed once, into the document the server serves. The parser is the
// meta-model's own and is imported, never copied: an instance is read against the schemas it
// vendors, at the commit it is read from, and the result is the parser's graph untouched, plus
// where it came from and each entity's page as written.
import fs from "node:fs";
import { parseInstance, parseSchemas } from "companygraph-meta-model/instance";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// The parser's release is a fact about every answer, so it is read from the pin rather than typed.
export function parserTag() {
  return pkg.dependencies["companygraph-meta-model"].split("#")[1];
}

export function buildSnapshot({ files, schemas, sub = "", commit = null, repo = null, parserTag: tag = parserTag() }) {
  const manifest = schemas.get("manifest.json");
  if (!manifest) throw new Error("the core carries no manifest.json, so its version cannot be reported");
  const { version } = JSON.parse(manifest);
  const graph = parseInstance(files, { sub, schemas });
  const entities = graph.entities.map((e) => ({ ...e, markdown: files.get(e.path.slice(sub.length)) }));
  return {
    commit, repo,
    core: { version, parser: tag },
    root: graph.root, rootId: graph.rootId,
    types: graph.types,
    schemas: parseSchemas(schemas).entities,
    entities,
    edges: graph.edges,
  };
}
