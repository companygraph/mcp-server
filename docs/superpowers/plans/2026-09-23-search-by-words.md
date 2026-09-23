# Search by words implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `search` gains `match: "words"`: every word of the query is reduced to its Porter stem and an entity is a result when every required stem occurs somewhere in it; the answer says what was searched for.

**Architecture:** One new pure module, `lib/words.mjs`, tokenizes and stems. `search` in `lib/model.mjs` gains a third branch that derives every entity's stems once per snapshot, in memory, and marks a stem held by more than half of the entities common. The output schema widens `match` and adds the optional `words` field, tied to the mode; the tool's enum and description, the interface document and the shared deployment tests follow.

**Tech Stack:** Node 22+, `node:test`, zod 4, `@modelcontextprotocol/client` for the contract tests, `companygraph-meta-model` (the parser, pinned by tag). No dependency is added.

**Spec:** `docs/superpowers/specs/2026-09-23-search-by-words-design.md` (this branch). Read it before any task.

## Global constraints

- **One repository, one branch.** The worktree exists: `~/git/companygraph/mcp-server-search-by-words`, branch `search-by-words`, carrying the spec and this plan; pull request #55 is open on it. The clone at `~/git/companygraph/mcp-server` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test`, which fetches the fixtures first and opens a browser for two page tests. `sh conventions/conventions-check` and `sh conventions/conventions-format` exit 0 before every commit.
- **The spec decides, and this plan does not reopen:** `text` stays the default, `name` is untouched, no stop list, no ranking, no typo tolerance, the order stays type then name then id, paging is unchanged, stems are never written into the snapshot file.
- **The tokenizer:** lowercase, NFKD with the combining marks removed, maximal runs of letters and digits. **The stemmer:** Porter's algorithm as published in 1980, with no dependency. **Common:** a stem in more than half of the instance's entities, reported and not required. **Refused:** a query with no words, as `invalid_argument` on `query`.
- **Stem pairs the tests hold:** validated, validation and validate meet; deciding, decide and decided meet and decision does not; ideas meets idea; building meets build and built meets neither.
- **The two headline cases are built fixtures** in the style of `withSharedName` in `test/helpers.mjs`, never the pinned reference instance.
- **The tool description stays within sixty words**; `test/descriptions.test.mjs` holds it.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The pull request body the same, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, deployed or deleted by an agent.** The last task pushes, updates #55's body and stops.
- **No count or version of something that still moves** in any prose or comment.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.

### Rulings the plan makes where the spec is silent

1. **"The 1980 one" is the algorithm as the paper states it.** The reference C code published later departs from the paper in three places: step 2 replaces `abli → able` with `bli → ble` and adds `logi → log`, and a word of one or two letters is returned unstemmed. None of the three is in the paper, so none is taken; the cross-check in Task 2 counts every difference from the reference output and holds each to one of the three. The pull request says so and asks, since the spec did not foresee the choice.
2. **A query whose stems are all common is held to all of them**, as §2 says: the required set is every distinct stem of the query when no stem is required, and the required ones otherwise.
3. **The per-snapshot stems live in a `WeakMap` keyed by the snapshot object.** Nothing is attached to the snapshot itself, so a snapshot written to a file after a `words` search carries nothing it did not before, which is §3's rule stated once in code.
4. **Duplicated words in a query appear twice in `words`**, in the query's order, because the field says what the server read.
5. **`matched` in `words` mode names each place where at least one required stem occurs**, in the order the other modes use: name, tagline, fields, then each section's text and table.
6. **The version moves in this branch,** to `0.26.0`, the next minor after `main`'s `0.25.0`, by the owner's instruction; the release notes are drafted in the pull request body for the day of tagging and carry one line saying the interface gains and breaks nothing.

---

### Task 0: A working tree that passes

**Files:** none changed.

- [ ] **Step 1: Install and fetch fixtures**

```sh
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/companygraph/mcp-server-search-by-words
git config user.email
npm ci
```

Expected: the address is `robert.blust@flatland.ch`; `npm ci` exits 0.

- [ ] **Step 2: Run the suite as the baseline**

Run: `npm test; echo "exit $?"`

Expected: `exit 0`. A failure that remains is reported before any task starts; it is not worked around.

- [ ] **Step 3: Commit this plan**

```sh
sh conventions/conventions-format; echo "exit $?"
git add docs/superpowers/plans/2026-09-23-search-by-words.md
git commit
```

Message subject: `The plan for the words mode`. Body: one paragraph saying the plan builds the spec task by task, test first, and where it stops; a `Verified:` line naming conventions-format; the trailer.

---

### Task 1: The tokenizer

**Files:**

- Create: `lib/words.mjs`
- Test: `test/words.test.mjs`

**Interfaces:**

- Produces: `words(text) → string[]`, the tokens of `text` after lowercasing, NFKD normalization with combining marks removed, split on anything but letters and digits; `stems(text) → string[]`, the Porter stem of each token in order. Both take `null` and `undefined` as the empty string. Nothing else is exported.

- [ ] **Step 1: Write the failing tokenizer tests**

Create `test/words.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/words.test.mjs; echo "exit $?"`

Expected: exit 1, `Cannot find module '../lib/words.mjs'`.

