// The registry entry, written from the model rather than by hand: the title is the identity's
// H1, the description is the identity's H1 and the vision's H1, and the version is the tag the
// command passes. The registry caps a description at 100 characters and the build fails rather
// than truncates, because a truncated sentence is a claim nobody made.
export function serverJson(snapshot, { name, url }, version) {
  const vision = snapshot.entities.find((e) => e.type === "vision");
  if (!vision) throw new Error("the model has no vision entity to write the description from");
  const description = `${snapshot.root}: ${vision.name}`;
  if (description.length > 100) throw new Error(`description is ${description.length} characters; the registry allows 100`);
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name,
    title: snapshot.root,
    description,
    version,
    remotes: [{ type: "streamable-http", url }],
  };
}
