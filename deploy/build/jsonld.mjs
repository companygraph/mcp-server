// The structured data a deployment's landing page shows, derived from the model it serves.
//
// A surface entity names the unit the page describes to a crawler: the subject and the endpoint,
// with the subject's addresses from its own `## Also at`. Nothing here is typed that the
// snapshot does not hold, for the same reason nothing on the page is: a fact written beside the
// model is a fact that can disagree with it.
//
// The family settled how a sibling carries the subject, and this follows it rather than
// reopening it. A sibling cannot merely reference another surface's `{"@id": …}`: a bare
// pointer has to resolve inside the same document, and a crawler reads a graph per document. So
// each surface defines its own copy and keeps it minimal — `@id`, `@type`, `name`, `url` and the
// addresses — so that two copies cannot say different things about the same subject beyond what
// they both hold.
//
// The endpoint is a `WebAPI`, which is what this surface is and what no other surface in the
// family has. Its `@id` is this host's, not the identity's, because it is this host's thing.
export function jsonld(snapshot, { repository }) {
  const byId = (id) => snapshot.entities.find((e) => e.id === id);
  const identity = byId(snapshot.rootId);
  if (!identity) throw new Error("the snapshot names no identity");
  // The surface entity says where this is published, so the addresses come from the model rather
  // than from a constant here. A surface whose url the model does not hold, or one this
  // repository is not the `built-by` of, is a surface this function cannot describe.
  const surface = snapshot.entities.find((e) => e.type === "surface"
    && String(e.fields?.["built-by"] ?? "").endsWith(`/${repository}`) && e.name.includes("MCP server"));
  if (!surface) return null;
  if (!surface.fields?.url) throw new Error("the model names no url for this surface");
  const origin = surface.fields.url.replace(/\/$/, "");
  // The schema says a surface's url is where it is published, and for this one that is the
  // host. A url carrying a path is a pin left behind a model that has moved, and every address
  // below would be built on it — so it stops here rather than shipping `/mcp/mcp` to a crawler.
  if (new URL(origin).pathname !== "/")
    throw new Error(`the surface's url is ${origin}, which carries a path: this reads it as the host`);
  // A company of one: a profile carrying the identity's own name is the person the company is.
  const profile = snapshot.entities.find((e) => e.type === "profile" && e.name === snapshot.root);
  const holder = profile ?? identity;
  const alsoAt = holder.sections?.find((s) => s.heading === "Also at")?.tables?.[0];
  // Neither this host nor the subject's own url: `url` already carries the second, and a
  // `sameAs` repeating it says the subject is also themselves.
  const home = identity.fields.url?.replace(/\/$/, "");
  const sameAs = (alsoAt?.rows ?? []).map((r) => r[alsoAt.columns.indexOf("URL")])
    .filter((u) => u && !u.startsWith(origin) && u.replace(/\/$/, "") !== home);
  if (!sameAs.length) throw new Error(`the ${profile ? "profile" : "identity"}'s Also at holds no address`);
  const kind = profile ? "Person" : "Organization";
  const subjectId = `${origin}/#${kind.toLowerCase()}`;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": kind, "@id": subjectId, name: identity.name, url: identity.fields.url, sameAs },
    { "@type": "WebAPI", "@id": `${origin}/#api`, name: surface.name, description: surface.tagline,
      url: `${origin}/mcp`, documentation: `${origin}/`, provider: { "@id": subjectId }, about: { "@id": subjectId } },
  ] };
}
