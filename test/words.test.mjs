// A query and an entity are compared word by word, so both are cut into words the same way and
// each word is reduced to what English inflection leaves alone. The tokenizer is held first, then
// the stemmer, on the pairs the spec names and on the limits it states.
import { test } from "node:test";
import assert from "node:assert/strict";
import { words, stems } from "../lib/words.mjs";

test("a word is a maximal run of letters and digits, lowered, with diacritics folded", () => {
  assert.deepEqual(words("Zürich"), ["zurich"]);
  assert.deepEqual(words("domain-driven design"), ["domain", "driven", "design"]);
  assert.deepEqual(words("Deciding well over build fast."), ["deciding", "well", "over", "build", "fast"]);
  assert.deepEqual(words("R14, core 0.31.0 — 16,000 events"), ["r14", "core", "0", "31", "0", "16", "000", "events"]);
  assert.deepEqual(words("the company's vision, the owners’ plan, IT'S"), ["the", "company", "vision", "the", "owners", "plan", "it"], "a possessive is its noun");
  assert.deepEqual(words("s corporation, R&S"), ["s", "corporation", "r", "s"], "a bare s that is no possessive stays");
  assert.deepEqual(words("  …  ---  "), []);
  assert.deepEqual(words(""), []);
  assert.deepEqual(words(null), []);
  assert.deepEqual(words(undefined), []);
});

test("stems keep the words' order and count", () => {
  assert.deepEqual(stems("Deciding well over build fast"), ["decid", "well", "over", "build", "fast"]);
  assert.deepEqual(stems("validated validation validate"), ["valid", "valid", "valid"]);
  assert.deepEqual(stems(""), []);
});

// The pairs the spec names, verified against the reference vocabulary before this was written.
// Inflections of one word meet; a word's relatives do not, and the tests say so rather than hide it.
const stemOf = (word) => stems(word)[0];

test("inflections of one word meet at one stem", () => {
  for (const [a, b] of [["validated", "validation"], ["validation", "validate"], ["deciding", "decide"], ["decide", "decided"], ["ideas", "idea"], ["building", "build"], ["agreed", "agree"], ["ponies", "poni"], ["caresses", "caress"], ["hopping", "hop"], ["relational", "relate"], ["happiness", "happy"]])
    assert.equal(stemOf(a), stemOf(b), `${a} and ${b}`);
});

test("a word's relatives do not meet, and the limit is stated rather than hidden", () => {
  for (const [a, b] of [["decision", "decide"], ["built", "build"], ["built", "building"]])
    assert.notEqual(stemOf(a), stemOf(b), `${a} and ${b}`);
});

test("the paper's own examples, run through the whole algorithm", () => {
  for (const [word, expected] of [["caresses", "caress"], ["ponies", "poni"], ["ties", "ti"], ["caress", "caress"], ["cats", "cat"], ["feed", "feed"], ["agreed", "agre"], ["plastered", "plaster"], ["bled", "bled"], ["motoring", "motor"], ["sing", "sing"], ["conflated", "conflat"], ["troubled", "troubl"], ["sized", "size"], ["hopping", "hop"], ["tanned", "tan"], ["falling", "fall"], ["hissing", "hiss"], ["fizzed", "fizz"], ["failing", "fail"], ["filing", "file"], ["happy", "happi"], ["sky", "sky"], ["relational", "relat"], ["conditional", "condit"], ["rational", "ration"], ["valenci", "valenc"], ["hesitanci", "hesit"], ["digitizer", "digit"], ["conformabli", "conform"], ["radicalli", "radic"], ["differentli", "differ"], ["vileli", "vile"], ["analogousli", "analog"], ["vietnamization", "vietnam"], ["predication", "predic"], ["operator", "oper"], ["feudalism", "feudal"], ["decisiveness", "decis"], ["hopefulness", "hope"], ["callousness", "callous"], ["formaliti", "formal"], ["sensitiviti", "sensit"], ["sensibiliti", "sensibl"], ["triplicate", "triplic"], ["formative", "form"], ["formalize", "formal"], ["electriciti", "electr"], ["electrical", "electr"], ["hopeful", "hope"], ["goodness", "good"], ["revival", "reviv"], ["allowance", "allow"], ["inference", "infer"], ["airliner", "airlin"], ["gyroscopic", "gyroscop"], ["adjustable", "adjust"], ["defensible", "defens"], ["irritant", "irrit"], ["replacement", "replac"], ["adjustment", "adjust"], ["dependent", "depend"], ["adoption", "adopt"], ["homologou", "homolog"], ["communism", "commun"], ["activate", "activ"], ["angulariti", "angular"], ["homologous", "homolog"], ["effective", "effect"], ["bowdlerize", "bowdler"], ["probate", "probat"], ["rate", "rate"], ["cease", "ceas"], ["controll", "control"], ["roll", "roll"]])
    assert.equal(stemOf(word), expected, word);
});

// The query side is a stranger's text on a public endpoint, so the stemmer's cost is bounded by
// the word's length and not by its shape: a run of y's, each decided by the letter before it, is
// the case that a per-letter look-back made quadratic and deep enough to overflow.
test("a run of y is stemmed in time linear in its length, and never overflows", () => {
  const start = performance.now();
  let out;
  assert.doesNotThrow(() => { out = stems("y".repeat(20000) + "ational"); });
  assert.equal(out.length, 1);
  assert.ok(performance.now() - start < 1000, "twenty thousand y's stem within a second");
});

test("a compatibility character that decomposes to a capital is lowered after it decomposes", () => {
  assert.deepEqual(words("𝔸bc"), ["abc"]);
});
