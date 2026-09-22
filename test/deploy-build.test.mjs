import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonld, serverJson } from "../deploy/build/index.mjs";
import { exampleSnapshot, instanceSnapshot, withSharedName } from "./helpers.mjs";

// The subject is read from the model: a profile carrying the identity's own name is a company
// of one, whose company and person are one name, and the subject is that person.
test("the subject is a Person where a profile shares the identity's name", () => {
  const s = instanceSnapshot();
  const repo = String(s.entities.find((e) => e.type === "surface" && /MCP server/.test(e.name))?.fields["built-by"] ?? "");
  const g = jsonld(s, { repository: repo.split("/").slice(-2).join("/") });
  assert.ok(g, "the reference instance names its MCP surface");
  assert.equal(g["@graph"].find((n) => n["@type"] === "Person")?.name, s.root);
  assert.ok(!g["@graph"].some((n) => n["@type"] === "Organization"));
});

test("the subject is an Organization otherwise, and nothing is written without a surface", () => {
  const s = exampleSnapshot();
  assert.equal(jsonld(s, { repository: "companygraph/mcp-nowhere" }), null, "no surface names this repository");
});

test("an Organization is named by the identity and addressed by its Also at", () => {
  const s = exampleSnapshot();
  // A surface for this repository, added the way a deployment's model would carry one.
  const withSurface = structuredClone(s);
  withSurface.entities.push({ type: "surface", id: "surfaces/mcp-example", name: "Example MCP server", tagline: "An example.",
    fields: { url: "https://mcp.example.test", "built-by": "https://github.com/example/mcp-example", production: "built" }, sections: [] });
  const g = jsonld(withSurface, { repository: "example/mcp-example" });
  const org = g["@graph"].find((n) => n["@type"] === "Organization");
  assert.equal(org.name, s.root);
  assert.equal(org["@id"], "https://mcp.example.test/#organization");
  assert.equal(g["@graph"].find((n) => n["@type"] === "WebAPI").provider["@id"], org["@id"]);
});

test("the registry entry is the deployment's name and host, and refuses a long description", () => {
  const s = instanceSnapshot();
  const j = serverJson(s, { name: "ch.example/model", url: "https://mcp.example.test/mcp" }, "1.2.3");
  assert.equal(j.name, "ch.example/model");
  assert.equal(j.title, s.root);
  assert.deepEqual(j.remotes, [{ type: "streamable-http", url: "https://mcp.example.test/mcp" }]);
  assert.throws(() => serverJson({ ...s, root: "x".repeat(90) }, { name: "a/b", url: "https://x/mcp" }, "1"), /100/);
});

// The person's picture, where the profile carries one: the address get_entity serves, so a
// crawler and a client are told the same file. Read from a core that declares the field; the
// instance fixture's core predates it, and a picture named there is a fact its schema does not
// declare, so nothing is written for it.
test("a Person carries image where the profile names a picture, and nothing where it does not", () => {
  const surface = (s, repository) => {
    const t = structuredClone(s);
    t.entities.push({ type: "surface", id: "surfaces/mcp-example", name: "Example MCP server", tagline: "An example.",
      fields: { url: "https://mcp.example.test", "built-by": `https://github.com/${repository}`, production: "built" }, sections: [] });
    return t;
  };
  const shared = surface(withSharedName(), "example/mcp-example");
  // A person is addressed by an Also at, which the shared-name profile does not carry.
  shared.entities.find((e) => e.type === "profile" && e.name === shared.root).sections.push(
    { heading: "Also at", text: "", tables: [{ caption: null, columns: ["Where", "URL"], rows: [["GitHub", "https://github.com/beacon"]] }] });
  const bare = jsonld(shared, { repository: "example/mcp-example" })["@graph"].find((n) => n["@type"] === "Person");
  assert.ok(bare && !("image" in bare), "the profile names no picture");
  const profile = shared.entities.find((e) => e.type === "profile" && e.name === shared.root);
  profile.fields.image = "beacon.png";
  const person = jsonld(shared, { repository: "example/mcp-example" })["@graph"].find((n) => n["@type"] === "Person");
  assert.equal(person.image, `https://beacon.example/images/${profile.id}.png`);
});