- [ ] **Step 3: Write the tokenizer, with the stemmer as identity for now**

Create `lib/words.mjs`:

```js
// A search by words compares a query to an entity one word at a time, so both are cut into words
// the same way: lowered, the diacritics folded so that a visitor's "zurich" meets the model's
// "Zürich", and split on anything that is not a letter or a digit, so that "domain-driven" is the
// two words it is. Each word is then reduced to its stem by Porter's algorithm, the one published
// in 1980, implemented here so that two deployments at one release give one answer and no
// dependency decides what a word becomes. English, because R14 makes every instance's names and
// prose American English; a visitor's German is the client's to translate before it asks.

export function words(text) {
  const folded = String(text ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  return folded.match(/[\p{L}\p{N}]+/gu) ?? [];
}

const stem = (word) => word;

export function stems(text) {
  return words(text).map(stem);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/words.test.mjs; echo "exit $?"`

Expected: the tokenizer test passes; the stems test fails on `decid` and `valid`. Exit 1. The failure is the next task's.

No commit yet: the module is not what its comment says until the stemmer is in.

---

### Task 2: Porter's algorithm

**Files:**

- Modify: `lib/words.mjs` (replace the identity `stem`)
- Modify: `test/words.test.mjs` (the pairs)

**Interfaces:**

- Produces: the same two exports; `stems` now reduces each token by Porter's five steps.

- [ ] **Step 1: Add the failing pair tests**

Append to `test/words.test.mjs`:

```js
// The pairs the spec names, verified against the reference vocabulary before this was written.
// Inflections of one word meet; a word's relatives do not, and the tests say so rather than hide it.
const stemOf = (word) => stems(word)[0];

test("inflections of one word meet at one stem", () => {
  for (const [a, b] of [["validated", "validation"], ["validation", "validate"], ["deciding", "decide"], ["decide", "decided"], ["ideas", "idea"], ["building", "build"], ["agreed", "agree"], ["ponies", "poni"], ["caresses", "caress"], ["hopping", "hop"], ["relational", "relate"], ["happiness", "happi"]])
    assert.equal(stemOf(a), stemOf(b), `${a} and ${b}`);
});

test("a word's relatives do not meet, and the limit is stated rather than hidden", () => {
  for (const [a, b] of [["decision", "decide"], ["built", "build"], ["built", "building"]])
    assert.notEqual(stemOf(a), stemOf(b), `${a} and ${b}`);
});

test("the stems the paper gives its own examples", () => {
  for (const [word, expected] of [["caresses", "caress"], ["ponies", "poni"], ["ties", "ti"], ["caress", "caress"], ["cats", "cat"], ["feed", "feed"], ["agreed", "agre"], ["plastered", "plaster"], ["bled", "bled"], ["motoring", "motor"], ["sing", "sing"], ["conflated", "conflat"], ["troubled", "troubl"], ["sized", "size"], ["hopping", "hop"], ["tanned", "tan"], ["falling", "fall"], ["hissing", "hiss"], ["fizzed", "fizz"], ["failing", "fail"], ["filing", "file"], ["happy", "happi"], ["sky", "sky"], ["relational", "relat"], ["conditional", "condit"], ["rational", "ration"], ["valenci", "valenc"], ["hesitanci", "hesit"], ["digitizer", "digit"], ["conformabli", "conform"], ["radicalli", "radic"], ["differentli", "differ"], ["vileli", "vile"], ["analogousli", "analog"], ["vietnamization", "vietnam"], ["predication", "predic"], ["operator", "oper"], ["feudalism", "feudal"], ["decisiveness", "decis"], ["hopefulness", "hope"], ["callousness", "callous"], ["formaliti", "formal"], ["sensitiviti", "sensit"], ["sensibiliti", "sensibl"], ["triplicate", "triplic"], ["formative", "form"], ["formalize", "formal"], ["electriciti", "electr"], ["electrical", "electr"], ["hopeful", "hope"], ["goodness", "good"], ["revival", "reviv"], ["allowance", "allow"], ["inference", "infer"], ["airliner", "airlin"], ["gyroscopic", "gyroscop"], ["adjustable", "adjust"], ["defensible", "defens"], ["irritant", "irrit"], ["replacement", "replac"], ["adjustment", "adjust"], ["dependent", "depend"], ["adoption", "adopt"], ["homologou", "homolog"], ["communism", "commun"], ["activate", "activ"], ["angulariti", "angular"], ["homologous", "homolog"], ["effective", "effect"], ["bowdlerize", "bowdler"], ["probate", "probat"], ["rate", "rate"], ["cease", "ceas"], ["controll", "control"], ["roll", "roll"]])
    assert.equal(stemOf(word), expected, word);
});
```

