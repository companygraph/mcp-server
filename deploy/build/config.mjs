// A deployment's own values and its model pin, read from the directory the command runs in.
import fs from "node:fs";
import path from "node:path";
export const ROOT = process.cwd();
export const DIST = path.join(ROOT, "dist");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
export const source = () => read("source.json");
export const deployment = () => read("deployment.json");
export const snapshot = () => JSON.parse(fs.readFileSync(path.join(DIST, "snapshot.json"), "utf8"));
