// The build's two pure functions, for a deployment's own tests and for anything else that wants
// to check what the build would write without running the command.
export { jsonld } from "./jsonld.mjs";
export { serverJson } from "./server-json.mjs";
