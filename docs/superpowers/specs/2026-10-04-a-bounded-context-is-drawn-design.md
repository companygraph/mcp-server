# A bounded context is drawn as its map and its aggregates — design

> Asked to show the diagram of Checking, the chat on companygraph.io draws its neighborhood: twenty-three nodes, the edges labeled by the field that drew them, `Relationships.Context` and `nested-in`, and the patterns the model holds for those relationships nowhere on the picture. Domain-driven design draws a context in views, each answering one question: a context map of its neighbours, upstream to downstream and labeled by pattern, and a class diagram of each aggregate, its root, what it holds and the events it emits. This design adds both as shapes of `diagram`, lets an answer show more than one picture, and leaves the flow and the lifecycle, which the model cannot yet draw without guessing, to a design of their own.

Status: proposed. Decided on 2026-10-04 with the owner against this repository at `a5c0f1f` (v0.54.0), `companygraph/chat-server` at `565d538` (v0.24.0), `robertblust/design` at `f8d5663` (v0.133.0) and `companygraph/meta-model` at `9156b25`, whose software pack declares the types read here. The owner chose among three variants shown in a mockup of companygraph.io's own page and widget, with answers built from mental-model `c10dfc8`: a context map alone, a Bounded Context Canvas with an aggregate, and four views from the outside in. He chose the four views. This design is the first step toward them: the two views the model already draws.

---

## 1. The gap

The software pack gives a bounded context what its views need. Its `## Relationships` table names, on the downstream side, each upstream context and the pattern between them, one of the nine the DDD Crew's context mapping names. An aggregate names its `root` and its `members`, each a concept design whose `kind` is `entity` or `value object`, whose `## Attributes` carry a name and a type and whose `## Relations` carry a cardinality. A domain event names the aggregate that emits it as `emitted-by`.

The neighborhood shape reads none of that as what it is. It draws every edge one hop from the middle, so the three neighbouring contexts sit among feature designs, decisions and concept designs, with `Relationships.Context` where the reader wants "conformist", the root of the aggregate drawn twice, once as the aggregate and once as its concept design, and the events a box like any other nested page. The chat says in words what the picture should show.

The widget makes it worse for a context. It draws only the last `diagram` event a message brings, so an answer that drew a map and an aggregate would show the aggregate alone, and the chat's note to the model says so: "the last one if you drew several".

**What the change buys is a bounded context drawn the way the practice draws it, its map and its aggregates, each picture answering one question, every node an entity and every edge one the model draws, for any client of the MCP host and not only the chat.**

## 2. The two shapes

`diagram`'s `shape` gains two values, `context` and `aggregate`, both taking `id`.

**`context`** is the context map of the one bounded context `id` names, a `flowchart TB`. It draws that context, every context its `## Relationships` names, and every context whose `## Relationships` names it: one hop, as the neighborhood does, and contexts only. Each row is one arrow from the upstream context to the downstream one, so the context a row names points at the context that wrote the row, and upstream sits above downstream on the page, as a context map is read. The arrow is labeled `U → D · ` and the pattern, as the row writes it. Three patterns are symmetric and no side of them is upstream: `partnership`, `shared kernel` and `separate ways` are drawn as one arrow with a head at both ends, labeled with the pattern alone. Where two contexts each name the other with a symmetric pattern, the two rows draw one arrow; where the rows disagree, each draws its own, since a picture that merged them would state a relation neither row states.

Each node's first line is `<small>`, as the neighborhood's «type» line is: «bounded-context» and the context's `classification`, `core`, `supporting` or `generic`. The middle's name is bold, as the neighborhood's middle is. A context with no relationship either way is a picture of one node, as a process of one phase is.

**`aggregate`** is a `classDiagram` of aggregates. Given the id of an aggregate, it draws that one; given the id of a bounded context, it draws every aggregate nested in it, in one picture, so a question about a context is answered in two calls with one id. For each aggregate it draws:

the `root` and every one of `members`, one class each, its label the concept design's name and its annotation its `kind`, with the root's annotation `aggregate root` instead; each class's members its `## Attributes`, one line each as `Attribute : Type`, the type left out where it is empty; one composition from the root to each member, `*--`, with the cardinality the root's `## Relations` row gives that member where there is one, `one` as `1`, `maybe one` as `0..1`, `many` as `*` and `one to many` as `1..*`, and no cardinality where the root names none; every other `## Relations` row between two drawn concept designs as an association, labeled as the `concepts` shape labels one; and every domain event whose `emitted-by` names the aggregate, one class each, annotated `domain event`, with no members, and a dashed dependency from the root labeled `emits`.

