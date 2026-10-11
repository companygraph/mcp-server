# A system is drawn in its landscape and by what it holds — design

> Asked about a system, the chat answers in words and a table: the landscape pack holds what the system runs on, what it takes data from and over which interface, which services it provides and which concepts it keeps data of, as master, writer or reader, and no shape of `diagram` reads any of it as what it is. Enterprise architecture draws a system in views, each answering one question: where it stands among the systems it exchanges data with, and whose copy of each record is the one that leads. This design adds both as shapes of `diagram`, each of one system named by its id, shown together as a bounded context's map and aggregates are, with the ArchiMate element of each system's kind drawn as a mark before its name.

Status: proposed. Decided on 2026-10-10 with the owner against this repository at `b8d220a` (v0.64.0), `companygraph/chat-server` at `f0d50be` (v0.33.0), `robertblust/design` at `ef83b97` (v0.146.0), `companygraph/meta-model` at `ee05925` (v0.91.0, core 0.66.0), whose landscape pack declares the types read here, and `companygraph/mental-model` at `95aa331`, which holds CompanyGraph's own systems, kinds, services and data objects. The owner chose from a mockup drawn with the widget's own Mermaid and settings, in companygraph.io's page shell, from CompanyGraph's own landscape pages and the meta-model's example company. Four pictures were shown: the whole landscape framed by kind, the whole landscape framed by what runs on what, one system named by its id, and what the systems hold. He chose the last two, and that both are drawn for one system and shown together, as `context` and `aggregate` are for a bounded context.

---

## 1. The gap

The landscape pack gives a system's picture everything it draws. `part-of` says what a system runs on or in; `## Connects to`, written on the side that takes the data, names the system the data comes from, the interface in `As`, the service called, what is carried and how; a service's `provided-by` names the systems that expose it; `## Holds` names each concept the system keeps data of, the data object where one is modeled, and whether the system's copy is the `master`, one it `writes` or one it only `reads`; and the system's kind carries the ArchiMate element a drawing shows it as, with the kind's own name as the stereotype. The pack's README leaves views to a consumer: "a consumer draws the graph".

No consumer draws it. The neighborhood of a system draws every edge one hop out, labeled by the field that drew it, `Connects to.System`, `Holds.Concept`, `part-of`, with the interface, the access and the data object nowhere on the picture, and a service and a seat drawn as boxes like any other. The chat on a site whose model takes the pack answers "what does the chat server connect to?" with a table.

A picture of the whole landscape is not the answer. The mockup drew one for CompanyGraph's ten systems and it read, but the instance the pack was written for holds hundreds, which the cap refuses, and the owner chose the system as the unit: one named system, its surroundings and its data, as a bounded context is drawn by its map and its aggregates and never as the whole model.

**What the change buys is a system drawn the way the practice draws it, in its landscape and by the data it holds, every node an entity and every arrow an edge the model draws, for any client of an MCP host and not only the chat, with companygraph.io the first site to show one of its own.**

## 2. The two shapes

`diagram`'s `shape` gains two values, `system` and `holds`, both taking the `id` of a system.

**`system`** draws the named system in its landscape, a `flowchart LR`. The middle is the system itself, its name in bold with the class `middle`, which the source defines as a heavier border. Around it stand, one box each: the system its `part-of` names, joined to the middle by a dotted line; every system whose `part-of` names the middle, each joined to it the same way; every system a row of the middle's `## Connects to` names, with a solid arrow from that system to the middle; every system whose `## Connects to` names the middle, with a solid arrow from the middle to it; every service whose `provided-by` names the middle, drawn as a rounded box and joined to the middle by a line ending in a circle at the service; and what the middle's `## Holds` names, one cylinder per row, with an arrow from the middle to it. A system appears once however many of these reach it.

