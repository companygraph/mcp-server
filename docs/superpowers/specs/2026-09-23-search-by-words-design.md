# A search meets a word by its stem — design

> A visitor writes "Deciding well" and the model says "Decide well over build fast"; a visitor
> writes "validated" and the model says "validation". Today's `search` is a substring match, so
> each of those finds nothing, and the chat that stands on it tells the visitor the model does
> not say what the model says three inflections away. This adds a third `match` mode, `words`,
> in which every word of the query is reduced to its stem and must occur, as a stem, somewhere
> in the entity. It is a listing still, it ranks nothing, and a word the model does not hold
> still finds nothing.

Status: proposed. Decided on 2026-09-23 with the owner against this repository at `f02bae4` (v0.25.0), from the owner's test of the chat on blust.ch: each page's headline put to the chat as a question. Both deployments, mcp.blust.ch and mcp.companygraph.io, serve this package, so the mode reaches both with a re-pin.

---

## 1. The gap

`match: "text"` is a case-insensitive substring over an entity's name, tagline, fields, section text and table cells. It answers a term the way a reader with the file open would: the characters are there or they are not. That is the right property for a name and for a term of the model's own vocabulary, and it is the property the retrieval design of the meta-model, *The graph is the index, not the corpus*, holds this server to: a query that matches nothing returns nothing, which is the "no such thing" answer kept at the tool. When fuzzy matching was offered on 2026-09-21 it was declined, and the reason stands: a similarity score on a structural fact is a category error, and a nearest-three answer is the failure that looks like success.

What the test found is narrower than fuzziness. The visitor's words and the model's words differ by inflection and by adjacency. "Deciding well" does not contain "Decide well"; "validated in the open" is not a substring of anything that says "validation", "open" and "two ideas" in three different sentences of one entity. The chat, which is the first consumer that takes a question in a visitor's own words, does what the retrieval design's first step asks, resolving vocabulary by choosing search terms, but it chooses them against a substring, so every inflection it does not guess is an entity it does not reach, and its honest sentence, the model does not say, is then untrue.

**What the change buys is one match per word rather than one match per string, with the word reduced to what English inflection leaves alone.** Nothing is scored, nothing is ranked, and a stem that occurs nowhere in the model still finds nothing.

## 2. The mode

`search` gains `match: "words"`. The query is split into words, each word is reduced to its stem, and an entity is a result when every stem occurs at least once among the stems of its name, tagline, fields, section text and table cells. The words need not stand together and need not stand in the same place: the entity is the unit the listing returns, and a visitor's sentence describes an entity, not a sentence of it. `type` and `owner` filter as in the other two modes. The order is the listing's, type then name then id, and the page is the page.

A word that carries no meaning is not required, and the instance says which words those are. There is no stop list: a list of words to ignore is a second vocabulary to keep, in one language, and it would still miss the word that is empty in one instance and full in another. Instead a stem that occurs in more than half of the instance's entities is common, and a common stem in the query is reported and not required. The threshold is derived from the instance at the same moment its stems are, costs nothing to keep, and holds in any language the instance is written in. It is strict on purpose, and the reference instance at `f4e8fd2` says what that means: sixteen stems are common there, the, a, of, and, in, to, is, for, with, on, that, it, as, an, or and i, and "this" is not among them, so "This site collects nothing" is held to `thi` as well as to `site`, `collect` and `noth`, and finds nothing, because the surface that says it happens not to contain the word. Lowering the line would make the threshold the stop list this paragraph declines, and the same instance says how fast: at more than a quarter of the entities 53 stems are common, at more than a tenth 222, among them decision, strategy, product, owner and skill, the words a visitor's question is about. So the line stays at half, and dropping the words that carry no meaning is the client's part. A query whose stems are all common returns the entities that hold all of them, which is most of the instance, paged; a query whose words all reduce to nothing, punctuation alone, is refused as `invalid_argument` on `query`, the refusal an empty query gets today. The chat's rule, in its own repository, will still say to search with the words that carry the meaning, because a shorter query is a better one whatever the server forgives.

`text` stays the default. The meaning of a call that names no `match` is part of the contract, and changing it is a break for the price of a convenience the client can name in one argument. `name` is untouched.

## 3. Words and stems

A word is a maximal run of letters and digits after the text is lowered and its diacritics folded: NFKD normalization, then the combining marks removed, so that a visitor's "zurich" meets the model's "Zürich" and a hyphenated "domain-driven" is the two words it is. A possessive's apostrophe-s is dropped before the split, so that "the owner's" is the word owner: split, it is owner and a bare s, which the algorithm below stems to nothing, and on the reference instance that empty stem stood in 70 of 155 entities, short of half, so it was required and "company's vision" found six entities where "company vision" found nine. The fold is the tokenizer's because the stemmer is the paper's and stays so. The same tokenizer runs over the query and over the entity, which is what makes the comparison a comparison.

The stemmer is Porter's algorithm for English, the 1980 one, implemented in this package as one pure module, `lib/words.mjs`, with no dependency added. It is chosen because it is fixed, published and deterministic, so two deployments at one release give one answer, and because the model is English by rule: R14 makes names and prose American English in every instance, so an English stemmer covers every word a search can meet, and a German visitor's question is already translated into the model's terms by the client that asks. The module exports `words(text)`, the tokens, and `stems(text)`, their stems in order, and nothing else.