The paper's own examples carry a subtlety: `agreed` is `agree` after step 1b and `agre` after step 5a, which the paper's step-by-step table shows only per step. The first list holds `agreed` and `agree` to one stem; the third holds the whole algorithm's output.

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/words.test.mjs; echo "exit $?"`

Expected: exit 1; the three new tests fail.

- [ ] **Step 3: Write the stemmer**

Replace `const stem = (word) => word;` in `lib/words.mjs` with:

```js
// Porter, M. F., "An algorithm for suffix stripping", Program 14(3), 1980. A consonant is any
// letter but a, e, i, o, u, and y where a consonant precedes it; the measure m counts a word's
// vowel-consonant sequences; each step tries its rules and obeys the one whose suffix is longest,
// applying it only where its condition on the remaining stem holds. Nothing here is a departure
// from the paper: the reference code's later ones, `bli` for `abli`, `logi`, and leaving a word of
// two letters alone, are not taken, so a reader of the paper reads this.
const isConsonant = (w, i) => {
  const c = w[i];
  if ("aeiou".includes(c)) return false;
  if (c === "y") return i === 0 ? true : !isConsonant(w, i - 1);
  return true;
};

const measure = (w) => {
  let m = 0, i = 0;
  while (i < w.length && isConsonant(w, i)) i++;
  while (i < w.length) {
    while (i < w.length && !isConsonant(w, i)) i++;
    if (i === w.length) break;
    m++;
    while (i < w.length && isConsonant(w, i)) i++;
  }
  return m;
};

const hasVowel = (w) => [...w].some((_, i) => !isConsonant(w, i));
const endsDouble = (w) => w.length >= 2 && w.at(-1) === w.at(-2) && isConsonant(w, w.length - 1);
// *o: the stem ends consonant, vowel, consonant, and the last is not w, x or y.
const endsCvc = (w) => w.length >= 3 && isConsonant(w, w.length - 1) && !isConsonant(w, w.length - 2) && isConsonant(w, w.length - 3) && !"wxy".includes(w.at(-1));

// One step: of the rules whose suffix the word ends in, the longest wins, and it fires only
// where its condition holds on what is left. `when` defaults to "always".
const step = (w, rules) => {
  let best = null;
  for (const r of rules) if (w.endsWith(r[0]) && (best === null || r[0].length > best[0].length)) best = r;
  if (best === null) return w;
  const [suffix, replacement, when = () => true] = best;
  const rest = w.slice(0, w.length - suffix.length);
  return when(rest) ? rest + replacement : w;
};

const m0 = (rest) => measure(rest) > 0;
const m1 = (rest) => measure(rest) > 1;

const STEP_1A = [["sses", "ss"], ["ies", "i"], ["ss", "ss"], ["s", ""]];
const STEP_2 = [["ational", "ate", m0], ["tional", "tion", m0], ["enci", "ence", m0], ["anci", "ance", m0], ["izer", "ize", m0], ["abli", "able", m0], ["alli", "al", m0], ["entli", "ent", m0], ["eli", "e", m0], ["ousli", "ous", m0], ["ization", "ize", m0], ["ation", "ate", m0], ["ator", "ate", m0], ["alism", "al", m0], ["iveness", "ive", m0], ["fulness", "ful", m0], ["ousness", "ous", m0], ["aliti", "al", m0], ["iviti", "ive", m0], ["biliti", "ble", m0]];
const STEP_3 = [["icate", "ic", m0], ["ative", "", m0], ["alize", "al", m0], ["iciti", "ic", m0], ["ical", "ic", m0], ["ful", "", m0], ["ness", "", m0]];
const STEP_4 = [["al", "", m1], ["ance", "", m1], ["ence", "", m1], ["er", "", m1], ["ic", "", m1], ["able", "", m1], ["ible", "", m1], ["ant", "", m1], ["ement", "", m1], ["ment", "", m1], ["ent", "", m1], ["ion", "", (rest) => m1(rest) && (rest.endsWith("s") || rest.endsWith("t"))], ["ou", "", m1], ["ism", "", m1], ["ate", "", m1], ["iti", "", m1], ["ous", "", m1], ["ive", "", m1], ["ize", "", m1]];

// Step 1b: after `ed` or `ing` came off, the stem is tidied: `at`, `bl` and `iz` regain their e,
// a doubled consonant that is not l, s or z is single, and a short stem that ends *o gains an e.
const step1b = (w) => {
  const eed = step(w, [["eed", "ee", m0]]);
  if (eed !== w || w.endsWith("eed")) return eed;
  const cut = step(w, [["ed", "", hasVowel], ["ing", "", hasVowel]]);
  if (cut === w) return w;
  if (cut.endsWith("at") || cut.endsWith("bl") || cut.endsWith("iz")) return cut + "e";
  if (endsDouble(cut) && !"lsz".includes(cut.at(-1))) return cut.slice(0, -1);
  if (measure(cut) === 1 && endsCvc(cut)) return cut + "e";
  return cut;
};

const step1c = (w) => (w.endsWith("y") && hasVowel(w.slice(0, -1)) ? w.slice(0, -1) + "i" : w);
const step5a = (w) => step(w, [["e", "", (rest) => measure(rest) > 1 || (measure(rest) === 1 && !endsCvc(rest))]]);
const step5b = (w) => (w.endsWith("ll") && measure(w) > 1 ? w.slice(0, -1) : w);