A connection's arrow is labeled with the row's `As`, `Carries` and `Via`, those present, in that order, joined by ` · `, so a reader sees the interface, what is carried and how; a row with none of the three draws an unlabeled arrow. A held row's arrow is labeled with its `Access` as the row writes it, heavy (`==>`) for `master`, solid (`-->`) for `writes` and dotted (`-.->`) for `reads`, so the lead copy stands out without a word. The dotted line to what a system runs on and the line to a service carry no label in the source; their word is in `links` (below).

Each system's box reads as the organization's people do: a mark, the name in bold, and on the line below in `<small>` the name of its kind as a stereotype, `«SaaS»`, `«Platform»`, as the neighborhood's «type» line is set. The mark is `fak:fa-` and the `element` of the system's kind, one of `application-component`, `node`, `system-software`, `device`, `equipment` and `communication-network`, which Mermaid replaces with the mark the widget registers (§3); a kind is the standard's own profile of an element, and a drawing shows the element's notation and the kind as the stereotype, which is exactly the box. A cylinder is labeled with the data object's name and, below it in `<small>`, the concept it realizes; a concept the system keeps in no modeled form is a cylinder of the concept's own name. A system whose `lifecycle` is `planned` has the class `planned`, a dashed border; `retiring` and `retired` the class `retiring`, a finer dash; the source defines each class it uses and none it does not.

**`holds`** draws the named system among the systems that hold the same data, a `flowchart LR`. Its cylinders are the concepts the middle's `## Holds` names, one per data object kept of each, with the concept below it, and one of the concept's own name where some system keeps it in no modeled form: so a concept two systems keep in two forms is two cylinders, and the picture says whose copy the middle's is, or who copies the middle's own. Around them stand the middle, with the class `middle`, and every other system whose `## Holds` names one of those concepts, one box each, drawn as in `system`; and one arrow per row from the system to the row's cylinder, heavy, solid or dotted and labeled by its access, as above. Nothing else is drawn: no connection, no host, no service.

Both shapes take `id`, which is required, as every shape of one entity requires it. `title` is the system's name for both. `nodes` names every box and cylinder with its entity: a system, a service, a data object or a concept. `links` holds one entry per arrow and line, in the order drawn, with the model's own word for it: a connection's label as written on the arrow, with ` · ` between its parts; a held row's `Access`; `part-of` for the dotted line, from the part to what it runs on; `provided-by` for the line to a service. `edges` counts them.

**Refusals.** Past fifty nodes a shape refuses with `cannot_draw` and `too_large`, as every shape of one entity does, since a cut picture would draw a boundary that is not there. `system` always holds its middle and is never refused as empty, as a context map is not. `holds` of a system whose `## Holds` is empty or absent refuses with `cannot_draw` and `empty`. An id of another type is `invalid_argument` on `id`, naming the type the shape takes. A model that does not take the landscape pack has no `system` type, and both shapes refuse with `unknown_type`, as every shape refuses a type its model lacks.

**Escaping.** `label()` already writes the colon of Mermaid's icon syntax with a zero-width space after it, so an interface, a system or a concept whose name holds `fa:fa-x` is never drawn as a mark; the tokens this design writes are the tool's own and are written before `label()` sees the name. A `·` in a label is a character like any other.

## 3. The widget

`robertblust/design`'s `chat.js` registers six more marks in the icon pack named `fak` it already registers, beside `human` and `agent`: one per ArchiMate element, drawn as the standard draws the element's icon on a 16-unit square in `currentColor`, a component with its two tabs, a node as a cube, system software as a disc with a circle on its rim, a device as a screen on a stand, equipment as a gear and a network as two joined nodes. They are defined once in `lib/marks.mjs` beside the two natures' marks and held to the widget's copy by the test that holds those, and colored at the firm brightness, `--c-firm`, as a person's mark is, since a system is a thing and not an agent. Mermaid replaces a token with its mark before it measures the label, so the box fits it, and `wrapNodeName` already keeps a mark outside the name a hover underlines.

