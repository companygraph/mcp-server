// A search by words compares a query to an entity one word at a time, so both are cut into words
// the same way: lowered, the diacritics folded so that a visitor's "zurich" meets the model's
// "Zürich", and split on anything that is not a letter or a digit, so that "domain-driven" is the
// two words it is. Each word is then reduced to its stem by Porter's algorithm, the one published
// in 1980, implemented here so that two deployments at one release give one answer and no
// dependency decides what a word becomes. English, because R14 makes every instance's names and
// prose American English; a visitor's German is the client's to translate before it asks.

export function words(text) {
  // Normalized before it is lowered, since a compatibility character may decompose to a capital.
  const folded = String(text ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  return folded.match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Porter, M. F., "An algorithm for suffix stripping", Program 14(3), 1980. A consonant is any
// letter but a, e, i, o, u, and y where a consonant precedes it; the measure m counts a word's
// vowel-consonant sequences; each step tries its rules and obeys the one whose suffix is longest,
// applying it only where its condition on the remaining stem holds. Nothing here is a departure
// from the paper: the reference code's later ones, `bli` for `abli`, `logi`, and leaving a word of
// two letters alone, are not taken, so a reader of the paper reads this.
// Which letters of a word are consonants, decided once, left to right, because a y is decided
// by the letter before it: over a run of y's a definition that looks back per letter is
// quadratic and, on a query a stranger sends to a public endpoint, deep enough to overflow.
const consonants = (w) => {
  const out = new Array(w.length);
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    out[i] = "aeiou".includes(c) ? false : c === "y" ? i === 0 || !out[i - 1] : true;
  }
  return out;
};

const measure = (w) => {
  const c = consonants(w);
  let m = 0, i = 0;
  while (i < w.length && c[i]) i++;
  while (i < w.length) {
    while (i < w.length && !c[i]) i++;
    if (i === w.length) break;
    m++;
    while (i < w.length && c[i]) i++;
  }
  return m;
};

const hasVowel = (w) => consonants(w).includes(false);
const endsDouble = (w) => w.length >= 2 && w.at(-1) === w.at(-2) && consonants(w).at(-1) === true;
// *o: the stem ends consonant, vowel, consonant, and the last is not w, x or y.
const endsCvc = (w) => {
  const c = consonants(w), n = w.length;
  return n >= 3 && c[n - 1] && !c[n - 2] && c[n - 3] && !"wxy".includes(w.at(-1));
};

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
  if (w.endsWith("eed")) return step(w, [["eed", "ee", m0]]);
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

export function stems(text) {
  return words(text).map(stem);
}