const stem = (word) => step5b(step5a(step(step(step(step1c(step1b(step(word, STEP_1A))), STEP_2), STEP_3), STEP_4)));
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/words.test.mjs; echo "exit $?"`

Expected: exit 0, every test passing.

- [ ] **Step 5: Cross-check against the reference vocabulary, in the scratchpad**

Porter's reference vocabulary and its expected output, `voc.txt` and `output.txt`, are in the scratchpad's `porter/` directory. Run, with the scratchpad path substituted:

```sh
node -e '
const fs = require("node:fs");
import("./lib/words.mjs").then(({ stems }) => {
  const dir = process.argv[1];
  const voc = fs.readFileSync(dir + "/voc.txt", "utf8").trim().split("\n");
  const out = fs.readFileSync(dir + "/output.txt", "utf8").trim().split("\n");
  const classes = { short: 0, abli: 0, logi: 0, other: [] };
  for (let i = 0; i < voc.length; i++) {
    const mine = stems(voc[i])[0] ?? "";
    if (mine === out[i]) continue;
    if (voc[i].length <= 2) classes.short++;
    else if (voc[i].includes("bli") || voc[i].includes("bly")) classes.abli++;
    else if (voc[i].includes("log")) classes.logi++;
    else classes.other.push([voc[i], mine, out[i]]);
  }
  console.log(voc.length, "words;", JSON.stringify({ short: classes.short, abli: classes.abli, logi: classes.logi, other: classes.other.length }));
  console.log(classes.other.slice(0, 20));
});' /private/tmp/…/scratchpad/porter
```

Expected: `other: 0`. Every difference from the reference output is one of the three departures of Ruling 1. A difference outside them is a bug in the stemmer and is fixed before anything is committed; the numbers go into the commit's `Verified:` line.

- [ ] **Step 6: Conventions and commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add lib/words.mjs test/words.test.mjs
git commit
```

Subject: `A word is cut and stemmed the same way wherever it stands`. Body: why one tokenizer and one stemmer, why the paper and not the reference code's departures, and the `Verified:` line naming the test file and the cross-check's counts.

---

### Task 3: The mode in the model and the schema

**Files:**

- Modify: `lib/model.mjs` (the `search` function and its comment)
- Modify: `lib/schemas.mjs` (`OUTPUTS.search`)
- Test: `test/search.test.mjs`

**Interfaces:**

- Consumes: `words`, `stems` from `lib/words.mjs`.
- Produces: `search(s, query, { match: "words", … })` answering `{ query, match: "words", words: [{ word, stem, common }], results, page, model }`; `OUTPUTS.search` accepting `match` in `text`, `name`, `words` and `words` present exactly when `match` is `words`.

- [ ] **Step 1: Write the failing tests**

Append to `test/search.test.mjs`, after the imports add `import { OUTPUTS } from "../lib/schemas.mjs";`, `import { buildSnapshot } from "../lib/snapshot.mjs";` and `import { exampleFiles, COMMIT, PARSER } from "./helpers.mjs";` (merge with the existing helpers import), then:

```js
// The two headlines the owner put to the chat, on a fixture built the way withSharedName builds
// its own, so the case waits on no re-pin of the reference instance. The example's words are
// counted: "in" and "open" fall short of half of its entities and are required, so both
// experiences carry them, and only one carries "ideas".
function withHeadlines() {
  const { files, schemas } = exampleFiles();
  files.set("values/decide-well-over-build-fast.md", "---\nsource: Local\n---\n\n# Decide well over build fast\n\n> A choice made once beats a feature shipped twice.\n\n## In practice\n\nWe write the decision down before the code.\n");
  files.set("profiles/nils-aker/nils-aker.md", "---\nsource: Local\nnature: human\n---\n\n# Nils Aker\n\n> Deciding well is the whole job.\n\n## Summary\n\nOne person.\n");
  files.set("profiles/nils-aker/experiences/2024-open-review.md", "---\nsource: Local\nkind: Role\nstart: 2024-01\n---\n\n# The open review\n\n> A year of reviews held where anyone could read them.\n\n## Achievements\n\n### Decisions\n\n- Put the validation of every number in front of the customer.\n\n### Results\n\n- Held the review in the open, on the list.\n- Two ideas from the list shipped.\n");
  files.set("profiles/nils-aker/experiences/2025-closed-review.md", "---\nsource: Local\nkind: Role\nstart: 2025-01\n---\n\n# The closed review\n\n> A year of reviews held in one room.\n\n## Achievements\n\n### Decisions\n\n- Put the validation of every number in front of the customer.\n\n### Results\n\n- Held the review in the open, on the list.\n");
  return buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER });
}

// The boundary of common: the example's entities plus two more than their number, every added
// one holding "florp" and all but one of them "glorp", so florp stands in more than half of the
// whole and glorp in exactly half.
function withBoundary() {
  const { files, schemas } = exampleFiles();
  const n = exampleSnapshot().entities.length;
  for (let i = 0; i < n + 2; i++)
    files.set(`skills/boundary-${i}.md`, `---\nsource: Local\n---\n\n# Boundary ${i}\n\n> florp${i < n + 1 ? " glorp" : ""}.\n\n## In practice\n\nNothing.\n`);
  return { snapshot: buildSnapshot({ files, schemas, sub: "example/model/", commit: COMMIT, repo: "companygraph/meta-model", parserTag: PARSER }), added: n + 2 };
}