Nothing else in the drawing is the widget's: the heavier border of the middle, the dashes of a planned or retiring system, a cylinder and a rounded box are the source's own, so a client without the widget's styles draws them too.

The captions gain the two shapes. Under each picture the widget writes its reading line, as it does for a context and an organization, from its own strings and never from the host: for `system`, "Solid arrows run from the system the data comes from to the one that takes it, labeled with the interface, what is carried and how; a dotted line joins a system to what it runs on; a rounded box is a service the system provides; a cylinder is data it holds, by a heavy arrow where its copy leads, a solid one where it writes and a dotted one where it only reads." For `holds`, "Each cylinder is data kept of the concept named under it; a heavy arrow marks the system whose copy leads, a solid one a system that writes a copy of its own, a dotted one a system that only reads." The caption words are "Landscape" for `system` and "Data held" for `holds`, settled by the owner; their German, and the reading lines', is made by the translator, read by the editor and the back-reader, and settled by the owner, as every string of the widget is.

The widget already draws every picture a message brings, fitted and opening full screen when there are several, and turns a `flowchart LR` top to bottom in a narrow panel, which the mockup confirmed reads for both shapes on a phone. Nothing of that changes.

## 4. The chat

`companygraph/chat-server`'s `DIAGRAM_RULE` in `lib/prompt.mjs` gains one clause: a visitor who asks to see a system, or the diagram of one, what it connects to, what runs on it or what it runs on, or what data it holds, is shown shape `system` and then shape `holds`, both with the system's id, and the answer names what each drew; where `holds` refuses as `empty`, the landscape stands alone and the answer says in one sentence that the model names no data the system holds. The two names join the list of shapes the rule gives. One who asks which system masters a concept is answered in words from the pages, as today, and shown no picture unless they ask to see one: a picture of a concept's holders is a shape of its own (§11).

## 5. CompanyGraph's own model

`companygraph/mental-model` already holds what the shapes draw: three kinds, ten systems, two services and three data objects, written when the pack shipped. Nothing is added to it by this design. companygraph.io's site and host show the pictures once their pins reach that commit, which the family's re-pins carry and this design does not.

## 6. The meta-model

`packs/landscape/README.md` keeps its row that views are not held and a consumer draws the graph, which is now true of one consumer. Nothing in the pack changes.

## 7. The interface

`shape` takes two new values, which INTERFACE.md counts as additive, in the input enum, the output's and `cannot_draw`'s details. Both join `TAKES.id` and require it, as `context` does. A node of type `service`, `data-object` or `concept` beside `system` is new to these shapes and uses the fields every node has. No field is added. The tool's description in `lib/tools.mjs` names both shapes, what each draws and that both take a system's id, within the length the template allows; the `id` argument's description names what `id` is for each.

## 8. Tests

`test/diagram.test.mjs`, against the meta-model's example at the pinned fixture, which holds Beacon's three systems, three kinds, one service and one data object. The whole Mermaid source of `system` for the Billing service: the Beacon cluster it runs on by a dotted line, the Invoice mailer by a solid arrow labeled `Feed endpoint · Invoice · REST`, the Invoice feed as a rounded box, six cylinders, the Invoice record over its concept Invoice, four heavy arrows for `master` and two dotted for `reads`, each box with its mark and its kind. The whole source for the Invoice mailer, whose only connection arrives, and for the Beacon cluster, whose only edge is the service that runs on it. From a fixture that adds them: a system with a `planned` lifecycle drawn dashed, a connection row with `As` alone and one with nothing to label, a system that reaches the middle three ways and is drawn once. The whole source of `holds` for the Invoice mailer: the Invoice record over Invoice and the bare Customer, the mailer dotted to both and the Billing service heavy to one and dotted to the other; for the Billing service, with the mailer as its reader; `empty` for the Beacon cluster. Every refusal: `too_large` for each shape from a fixture past fifty, `invalid_argument` for an id of another type, `unknown_type` on a model without the pack. `links` and `nodes` of each, with their words. A name holding `fas:fa-x`, drawn with no mark.