The events carry no members because their payload is the flow's to show (§9), and because a picture already as wide as the aggregate's members would be twice as wide with them. A concept design two aggregates both hold is drawn once. A concept design an aggregate's root reaches through `## Relations` that the aggregate does not hold is not drawn: the picture is of what the aggregate holds.

`title` is the bounded context's name for `context`, and for `aggregate` the aggregate's name or, given a context, the context's. `nodes` names each drawn entity with its `id`, as every shape does, so the widget links the root to its concept design and an event to its page; an aggregate as such is not a node, since its root stands for it.

Both shapes hold the fifty-node cap and refuse past it with `cannot_draw` and `too_large`, as `concepts` does, since a cut map or a cut aggregate draws a boundary that is not there. `aggregate` given a context that holds no aggregate refuses with `cannot_draw` and `empty`. An id of another type is `invalid_argument` on `id`, naming the types the shape takes. An instance that does not take the software pack has no `bounded-context` or `aggregate` type, and both shapes refuse with `unknown_type`, as every shape refuses a type its core lacks.

## 3. More than one picture

The chat already forwards every `diagram` answer as its own event, in the order the tools answered. What changes is what the widget does with them and what the model is told.

`chat.js` in `robertblust/design` keeps every `diagram` event a message brings and draws each under the answer, in the order they came, each a figure as today with its caption and its Expand. Where an answer holds more than one picture, each is drawn fitted to the log's width, as a picture a page was built with is drawn (`rbchat-diagram-fit`), and a click on it, anywhere but a node's link, opens it as Expand does: a reader sees the whole answer and opens what they want to read. An answer with one picture is drawn as today, at its own size in a box that scrolls.

Under each picture of the two new shapes the widget writes one line saying how to read it, from its strings in the page's language and never from the host or the model: for `context`, that arrows run from upstream to downstream and each names the pattern between the two contexts; for `aggregate`, that the root holds what the diamonds join and the dashed arrows are the events it emits. The captions gain the two shapes, "Context map" and "Aggregate", and in German "Context Map" and "Aggregat", as German writing on domain-driven design names them.

Mermaid's sequence and state diagrams are not drawn by this design, so the configuration changes only in what the two shapes need: the class diagram drawn at its own size, as it is today.

The tab keeps a conversation's turns, and a turn keeps its pictures as a list, `diagrams`, where it kept one as `diagram`; a turn kept by an earlier release, carrying `diagram`, is drawn from it as a list of one, so a conversation that spans the release keeps its picture.

`companygraph/chat-server`'s note to the model in `lib/loop.mjs` drops "the last one if you drew several" and says that every diagram it draws is shown under the answer in the order drawn. `DIAGRAM_RULE` in `lib/prompt.mjs` gains one clause: a visitor who asks to see a bounded context, or the diagram of one, is shown shape `context` and then shape `aggregate`, both with the context's id, and the answer names what each drew. Where `aggregate` refuses as `empty`, the map stands alone and the answer says the context holds no aggregate.

## 4. The answer

`diagram`'s answer keeps its shape. `shape` takes the two new values, which INTERFACE.md counts as additive: a new value of an input enum, and the same in the output's. `cannot_draw`'s details take them too. No field is added.

The output schema in `lib/schemas.mjs` reads `SHAPES`, so it follows. The tool's description in `lib/tools.mjs` names the two shapes and, for `aggregate`, that a context's id draws all its aggregates, within the length the template allows.

## 5. Tests

`test/diagram.test.mjs`, against a fixture instance that takes the software pack: the whole Mermaid source of a context map with an upstream conformist, a downstream conformist and a shared kernel named from both sides, drawn as one arrow; two contexts naming each other with patterns that disagree, drawn as two; a context with no relationship, drawn as one node. The whole source of an aggregate with a root, an entity member and value-object members, each cardinality mapped, a member the root names no cardinality for, an association between two members, a concept design outside the aggregate left out, and two emitted events; a context with two aggregates drawn in one picture, a concept design both hold drawn once. Every refusal: `too_large` for each shape, `empty` for a context without an aggregate, `invalid_argument` for an id of the wrong type, `unknown_type` on an instance without the pack. An attribute whose name holds a quote, a `#`, a colon and a brace, which the member line must escape as a label is escaped.