test("Deciding well finds the value Decide well over build fast and the profile whose tagline says it", () => {
  const r = search(withHeadlines(), "Deciding well", { match: "words" });
  assert.equal(r.match, "words");
  assert.deepEqual(r.words, [{ word: "deciding", stem: "decid", common: false }, { word: "well", stem: "well", common: false }]);
  const value = r.results.find((x) => x.id === "values/decide-well-over-build-fast");
  const profile = r.results.find((x) => x.id === "profiles/nils-aker");
  assert.deepEqual(value.matched, [{ where: "name", key: null }]);
  assert.deepEqual(profile.matched, [{ where: "tagline", key: null }]);
  assert.equal(search(exampleSnapshot(), "Deciding well").results.length, 0, "the substring finds neither");
});

test("validated in the open finds the experience whose bullets hold validation, open and ideas, and not the one short of ideas", () => {
  const r = search(withHeadlines(), "validated in the open ideas", { match: "words" });
  assert.deepEqual(r.words.map((w) => [w.word, w.stem]), [["validated", "valid"], ["in", "in"], ["the", "the"], ["open", "open"], ["ideas", "idea"]]);
  assert.deepEqual(r.words.map((w) => w.common), [false, false, true, false, false]);
  assert.deepEqual(r.results.map((x) => x.id), ["profiles/nils-aker/experiences/2024-open-review"]);
  assert.deepEqual(r.results[0].matched, [{ where: "section", key: "Achievements" }]);
});

test("a query whose stems occur nowhere is an empty page in words mode too", () => {
  const none = search(s, "zzzz qqqq", { match: "words" });
  assert.deepEqual([none.results, none.page], [[], { total: 0, returned: 0, hasMore: false, nextCursor: null }]);
  assert.deepEqual(none.words.map((w) => w.common), [false, false]);
});

test("a stem in more than half of the entities is common and not required; one in exactly half is required", () => {
  const { snapshot, added } = withBoundary();
  const both = search(snapshot, "florp glorp", { match: "words", limit: 200 });
  assert.deepEqual(both.words, [{ word: "florp", stem: "florp", common: true }, { word: "glorp", stem: "glorp", common: false }]);
  assert.equal(both.page.total, added - 1, "every entity holding glorp, whether or not it also holds florp");
  const common = search(snapshot, "florp", { match: "words", limit: 200 });
  assert.deepEqual(common.words, [{ word: "florp", stem: "florp", common: true }]);
  assert.equal(common.page.total, added, "all common: the entities holding every one of them");
  for (const x of common.results) assert.deepEqual(x.matched, [{ where: "tagline", key: null }]);
});

test("words is in the query's order, absent in text mode, and the schema ties it to the mode", () => {
  const r = search(s, "billing deciding", { match: "words" });
  assert.deepEqual(r.words.map((w) => w.word), ["billing", "deciding"]);
  assert.ok(OUTPUTS.search.safeParse(JSON.parse(JSON.stringify(r))).success);
  const t = search(s, "billing");
  assert.equal("words" in t, false);
  assert.ok(OUTPUTS.search.safeParse(JSON.parse(JSON.stringify(t))).success);
  assert.ok(!OUTPUTS.search.safeParse({ ...t, words: [] }).success, "words under match text is refused");
  const { words: _, ...bare } = r;
  assert.ok(!OUTPUTS.search.safeParse(bare).success, "a words answer without words is refused");
  assert.ok(!OUTPUTS.search.safeParse({ ...t, match: "fuzzy" }).success);
});

test("a query with no words is refused on query, and the stems are never written into the snapshot", () => {
  assert.throws(() => search(s, "… — ...", { match: "words" }), (e) => e instanceof ModelError && e.code === "invalid_argument" && e.details.argument === "query");
  const before = JSON.stringify(s);
  search(s, "billing", { match: "words" });
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(Object.keys(s.entities[0]).includes("stems"), false);
});
```

The last assertion of the second headline test says the bullets are section text under Achievements. Run this against the parser's reading first: `node -e` over `withHeadlines()` printing the experience's `sections` says whether the bullets are `text` under the heading `Achievements` or under a grouped heading; the assertion names what the parser gives.

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/search.test.mjs; echo "exit $?"`

Expected: exit 1; the new tests fail with `match is one of text, name` or on the missing `words` field. The existing tests still pass.

- [ ] **Step 3: Widen the schema**

In `lib/schemas.mjs`, replace the `search:` entry of `OUTPUTS` with:

```js
  search: answer({
    query: z.string(), match: z.enum(["text", "name", "words"]),
    // What the server read and what it searched for, in words mode alone: the field is about the
    // query, not the model, and its presence is tied to the mode so that it stays a decision.
    words: z.array(z.strictObject({ word: z.string(), stem: z.string(), common: z.boolean() })).optional(),
    results: z.array(z.strictObject({
      id: z.string(), title: z.string(), type: z.string(), owner: z.string().nullable(), tagline: z.string(), url: z.string().nullable(),
      matched: z.array(z.strictObject({ where: z.enum(["name", "tagline", "field", "section", "table"]), key: z.string().nullable() })),
    })),
    page: Page,
  }).refine((a) => (a.match === "words") === (a.words !== undefined), { message: "`words` is present exactly when match is words", path: ["words"] }),
```

