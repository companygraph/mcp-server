# An organization is drawn as its people — design

> Asked how a company is organized, the chat answers in words and a table: the organization pack holds who sits in which unit, in which job and place, which units hang under which, what is open and who serves a head from beside them, and no shape of `diagram` reads any of it. This design adds an org chart as a shape of `diagram`: one box per person and per open position, framed by the group they sit in, the people marked as humans or agents with the marks the processes page already draws, so the chat on any site whose model writes groups answers the question with the picture public practice draws. It also gives CompanyGraph's own model the one group that is true of it, so companygraph.io has a chart to show.

Status: proposed. Decided on 2026-10-09 with the owner against this repository at `7128d06` (v0.61.0), `companygraph/chat-server` at `1bf8d14` (v0.32.0), `robertblust/design` at `0c384dd` (v0.144.0), `companygraph/meta-model` at `93e13f7` (v0.88.0, core 0.64.0), whose organization pack declares the types read here, and `companygraph/mental-model` at `3748d98`. The owner chose from a mockup drawn with the widget's own Mermaid and settings, from the meta-model's example company and CompanyGraph's proposed group: a box per person rather than per unit; units side by side rather than framed inside the unit above; a person's name in bold with the job on the line below; agents apart from the people of their group, in a frame of their own; and the processes page's two marks on every person. For CompanyGraph's model he chose one team outside the line, in which Mischa Ramseyer's job is Co-Maintainer.

Amended by the owner on October 9, 2026, after the build's review, in five points. First, a line in `links` carries the model's own word for what it draws, so a client can say who leads what without reading the picture: the arrow from one unit's lead to the next is `part-of`, the field that draws it; a person's dashed line to their lead is `Staff`, their place; a staff unit's dashed line is `staff`, its kind's field. The Mermaid source still holds no word, and `nodes` lists each frame before the boxes it holds, an opening being a box whose type is `job`. Second, a group is drawn only from the first day its `start` covers, so a team that forms next month is not in today's chart. Third, `label()` escapes only the colon of Mermaid's icon syntax, and writes it as a colon followed by a zero-width space, `fas:#8203;fa-x`: escaping every colon changed other shapes' sources for no picture that differed, and `#58;` stops a mark in a frame title but not in a box, where Mermaid decodes the entity before it looks for icons. Fourth, the marks are defined once in design's `lib/marks.mjs` and held to the widget's copy by a test; the processes renderer does not read them, since the three sites' processes pages carry their own copies outside any part design writes, and moving those is a change of its own. Fifth, the lead's heavier border and the open box's dash are `classDef`s in the source, so a client without the widget's styles still draws them; `chat.css` adds what only the widget draws.

---

## 1. The gap

The organization pack gives an org chart everything it draws. A group's `## People` names each person, their job and their place, `Lead`, `Deputy`, `Member` or `Staff`; `part-of` hangs a unit under the one above it; a group kind says whether its groups stand in the disciplinary line and whether they serve a head from beside it; `## Openings` names the positions a group is looking to fill; and `rank` is the company's own order of its groups. The pack's specification left the drawing to a consumer, and its README lists a rendered org chart under what is left for later.

No consumer draws it. `diagram`'s eight shapes read concepts, processes, schemas and the software pack, and the neighborhood of a group draws its edges labeled `People.Profile` and `part-of`, with no lead, no line and nothing open. The chat on a site answers "how is the company organized?" with a table.

CompanyGraph's own model does not take the pack, so its chat would have nothing to draw. Its profiles are two people and three agents, and what it publishes about them is a seat each and a line: Robert Blust, "Maintainer of CompanyGraph", and Mischa Ramseyer, "Human in the loop at beacon.build".

**What the change buys is an org chart drawn from the model for any client of an MCP host, a box for every person and every open position, the disciplinary line between the leads, and humans and agents told apart, with companygraph.io as the first site to show one of its own.**

