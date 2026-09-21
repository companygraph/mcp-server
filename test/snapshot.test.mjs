import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseInstance } from "companygraph-meta-model/instance";
import { buildSnapshot, parserTag } from "../lib/snapshot.mjs";
import { exampleFiles, exampleSnapshot, COMMIT, EXAMPLE_CORE, PARSER, EXAMPLE_TYPES } from "./helpers.mjs";

test("the snapshot is the parser's graph plus provenance, schemas and source text", () => {
  const s = exampleSnapshot();
  const { files, schemas } = exampleFiles();
  const graph = parseInstance(files, { sub: "example/model/", schemas });
  assert.equal(s.commit, COMMIT);
  assert.equal(s.repo, "companygraph/meta-model");
  assert.deepEqual(s.core, { version: EXAMPLE_CORE, parser: PARSER, path: "core/" });
  assert.equal(s.root, graph.root);
  assert.equal(s.rootId, graph.rootId);
  assert.equal(s.entities.length, graph.entities.length);
  assert.equal(s.edges.length, graph.edges.length);
  assert.deepEqual(s.edges, graph.edges);
  assert.deepEqual(s.types, graph.types);
  assert.equal(s.schemas.length, EXAMPLE_TYPES);
  assert.ok(s.schemas.every((x) => x.id.startsWith("core/")));
  for (const e of s.entities) {
    assert.equal(e.markdown, files.get(e.path.slice("example/model/".length)));
    assert.match(e.markdown, /^(---|# )/);
  }
});

test("a sub with no trailing slash reads the same snapshot as one with it", () => {
  const { files, schemas } = exampleFiles();
  const slash = buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  const bare = buildSnapshot({ files, schemas, sub: "example/model", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
  assert.deepEqual(bare.entities, slash.entities);
  assert.deepEqual(bare.edges, slash.edges);
});

test("a core without a manifest is refused", () => {
  const { files, schemas } = exampleFiles();
  const bare = new Map([...schemas].filter(([k]) => k !== "manifest.json"));
  assert.throws(() => buildSnapshot({ files, schemas: bare, sub: "example/model/", parserTag: "v0" }), /manifest\.json/);
});

test("parserTag is the tag package.json pins", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(parserTag(), pkg.dependencies["companygraph-meta-model"].split("#")[1]);
});