`test/contract.test.mjs` gains both shapes per fixture, parsed against the schema like every other. `deploy/test/tools.mjs` draws both over a deployment's own snapshot where it holds a system, and holds that every node is a system, a service, a data object or a concept.

`chat-server`: `test/prompt.test.mjs` holds the new clause.

`design`, in `test/chat-diagram.test.mjs` and its fixture `test/fixtures/diagrams.json`: both languages carry both captions and both reading lines, and the marks test holds eight marks to `lib/marks.mjs`. In Chromium through Playwright, which the suite already drives: a picture of `system` draws a mark in each box, outside the underlined name, and the box wide enough for it; a cylinder and a rounded box are found by `nodeElement` and linked; the middle's border is heavier and a planned box dashed; two pictures in one answer draw as two figures, as today.

Before the chat's pull request, the local measurement runs control against change on the host of companygraph.io with "show me the chat server", "was läuft auf Cloud Run?" and "what data does the MCP server hold?", and the answers are read, not scored.

## 9. Files

`mcp-server`: `lib/diagram.mjs`, the two shapes; `lib/schemas.mjs`, `SHAPES`; `lib/tools.mjs`, the description; `scripts/interface.mjs`, an example of each; `docs/INTERFACE.md`, regenerated; the README's row for `diagram`; the tests of §8. `design`: `assets/chat.js`, `lib/marks.mjs`, the strings, the tests. `chat-server`: `lib/prompt.mjs`, the pin of `companygraph-mcp-server` its tests run against, the tests.

## 10. Release and order

As the organization went. The tool first: an `mcp-server` release, the next minor after whatever `main` carries when this merges, and the three MCP hosts re-pinned to it, so agents can ask for both shapes. Then `design`'s widget, released and taken by the three sites, which draws the six marks for any host that sends them and changes nothing for one that does not. Then `chat-server`'s clause, released and moved into each deployment only after its site has taken the design release, because an older widget would draw the boxes without their marks. Every merge, every release and every re-pin waits for the owner's word.

blust.ch and guestgraph.io take the releases and see no change: neither model takes the landscape pack, and both shapes refuse there with `unknown_type`, which the Answerer answers in words.

## 11. What the mockup showed

The mockup ran companygraph.io's page shell with the design package's `chat.js`, `chat.css` and vendored Mermaid at v0.146.0, the six marks registered by the page as §3 registers them, and figures built from CompanyGraph's own landscape pages and the example's, so every node and label on it was read from a model. It confirmed what this design takes: a system drawn left to right reads in the panel, and the six held rows of the example's billing service stack into a column that the widget's top-to-bottom turn on a phone, or Expand, puts in a row; a mark in a frame's title and in a box both draw; a concept framed around its one data object said nothing a cylinder's second line does not, so the frames the mockup's first data picture had are gone from `holds`; and the whole landscape framed by kind, which Mermaid lays out by the arrows and not by the kinds' rank, read well for ten systems and is set aside, not refused, for a landscape of hundreds.

## 12. Out of scope

The whole landscape as one picture, framed by kind or by host, which the mockup drew and the owner set aside. A picture of one concept's holders, which system masters a customer and who copies it, which the mockup drew over the whole model and which is a shape by a concept's id for a later design. A system's `realizes`, `serves`, `owner`, `operator`, `processor` and `domain` on the picture: they are the answer's words, through `get_entity`, and would double the nodes of every picture. The service a connection row calls, in `Service`, drawn as its own node between the two systems. A Systems page on the sites, drawn at build time as the processes page draws from `processDiagram`. These shapes in the Obsidian plugin.

## Decisions

Taken by the owner on 2026-10-10 from the mockup: no picture of the whole landscape; one system at a time, in its landscape and by what it holds, both drawn for one id and shown together, as a bounded context is shown; and the caption words, "Landscape" and "Data held".