## 2. The shape

`diagram`'s `shape` gains `organization`, a `flowchart TB`, with an optional `id` naming a group. Without one it draws the company; with one, that group.

**Which groups.** A group is drawn while it exists: one without an `end`, or whose `end`, read as R9 reads an end by the last day it covers, is not before the day the tool answers. Without `id`, the shape draws every such group whose kind is in the line. Where the model has none, as a company whose only groups are teams has none, it draws every such group outside the line instead, so the question has an answer in every model that writes a group. A group outside the line is otherwise left out of the company's picture, because the people it gathers already sit in a unit and Mermaid draws a person once; `omitted` counts the groups left out. With `id`, the shape draws that group, and where its kind is in the line, every unit whose `part-of` reaches it, however many steps up.

**The frames.** Each drawn group is a `subgraph`, its title the group's name. The frames stand side by side, never one inside another: the line between the leads carries the hierarchy, and Mermaid lays out frames nested three deep poorly. They are written in the company's order, by `rank` and then by name, a group without a rank after the ranked ones, as the pack orders them.

**The boxes.** Inside a frame, each row of `## People` whose profile is human is one box, the Lead first, then each Deputy, Member and Staff in the order the rows stand. Each row of `## Openings` is one box after them. Then the group's agents, every row whose profile's `nature` is `agent`, stand together in a frame of their own inside the group's, below its people. That inner frame has a blank title and the class `agents`; the checks keep agents out of every unit in the line, so in practice it appears in a team.

A person's label is their name in bold and, on the line below in `<small>`, the job the row's `Job` names; a row without a job has no second line. Before the name stands one of two tokens, `fak:fa-human` or `fak:fa-agent`, read from the profile's `nature`, which Mermaid replaces with the mark the widget registers (§3). A box whose place is `Lead` has the class `lead`. An opening's label is the job in bold and, where `Count` is above one, `<small>× n</small>`; it carries no mark and has the class `open`. The source holds no word of its own in any language, as every shape's source does not: what a dashed box or the inner frame means is the widget's reading line.

**The lines.** Within a frame, an invisible link (`~~~`) from the Lead sets each Deputy, Member and opening below it, so a unit reads from the top without a line to everyone in it. A person whose place is `Staff` is joined to the Lead by a dashed line, `-.-`. An open `Lead` beside a Lead who stays, the search for a successor, gets no invisible link and stands beside them. Between frames, a solid arrow runs from the lead of the unit `part-of` names to the lead of the unit under it; where a unit has no lead, the arrow ends at its open `Lead` box, and failing that at its frame. A unit whose kind is a staff kind is joined to the head it serves by a dashed line instead of an arrow, as a staff unit is drawn beside the head rather than below.

**The answer.** `title` is the group's name with `id`, and `null` without, as `concepts` without a domain. `nodes` names every box: a person as their profile, an opening as its job. An opening is a box of its own each time, so two units looking for the same job draw two boxes that both name it, and `nodes` holds the job once per box. Each frame is in `nodes` too, named `g0`, `g1` and on, as the group it draws, so a client can link a frame without reading the source; the widget links only `n` nodes, as today. `links` holds the arrows and dashed lines with an empty label, and never an invisible link. `edges` counts the lines drawn.

**Refusals.** Past fifty boxes the shape refuses with `cannot_draw` and `too_large`, as `concepts` does, and without `id` the message adds "name a group to draw part of it"; frames are not counted, as a process's phases are counted and not the process. With no group to draw it refuses with `cannot_draw` and `empty`. An `id` that names anything but a group is `invalid_argument`. A model that does not take the organization pack has no `group` type and the shape refuses with `unknown_type`, as every shape refuses a type its model lacks.

**Escaping.** Mermaid reads `fa:fa-`, `fab:fa-`, `fak:fa-`, `far:fa-` and `fas:fa-` anywhere in a label as an icon. `label()` escapes a colon as `#58;`, so a title holding one is never read as a mark. That changes the source of every shape where a title holds a colon and the picture of none.