Check that the SDK can still list the schema: `node -e 'import("./lib/schemas.mjs").then(({OUTPUTS}) => console.log(Object.keys(require("zod").toJSONSchema(OUTPUTS.search).properties)))'` prints the keys with `words` among them and throws nothing.

- [ ] **Step 4: Write the mode**

In `lib/model.mjs`, add `import { words, stems } from "./words.mjs";` beside the other imports, and replace the block from the comment `// Two ways to find an entity.` through the end of `search` with:

```js
// Three ways to find an entity. `text` is a substring over everything an entity says, reported by
// where it hit; `name` is the exact canonical name, which is how a caller holding a name reaches
// the ids of everything that carries it, under whichever type or owner; `words` cuts the query
// into words, reduces each to its stem, and keeps every entity that holds every required stem
// somewhere, the words neither together nor in one place, so a visitor's "deciding" meets the
// model's "decide". All three are case-insensitive and answer in one order, type then name then
// id: a listing, not a ranking.
const MATCHES = ["text", "name", "words"];

// Where an entity's words stand, in the order `matched` reports them: name, tagline, each field,
// then each section's text and its tables' cells.
const places = (e) => [
  { where: "name", key: null, text: e.name },
  { where: "tagline", key: null, text: e.tagline },
  ...Object.entries(e.fields).map(([k, v]) => ({ where: "field", key: k, text: [v].flat().filter((x) => typeof x === "string").join(" ") })),
  ...e.sections.flatMap((sec) => [
    { where: "section", key: sec.heading, text: sec.text },
    { where: "table", key: sec.heading, text: sec.tables.flatMap((t) => t.rows.flat()).join(" ") },
  ]),
];

// The stems of every entity, derived once per snapshot the first time a search by words runs
// and kept in memory beside it, never in it: the snapshot's format is a contract of its own, and
// an index derived from the files belongs nowhere a second copy could disagree with the first.
// A stem held by more than half of the instance's entities is common. There is no stop list; the
// instance says which of its words carry no meaning, in whatever language it is written.
const STEMMED = new WeakMap();

const stemmed = (s) => {
  if (STEMMED.has(s)) return STEMMED.get(s);
  const byId = new Map();
  const counts = new Map();
  for (const e of s.entities) {
    const held = places(e).map((p) => ({ where: p.where, key: p.key, stems: new Set(stems(p.text)) })).filter((p) => p.stems.size);
    const all = new Set(held.flatMap((p) => [...p.stems]));
    for (const x of all) counts.set(x, (counts.get(x) ?? 0) + 1);
    byId.set(e.id, { places: held, all });
  }
  const common = new Set([...counts].filter(([, n]) => n * 2 > s.entities.length).map(([x]) => x));
  const out = { byId, common };
  STEMMED.set(s, out);
  return out;
};

export function search(s, query, { match = "text", type, owner, limit, cursor } = {}) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) throw new ModelError("invalid_argument", "search needs a query", { details: { argument: "query", reason: "empty" } });
  if (!MATCHES.includes(match)) throw new ModelError("invalid_argument", `match is one of ${MATCHES.join(", ")}`, { details: { argument: "match", reason: `one of ${MATCHES.join(", ")}` } });
  if (type !== undefined) requireType(s, type);
  if (owner !== undefined) requireId(s, owner);
  const hit = (text) => typeof text === "string" && text.toLowerCase().includes(q);
  // In words mode a common stem is reported and not required; a query of common stems alone is
  // held to all of them, which is most of the instance, paged.
  let asked = null, needed = null, held = null;
  if (match === "words") {
    const read = words(query);
    if (!read.length) throw new ModelError("invalid_argument", "search with match words needs a query with at least one word", { details: { argument: "query", reason: "no words" } });
    held = stemmed(s);
    asked = read.map((word) => { const stem = stems(word)[0]; return { word, stem, common: held.common.has(stem) }; });
    const required = new Set(asked.filter((w) => !w.common).map((w) => w.stem));
    needed = required.size ? required : new Set(asked.map((w) => w.stem));
  }
  const matchedIn = (e) => {
    if (match === "name") return e.name.toLowerCase() === q ? [{ where: "name", key: null }] : [];
    if (match === "words") {
      const own = held.byId.get(e.id);
      if (![...needed].every((x) => own.all.has(x))) return [];
      return own.places.filter((p) => [...needed].some((x) => p.stems.has(x))).map(({ where, key }) => ({ where, key }));
    }
    const matched = [];
    if (hit(e.name)) matched.push({ where: "name", key: null });
    if (hit(e.tagline)) matched.push({ where: "tagline", key: null });
    for (const [k, v] of Object.entries(e.fields)) if ([v].flat().some(hit)) matched.push({ where: "field", key: k });
    for (const sec of e.sections) {
      if (hit(sec.text)) matched.push({ where: "section", key: sec.heading });
      if (sec.tables.some((t) => t.rows.some((row) => row.some(hit)))) matched.push({ where: "table", key: sec.heading });
    }
    return matched;
  };
  const results = [];
  for (const e of s.entities) {
    if ((type !== undefined && e.type !== type) || (owner !== undefined && e.owner !== owner)) continue;
    const matched = matchedIn(e);
    if (matched.length) results.push({ id: e.id, title: e.name, type: e.type, owner: e.owner ?? null, tagline: e.tagline, url: fileUrl(s, e), matched });
  }
  results.sort((a, b) => cmp(a.type, b.type) || cmp(a.title, b.title) || cmp(a.id, b.id));
  const { items, page } = paginate(results, { limit, cursor }, s.commit);
  return { query, match, ...(asked ? { words: asked } : {}), results: items, page, model: provenance(s) };
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/search.test.mjs test/schemas.test.mjs test/contract.test.mjs test/model.test.mjs; echo "exit $?"`