`test/contract.test.mjs` gains a case per shape per fixture, parsed against the schema like every other; `deploy/test/tools.mjs` gains a `context` call over a deployment's own snapshot where it holds a bounded context, and holds that every arrow's label begins with a pattern the pack declares or `U → D · `.

`chat-server`: `test/loop.test.mjs` holds that two `diagram` answers emit two events in order and that the note no longer says the last one is drawn; `test/prompt.test.mjs` holds the new clause.

`design`, in `test/chat-diagram.test.mjs` and its fixture `test/fixtures/diagrams.json`: `node --test` on the strings, both languages carrying both captions and both reading lines. In Chromium through Playwright, which the suite already drives: an answer bringing two pictures draws two figures in order, each fitted and each opening full screen on a click that is not a node's link; an answer bringing one draws it as today; a kept turn carrying `diagram` restores its picture; each node of both shapes found by `nodeElement` and linked.

Before the chat's pull request, the local measurement runs control against change on the host of companygraph.io, whose model holds bounded contexts, with "can you show me the diagram of checking", "zeig mir den Bounded Context Answering" and "how does Serving relate to the other contexts?", and the answers are read, not scored.

## 6. Files

`mcp-server`: `lib/diagram.mjs`, the two shapes; `lib/schemas.mjs`, `SHAPES`; `lib/tools.mjs`, the description; `scripts/interface.mjs`, an example for each shape; `docs/INTERFACE.md`, regenerated; the tests in §5; the README's row for `diagram`, and the `id` argument's description, which names what `id` is for each shape. `chat-server`: `lib/loop.mjs`, `lib/prompt.mjs`, the pin of `companygraph-mcp-server` its tests run against, the tests. `design`: `assets/chat.js`, `assets/chat.css` for the reading line, the tests.

## 7. Release and order

As the first diagrams went. The tool first: an `mcp-server` release, the next minor after whatever `main` carries when this merges, and the three MCP hosts re-pinned to it, so agents can ask for both shapes. Then `design`'s widget, released and taken by blust.ch, companygraph.io and guestgraph.io in their next content re-pin; a widget that draws every picture changes nothing until a chat sends two. Then `chat-server`'s note and clause, released, and re-pinned in each deployment only after its own site has taken the design release, because an older widget would draw the aggregate alone under an answer that names a map. Every merge, every release and every re-pin waits for the owner's word.

blust.ch and guestgraph.io take the release and see no change: neither model holds a bounded context today, and both shapes refuse there with `unknown_type`, which the Answerer answers in words.

## 8. What the mockup showed

The mockup ran companygraph.io's live page, its `chat.js` and `chat.css`, with a fetch stub replaying answers built from mental-model `c10dfc8`, so every node and label on it was read from the model. It confirmed three things this design takes: a context map of four contexts fits a panel at its own size; an aggregate drawn left to right grows taller than the panel, and drawn top to bottom wider, so with more than one picture each is fitted and opens full screen; a member line `Outcome : refused | passed | failed` renders. The mockup's change to the widget is the one in §3.

## 9. Out of scope, and the next design

The flow and the lifecycle, the other two of the four views. A sequence from a handled command through the aggregate to the events it emits, and a state diagram of the aggregate's outcomes, both need what the model does not hold as structure: a command is a row on its aggregate that nothing can reference, so no row says which events a command emits, and an invariant names no event or outcome it guards. The mockup drew both from a reading of the invariants' sentences, which is a picture a tool could not draw without guessing. A design in `companygraph/meta-model` comes first: whether a handled command names the events it emits, whether `## State transitions`, which the aggregate schema already declares as prose, becomes a table of from, to and the command that moves it, and how an invariant names what it guards. The two shapes follow it here.

Also left out: a context's `## Consumes` rows drawn on the map, which name an event from another context and would label an arrow with it; the domain a context realizes drawn as a boundary around the contexts, which the mockup tried and dropped as a box that added width and no reading; a Bounded Context Canvas as its own answer, which the chat can write today as a table from `get_entity`; and these shapes on the model's own pages or in the Obsidian plugin.