## 3. The widget

`robertblust/design`'s `chat.js` registers the two marks as an icon pack named `fak` before it draws anything, with `mermaid.registerIconPacks`. They are the marks the processes page draws, a filled figure for a person and an outlined machine for an agent, with the one hue at two brightnesses, `--c-firm` and `--c-mid`, as `tokens.css` allows. Their paths are defined once in the design system and read by both the processes renderer and the widget, so a change to a mark changes it everywhere. Mermaid replaces a token with its mark before it measures the label, so the box fits it; a widget that has not registered the pack shows an empty `<i>`, and the name stands alone.

`chat.css` styles what the source names by class: `.node.lead` with a heavier border, `.node.open` dashed and unfilled, `.cluster.agents` shaded. `wrapNodeName` keeps the mark outside the span it underlines, so a hover underlines the name and not the mark.

The captions gain the shape: "Organization", and in German the word the translator makes from the reviewed English. Under the picture the widget writes its reading line: "Solid arrows run from a lead to the leads below; a dashed line joins staff to the head they serve; a dashed box is an open position, beside a lead the search for a successor; agents stand in the shaded frame." Its German is made by the translator, read by the editor and the back-reader, and settled by the owner, as every string of the widget is.

## 4. The chat

`companygraph/chat-server`'s `DIAGRAM_RULE` in `lib/prompt.mjs` gains one clause: a visitor who asks how the company is organized, who leads what, who works in a group, or for an org chart, is shown shape `organization`, with a group's id where they name one. Where the answer's `omitted` is above zero, the answer says in one sentence that the teams outside the line are drawn when one is named. The shape's name joins the list of shapes the rule gives.

## 5. CompanyGraph's own model

`companygraph/mental-model` takes the organization pack beside the software pack, with the command that adds a pack to an instance, and writes four pages, each `source: Local`:

| Page | What it says |
| --- | --- |
| `group-kinds/team.md` | Team, `in-line: no`: a group gathered for the work of the project, whose people keep whatever they are employed as elsewhere |
| `jobs/maintainer.md` | Maintainer: keeps CompanyGraph, decides what it is for, and gives the word every merge and release waits on |
| `jobs/co-maintainer.md` | Co-Maintainer: maintains CompanyGraph beside the Maintainer, with a say at every gate before Integrate |
| `groups/maintainers.md` | Maintainers, kind Team: Robert Blust, Lead, Maintainer; Mischa Ramseyer, Member, Co-Maintainer; AI Agent, English Voice and German Voice, Members, no job |

The jobs' seats are the ones each profile already holds, Owner and Partner. The model takes nothing it cannot trace to published prose, so Mischa Ramseyer's tagline says the job: "Co-maintainer of CompanyGraph, and the human in the loop at beacon.build", or the words Mischa chooses, since a tagline is the person's own. The English of all four pages is drafted by the writer from this section and reviewed by the owner.

The group is a team and not a unit in the line, because nothing CompanyGraph publishes says it hires, appraises or sets objectives, which `in-line: yes` claims. A company of a maintainer, a co-maintainer and three agents is what the chart then shows, and it is the claim the project makes about itself: people and agents working side by side in one structure.

## 6. The meta-model

`packs/organization/README.md` drops "a rendered org chart" from what is left for later. The README is vendored into every instance that takes the pack, so the change rides with the meta-model's next release rather than one of its own.

## 7. The interface

`shape` takes a new value, which INTERFACE.md counts as additive, in the input enum, the output's and `cannot_draw`'s details. `id` is optional for this shape, as `domain` is for `concepts`, so `TAKES` gains the shape for `id` without the shape that requires it. A node in `nodes` named `g` and a number is new in this shape alone and uses the fields every node has. No field is added. The tool's description in `lib/tools.mjs` names the shape and that a group's id draws part of the company.