Expected: exit 0. If the second headline's `matched` differs from the assertion, read what the parser gives (Step 1's `node -e`) and fix the assertion to it, never the mode.

- [ ] **Step 6: Conventions and commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add lib/model.mjs lib/schemas.mjs test/search.test.mjs
git commit
```

Subject: `A search by words holds every required stem to the entity`. Body: the two headlines, the common threshold and where the stems live; `Verified:` naming the four test files.

---

### Task 4: The tool, the contract and the deployments

**Files:**

- Modify: `lib/tools.mjs` (the `search` entry)
- Modify: `test/contract.test.mjs` (a `words` case per fixture, a refusal row)
- Modify: `deploy/test/tools.mjs` (one `words` call over the deployment's snapshot)
- Test: `test/descriptions.test.mjs` (unchanged, holds the sixty words), `test/deploy-tools.test.mjs` (unchanged, runs the shared tests)

**Interfaces:**

- Consumes: `search` from Task 3, `words` from `lib/words.mjs`.
- Produces: the tool accepting `match: "words"`; the deployment tests calling it.

- [ ] **Step 1: Write the failing contract tests**

In `test/contract.test.mjs`, add `import { words } from "../lib/words.mjs";` to the imports. Inside the `for (const [label, s] of FIXTURES)` loop, after the empty-result test, add:

```js
  test(`${label}: a search by words answers in the schema, names what it searched for, and finds the identity by its own name`, async () => {
    const client = await connect(s);
    const root = s.entities.find((e) => e.id === s.rootId);
    const r = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: root.name, match: "words", type: root.type } }));
    assert.equal(r.match, "words");
    assert.deepEqual(r.words.map((w) => w.word), words(root.name));
    assert.ok(r.results.some((x) => x.id === s.rootId), "the identity holds every word of its own name");
    const none = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: "zzzz qqqq", match: "words" } }));
    assert.deepEqual([none.results, none.page], [[], EMPTY_PAGE]);
    const text = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: root.name } }));
    assert.equal("words" in text, false);
    await client.close();
  });
```

In the same file's `CASES` list of refusals, after the `["search", { query: "   " }, …]` row, add:

```js
      ["search", { query: "… — ...", match: "words" }, "invalid_argument", (d) => d.argument === "query"],
```

- [ ] **Step 2: Write the failing deployment test**

In `deploy/test/tools.mjs`, inside `registerToolsTests` after the last test, add:

```js
  // The mode reaches a deployment with a re-pin and nothing else, so each holds it against the
  // model it serves: the identity's own name, word by word, finds the identity.
  test("a search by words finds the identity by its own name over this snapshot", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(s).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const root = s.entities.find((e) => e.id === s.rootId);
    const r = checkAnswer("search", await client.callTool({ name: "search", arguments: { query: root.name, match: "words", type: root.type } }));
    assert.equal(r.match, "words");
    assert.ok(r.words.length > 0 && r.words.every((w) => typeof w.stem === "string" && typeof w.common === "boolean"));
    assert.ok(r.results.some((x) => x.id === s.rootId));
    await client.close();
  });
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test test/contract.test.mjs test/deploy-tools.test.mjs; echo "exit $?"`

Expected: exit 1; the tool refuses `match: "words"` as outside its enumeration.

- [ ] **Step 4: Extend the tool**

In `lib/tools.mjs`, replace the `search` entry with:

```js
  { name: "search",
    description: "Find entities by words, substring or exact name. `match: \"words\"` needs every query word's stem in name, tagline, fields, sections or cells; `\"text\"` (default) is a case-insensitive substring over the same; `\"name\"` the exact canonical name. Optional `type`, `owner`, `limit`, `cursor`. Returns `results` with `id`, `title`, `type`, `matched`, `words` in words mode, and `page`: a listing, not a ranking.",
    input: z.object({ query: z.string(), match: z.enum(["text", "name", "words"]).optional(), type: z.string().optional(), owner: z.string().optional().describe("An owner's id, to keep its entities"), ...paged }),
    call: (s, { query, ...options }) => search(s, query, options),
    output: OUTPUTS.search },
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/contract.test.mjs test/deploy-tools.test.mjs test/descriptions.test.mjs test/arguments.test.mjs; echo "exit $?"`

Expected: exit 0. The descriptions test prints the word count on failure; trim the description, never the test.

- [ ] **Step 6: Conventions and commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add lib/tools.mjs test/contract.test.mjs deploy/test/tools.mjs
git commit
```