The algorithm's limits are stated rather than hidden. It conflates inflections of one word and does not join a word to its relatives: "deciding", "decide" and "decided" meet, "decision" does not; "validated", "validation" and "validate" meet; "building" meets "build" and "built" meets neither. A test holds those pairs, verified against a reference implementation before the first line was written, so a later change to the module cannot move them in silence.

The stems of an entity are derived, once per snapshot, the first time a `words` search runs, and kept beside the entity in memory: a few hundred entities of a few hundred words each, a moment's work. They are not written into the snapshot file. The snapshot's format is a contract of its own, and an index derived from the files belongs nowhere a second copy could disagree with the first, which is the retrieval design's own rule about where an index may live.

## 4. The answer

The answer keeps its shape and gains one field. `results` and `page` are as in the other modes, and `matched` keeps its one form, a list of `{where, key}`: in `words` mode an entry names each place where at least one of the query's stems occurs, so a client sees which sections carried the visitor's words. Beside `query` and `match`, a `words` answer carries `words`, a list of `{word, stem, common}` in the query's order: what the server read, what it searched for, and whether the stem was too common in this instance to be required. It is about the query and not about the model, so the server's instruction, that it reports what the model says and adds nothing, holds; it is there so that a client, and a reader of the interface document, can see that "validated" was searched as `valid`, instead of having to know the algorithm. In `text` and `name` mode the field is absent.

The output schema in `lib/schemas.mjs` widens `match` to the three values and adds `words` as optional. Both are additive by the interface document's own rule: a new value an argument accepts and a new output field. Nothing is renamed and no required field changes.

## 5. What does not change

The order of results, the paging and the cursor, the filters, the refusals for an unknown type, an unknown owner and a bad cursor, the `title` field a result keeps for the clients that require it, the `url`. `fetch` and `get_entity` are untouched. The server's instructions gain nothing: the mode is described in the tool's description, and the glossary defines no new term, because a word and a stem are English.

## 6. Tests

`test/words.test.mjs` holds the tokenizer and the stemmer: the diacritic fold, the hyphen split, the case fold, and a table of pairs that must meet and pairs that must not, the ones §3 names among them. `test/search.test.mjs` gains four cases. The two headlines, as the owner asked them, against a fixture the test builds the way `withSharedName` builds its own, so the case waits on no re-pin of the reference instance: "Deciding well" finds a value named *Decide well over build fast* and a profile whose tagline says "Deciding well", and "validated in the open" finds an experience that says validation, open and ideas in three different bullets and not one that says only two of them. A query in `words` mode whose stems occur nowhere returns an empty page, so the mode keeps the "no such thing" answer. A stem in more than half of the fixture's entities is marked common and not required, and one in fewer is required, held at the boundary on a fixture the test builds. The `words` field is in the query's order and is absent from a `text` answer. And the positive control every schema has: a `words` answer with `words` present under `match: "text"` is rejected by the schema, not to forbid it forever but so that the field's presence stays a decision.

`test/contract.test.mjs` gains a `words` case per fixture, parsed against the schema like every other, so the contract's list of every tool's cases keeps its rule that nothing is served that nobody calls. The shared deployment tests in `deploy/test/tools.mjs` gain one `words` call over the deployment's own snapshot, so each deployment holds the mode against the model it serves.

## 7. The interface document and the description

`docs/INTERFACE.md`'s `search` section describes the third mode in a sentence beside the two, says that words need not stand together or in one place, and names the stemmer and its limit in one sentence. It gains a second example under its own heading, "`search` with `words`", written by `scripts/interface.mjs` from the worked example like every other, whose answer shows `words` beside `results`. The tool's description in `lib/tools.mjs` names the mode within the sixty words the template allows.

## 8. Files

`lib/words.mjs` is new and holds the tokenizer and Porter's algorithm. `lib/model.mjs` gains the third branch of `matchedIn` and the per-snapshot stems. `lib/schemas.mjs` widens `match` and adds `words`. `lib/tools.mjs` extends the enum and the description. `scripts/interface.mjs` gains the example. The three test files named in §6, and `docs/INTERFACE.md`, regenerated.

## 9. Release

One release, the next minor after whatever `main` carries when this merges. It is additive by the interface document's rule, so the notes carry no `Interface` heading, and a deployment does nothing but re-pin. The chat, `companygraph/chat-server`, then names the mode in its search rule in a release of its own, and the second half of the finding, that the model at `6df2c30` held none of the ideas page's words, is answered by the model's own branch in robertblust/mental-model, not here: no mode finds a word that is not there. The meta-model's retrieval design records in *Where this stands* that fuzzy matching was declined; the sentence stays true, and a line naming this mode as the deterministic slice of its first step is owed to that document on its next touch, by whoever touches it.

Merging, the tag and the re-pins each wait for the owner's word.

## 10. Out of scope

Ranking, similarity and typo tolerance, as before and for the reason §1 gives. A stop list. Stemming in any language but English, which R14 makes unnecessary for the model and which a client answers for the visitor. Synonyms, and the tagline index the retrieval design describes for an instance that outgrows a context window: no instance is near one. Changing the default mode. A `words` variant of `match: "name"`, since a canonical name is matched whole or not at all.