## 8. Tests

`test/diagram.test.mjs`, against the meta-model's example at the pinned fixture, which holds Beacon Systems' groups. The whole Mermaid source of the company: Management, Legal, Engineering and Product in rank order; Jonas Whitcombe joined to Ines Marchetti by a dashed line; Legal, a staff unit with only an open Lead, joined to Ines Marchetti by a dashed line ending at that box; Engineering's opening for two Backend Engineers as `× 2`; Product's open Lead beside Tomas Reyes; the Billing Run Team left out with `omitted` at one. The whole source of Billing Run Team by its id, Mira Halvorsen above the AI Agent's frame. Engineering by its id with a unit under it, from a fixture that adds one. A model whose only group is a team, drawn without `id`. A group that has ended, left out, and one ending today, drawn. Every refusal: `too_large` past fifty boxes, `empty`, `invalid_argument` for an id of another type, `unknown_type` on a model without the pack. A title holding `fas:fa-x`, escaped so no mark replaces it.

`test/contract.test.mjs` gains the shape per fixture, parsed against the schema like every other. `deploy/test/tools.mjs` draws `organization` over a deployment's own snapshot where it holds a group, and holds that every node is a profile, a job or a group.

`chat-server`: `test/prompt.test.mjs` holds the new clause.

`design`, in `test/chat-diagram.test.mjs`: both languages carry the caption and the reading line. In Chromium through Playwright, which the suite already drives: a picture of the shape draws each mark in its box and the box wide enough for it; the mark stays outside the underlined name; a box of class `open` is dashed and the `agents` frame shaded; the processes page and the widget draw the same paths.

Before the chat's pull request, the local measurement runs control against change on the host of companygraph.io with the model of §5, with "how is CompanyGraph organized?", "wer arbeitet an CompanyGraph?" and "show me the org chart", and the answers are read, not scored.

## 9. Files

`mcp-server`: `lib/diagram.mjs`, the shape and the colon in `label()`; `lib/schemas.mjs`, `SHAPES`; `lib/tools.mjs`, the description; `scripts/interface.mjs`, an example; `docs/INTERFACE.md`, regenerated; the README's row for `diagram`; the tests of §8. `design`: `assets/chat.js`, `assets/chat.css`, the marks' one definition and `lib/render/processes.mjs` reading it, the tests. `chat-server`: `lib/prompt.mjs`, the pin of `companygraph-mcp-server` its tests run against, the tests. `mental-model`: `.companygraph/manifest.json` and the vendored pack, the four pages of §5, Mischa Ramseyer's profile. `meta-model`: `packs/organization/README.md`.

## 10. Release and order

The tool first: an `mcp-server` release, the next minor after whatever `main` carries when this merges, so agents can ask for the shape. Then `design`'s widget, released and taken by the three sites, which draws the marks for any host that sends them and changes nothing for one that does not. Then `chat-server`'s clause, released and moved into each deployment only after its site has taken the design release, because an older widget would draw the boxes without their marks. `mental-model`'s pages go on their own branch at any time, and the host and site of companygraph.io show them once their pins move. Every merge and every release waits for the owner's word, and the pins move in the family resync the owner starts.

blust.ch and guestgraph.io take the releases and see no change: neither model takes the organization pack, and the shape refuses there with `unknown_type`, which the Answerer answers in words.

## 11. Out of scope

The professional line, a group's `guides`, which names jobs and not people and would draw an arrow from a frame to every box whose job it names; a chart that draws it is its own question. A person who sits in a unit and a team, drawn once in each: Mermaid draws a node once, and the company's picture leaves teams out for that reason. A Team page on the sites, drawn at build time from this shape as the processes page draws from `processDiagram`, which the rename of role to seat promised and which is its own change. A unit's `## Responsibilities` or its tagline in the picture. A chart in the Obsidian plugin.