Subject: `The tool takes match words, and every deployment holds it`. `Verified:` naming the four test files.

---

### Task 5: The interface document

**Files:**

- Modify: `docs/INTERFACE.md` (the `search` section's prose, a new `### \`search\` with \`words\`` section)
- Modify: `scripts/interface.mjs` (the second example)
- Test: `test/interface.test.mjs` (unchanged, holds the file to the script)

**Interfaces:**

- Consumes: the tool from Task 4.
- Produces: the document's second `search` example, written by `npm run interface`.

- [ ] **Step 1: Add the example to the script**

In `scripts/interface.mjs`, in `EXAMPLES`, after the `"\`search\`"` entry add:

```js
  "`search` with `words`": { name: "search", arguments: { query: "decided the billing contexts", match: "words", limit: 2 } },
```

- [ ] **Step 2: Run the interface test to see it fail**

Run: `node --test test/interface.test.mjs; echo "exit $?"`

Expected: exit 1, `docs/INTERFACE.md has no heading "### \`search\` with \`words\`"`.

- [ ] **Step 3: Write the prose**

In `docs/INTERFACE.md`, replace the paragraph under `### \`search\`` with:

```markdown
`query`; optional `match`; `type`, to keep one type's entities; `owner`, an id, to keep one owner's; `limit` and `cursor`. `match: "text"`, the default, is a case-insensitive substring over name, tagline, fields, section text and table cells. `match: "name"` is the exact canonical name, case-insensitive, across types. `match: "words"` cuts the query into words, reduces each to its stem and keeps every entity whose name, tagline, fields, section text or table cells hold every required stem, anywhere: the words need not stand together or in one place. The stemmer is Porter's algorithm for English, which joins the inflections of one word and not its relatives, so deciding meets decide and decided, and decision meets neither. A stem that occurs in more than half of the model's entities is common: it is reported and not required, and a query of common stems alone is held to all of them. A query with no words is refused as `invalid_argument` on `query`. `matched` says where each result hit: `where` is one of `name`, `tagline`, `field`, `section` or `table`, and `key` the field or section heading, null for the first two; in words mode it names each place where a required stem occurs. Results are ordered by type, then name, then id: a listing, not a ranking. A result's name is under `title`, as it is for `fetch`, because some clients call only these two tools and require that field.
```

After the `search` section's closing fence and before `### \`fetch\``, add:

````markdown
### `search` with `words`

The same tool in its third mode. Beside `query` and `match` the answer carries `words`, one `{word, stem, common}` per word of the query in the query's order: what the server read, what it searched for, and whether the stem was too common in this model to be required. The field is absent in the other two modes.

```json
{}
```
````

- [ ] **Step 4: Regenerate and run the test**

```sh
npm run interface; echo "exit $?"
node --test test/interface.test.mjs; echo "exit $?"
```

Expected: both exit 0; the new fence holds a real answer with `words` showing `decided` as `decid`, `the` as common, and two results. Read the regenerated fence: if `the` is not common on the worked example, or the results are empty, choose a query that shows one common word and two results, and regenerate.

- [ ] **Step 5: Conventions and commit**

```sh
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
git add docs/INTERFACE.md scripts/interface.mjs
git commit
```

Subject: `The interface document shows a search by words`. `Verified:` naming the interface test and `npm run interface`.

---

### Task 6: The version, the suite, the push and the pull request

**Files:**

- Modify: `package.json`, `package-lock.json` (version `0.26.0`)

- [ ] **Step 1: Bump the version**

```sh
npm version 0.26.0 --no-git-tag-version; echo "exit $?"
git diff --stat
```

Expected: exit 0; `package.json` and `package-lock.json` alone changed, `0.25.0` to `0.26.0`.

- [ ] **Step 2: Run the whole suite and the conventions**

```sh
npm test > /private/tmp/…/scratchpad/final.log 2>&1; echo "exit $?"
grep -E "^ℹ (tests|pass|fail|skipped)" /private/tmp/…/scratchpad/final.log
sh conventions/conventions-check; echo "exit $?"
sh conventions/conventions-format; echo "exit $?"
sh conventions/conventions-sync check; echo "exit $?"
```

Expected: every exit 0, `fail 0`, `skipped 0`.

- [ ] **Step 3: Commit**

Subject: `The release is 0.26.0`. Body: the package moves to the next minor after main because the mode is additive by the interface document's rule and both deployments take it with a re-pin; `Verified:` naming the suite's counts and the three conventions commands.

- [ ] **Step 4: Push**

```sh
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push; echo "exit $?"
```

- [ ] **Step 5: Update #55's body**

Write the body to a file in the scratchpad, in the git register: the design in one paragraph, what was built in a second, Ruling 1 stated with the cross-check's counts and put to the owner as a question, the release notes to write at tagging with their one-line interface sentence, the `Verified:` sentence, then the Claude Code line. Then:

```sh
gh pr edit 55 --title "A search meets a word by its stem" --body-file /private/tmp/…/scratchpad/pr-body.md; echo "exit $?"
gh pr checks 55
```

Report the checks' state and stop. No merge, no tag, no deployment, no branch deleted.
