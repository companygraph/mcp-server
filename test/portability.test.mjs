import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exampleSnapshot, instanceSnapshot } from "./helpers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["lib", "bin"].flatMap((d) => fs.readdirSync(path.join(root, d)).map((f) => path.join(d, f)));

test("lib/ and bin/ name no entity of the example and no fact of the reference instance", () => {
  const names = (snap) => snap.entities.map((e) => e.name).filter((n) => n.length > 3);
  const forbidden = [...names(exampleSnapshot()), ...names(instanceSnapshot()), "blust.ch", "mental-model"];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const word of forbidden) assert.ok(!text.includes(word), `${file} names "${word}"`);
  }
});
