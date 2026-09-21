// The interface document's examples are what the server answers, not what someone remembers it
// answering: a script writes them from the worked example and this holds the committed file to
// the script. CI checks the committed copy and never writes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { render, EXAMPLES } from "../scripts/interface.mjs";
import { TOOLS } from "../lib/tools.mjs";
import { CODES } from "../lib/errors.mjs";

const file = new URL("../docs/INTERFACE.md", import.meta.url);
const text = fs.readFileSync(file, "utf8");

test("the committed examples are what the server answers; run `npm run interface` when they differ", async () => {
  assert.equal(await render(text), text);
});

test("every tool has a section with an example, and every error code a row", () => {
  for (const t of TOOLS) {
    assert.ok(text.includes(`### \`${t.name}\`\n`), `${t.name} has no section`);
    assert.ok(`\`${t.name}\`` in EXAMPLES, `${t.name} has no example call`);
  }
  for (const code of CODES) assert.ok(text.includes(`| \`${code}\` |`), `${code} has no row`);
});

test("an example is a real call: its answer is never an empty object", async () => {
  const blocks = [...(await render(text)).matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, Object.keys(EXAMPLES).length);
  for (const b of blocks) assert.ok(Object.keys(b.answer).length > 1, JSON.stringify(b.arguments));
});
