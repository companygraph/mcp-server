import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
export const fixtureRoot = path.join(fixtures, "meta-model");
export const instanceRoot = path.join(fixtures, "mental-model");
// The reference instance the suite runs against, pinned here as test data: 143 entities, 608
// edges, core 0.25.2 vendored, and an identity and a profile that share one name.
export const INSTANCE_COMMIT = "2fd146fe669ef80f7d7b8090ad1cf533b9020ebc";
