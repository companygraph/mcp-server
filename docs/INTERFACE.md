# The interface

What a client of this server may rely on: the tools, their arguments, the fields of every answer, the codes of every refusal, how a list is paged, and what counts as a break. It holds for every deployment of the package, since a deployment adds a model and no tool. The schemas it describes are the ones the server registers; a client reads them from the tool listing, or imports them from `companygraph-mcp-server/schemas`.

## Terms

An **id** identifies one entity across the whole model, such as `01a02f53-2408-7255-a610-b931d033c1d4`, and stays with it when its page moves. An **address** is where the page sits now, its folder and slug, such as `skills/domain-driven-design`. Every tool that takes an entity takes its id or its address and tries the id first, and every answer gives the id; a page that carries no id has its address as its id. A **canonical name** is an entity's title, unique within its type and, for an owned type, within its owner, so a name alone can be ambiguous where an id cannot. An **owner** is the entity another is nested under; the word is the tools' own, for their `owner` argument and field, and a question about what an owner is asks about the model, which may hold an entity of that name. A **reference** is an edge from one entity to another, and **`via`** names the field or `Section.Column` that drew it, or `nested-in` for nesting. A **qualifier** is a value on a table row that describes that row's edge and draws none of its own.

Nesting on disk is served as an edge from the owned entity to its owner, under `nested-in`. The name is this server's own and no schema declares it, so it never collides with a field: a schema's own `owner` field, a process's owner for one, draws an edge via `owner` like any other reference.

## Shapes every tool shares

| Shape | Fields |
| --- | --- |
| entity reference | `id`, `type`, `name` |
| edge | `from` and `to`, each an entity reference; `via`; `attrs`, the row's other columns verbatim, a resolved qualifier arriving as an entity reference |
| `page` | `total`, the count after filters; `returned`; `hasMore`; `nextCursor`, null when there is none |
| `model` | `commit`, `repo`, `core`, `parser`: where the answer came from, on every answer and every refusal; `commit` and `repo` are null where the model is served from a working tree |

A shape this package builds is closed, and a field it does not declare fails the package's own suite. What the parser builds is open beyond its named fields: an entity, a section, a table, an enum, a join, a list kind, a check. An entity's `fields` and an edge's `attrs` vary by schema and stay open by design.

## Which tool

`get_entity` is an entity as structured data, for a client that reasons over the model. `fetch` is the same entity's page as written, the Markdown source, for a client that quotes or displays it, and carries no structured copy. `search` with `match: "name"` answers a name with every entity that carries it, which is the way from a name to an id. `list_entities` browses one type or every type, in address order or by when entities came into the model, `list_references` the edges, and `describe_schema` and `describe_relations` what the schemas declare, for one type and for all of them. `diagram` draws part of the model as Mermaid, for a client that shows a picture rather than lists the edges.

## The tools

In the examples an array is cut to its first two entries and a string to 200 characters, and `model` shows placeholders: `core` and `parser` are not real versions and `commit` is not a real commit, so an example's `url` names a file that is not there. Nothing else differs from what the server answered over the meta-model's worked example.

### `list_types`

No arguments. `types` holds every type the schemas declare, with its `owner` type, null where it nests under none, and the `count` of entities it holds. The schemas are the core's and those of every pack the instance takes, so a pack's types are listed beside the core's, by their type alone.

```json
{
  "tool": "list_types",
  "arguments": {},
  "answer": {
    "types": [
      {
        "type": "achievement-kind",
        "name": "Achievement Kind Schema",
        "tagline": "Required structure for achievement kind files.",
        "owner": null,
        "count": 4
      },
      {
        "type": "brand",
        "name": "Brand Schema",
        "tagline": "Required structure for the brand file — what the company looks and sounds like.",
        "owner": null,
        "count": 1
      }
    ],
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `describe_schema`

`type`. The schema's `sections` as written and its `relations` as data: `owner`, `owns`, `references`, `referencedBy`, `enums`, `joins`, `lists`. `url` is the schema's own file at the served commit, in the core the instance vendors and not in the meta-model's, since the server answers from the first; it is null where the repository, the commit or the core's place is not known. A pack's schema is its file in the pack's own folder beside the core, `meta/software/bounded-context-schema.md` beside `meta/core/`, and is null too where the core does not sit in a folder named `core`. The file location a schema's first section gives is where an entity of the type is written, which is another file. A reference whose own row names the type it draws, rather than the schema declaring one, carries `to: null` with `by` and `in` naming the columns that carry it, and appears in `referencedBy` for every type, this one included, since it may point at any of them.

```json
{
  "tool": "describe_schema",
  "arguments": {
    "type": "skill"
  },
  "answer": {
    "type": "skill",
    "name": "Skill Schema",
    "tagline": "Required structure for skill files.",
    "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/core/skill-schema.md",
    "sections": [
      {
        "heading": "File Location",
        "text": "`model/skills/*.md`\n\nA skill owns nothing, so it is a file. Nothing owns a skill either: a profile claims one and a seat requires one, and it outlives both.",
        "tables": []
      },
      {
        "heading": "Frontmatter",
        "text": "",
        "tables": [
          {
            "caption": null,
            "columns": [
              "Field",
              "Required"
            ],
            "rows": [
              [
                "`id`",
                "Yes"
              ],
              [
                "`source`",
                "Yes"
              ]
            ]
          }
        ]
      }
    ],
    "relations": {
      "owner": null,
      "owns": [],
      "references": [
        {
          "via": "source",
          "to": "source",
          "form": "ref",
          "by": null,
          "in": null,
          "array": false,
          "required": true,
          "min": 1,
          "max": 1
        }
      ],
      "referencedBy": [
        {
          "from": "control",
          "via": "Applies to.Entity",
          "form": "ref",
          "by": "Type",
          "in": "Owner",
          "array": false,
          "required": true,
          "min": 0,
          "max": null
        },
        {
          "from": "decision",
          "via": "Bears on.Entity",
          "form": "ref",
          "by": "Type",
          "in": "Owner",
          "array": false,
          "required": true,
          "min": 0,
          "max": null
        }
      ],
      "enums": [],
      "joins": [],
      "lists": []
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `describe_relations`

Optional `type`, `direction` (`declares`, `declared-to` or `both`; needs `type`) and `via`. `type` narrows `relations`, `ownership`, `enums`, `joins` and `lists` to the one type, `direction` keeps one side of its `relations`, and `via` narrows the two lists that carry one, `relations` and `enums`; `forms` and `reading` always arrive whole, since they explain the terms of whatever part is returned. Not paged: the vocabulary is the size of the core. A relation's `to` is null where the reference reads its type from its own row instead of the schema declaring one (`by` and `in` name the columns that carry it), and such a relation stands on the declared-to side of every type at once, not only the ones it happens to draw an edge to.

```json
{
  "tool": "describe_relations",
  "arguments": {
    "type": "skill",
    "direction": "declared-to"
  },
  "answer": {
    "relations": [
      {
        "from": "control",
        "via": "Applies to.Entity",
        "to": null,
        "form": "ref",
        "by": "Type",
        "in": "Owner",
        "array": false,
        "required": true,
        "min": 0,
        "max": null
      },
      {
        "from": "decision",
        "via": "Bears on.Entity",
        "to": null,
        "form": "ref",
        "by": "Type",
        "in": "Owner",
        "array": false,
        "required": true,
        "min": 0,
        "max": null
      }
    ],
    "ownership": [],
    "enums": [],
    "joins": [],
    "lists": [],
    "forms": {
      "ref": "A reference. The value is the canonical name of an entity of the named type, it must resolve, and it draws an edge.",
      "ref?": "A reference where it resolves. The value draws an edge when it names an entity of the named type and stays a plain fact when it names anything else.",
      "qualifier": "A qualifier. The value must resolve to an entity of the named type and draws no edge of its own: it is an attribute of the edge its row's reference drew."
    },
    "reading": {
      "required": "Of a frontmatter field, whether a page may leave it out. Of a column or a grouped heading, whether each row or heading must fill it.",
      "min and max": "How many of the reference one page may hold. A field holds one value or a list, and a required list carries at least one entry. A column and a heading are of a row, and nothing bounds how many rows a …",
      "under": "A join: the section's table and the one it stands under reference the same entities, both ways, so nothing here stands under something the other never names and nothing named there is left without a r…",
      "lists": "A join: the entity the column's cell names carries, in the named field, the entity the same row's `by` column names. A blank cell is held to nothing.",
      "as": "A join: where two rows of the section's table name the same entity in the `by` column, each carries a value in the named column and no two carry the same one, because that value is the only thing tell…",
      "enums": "The values a field or a column typed enum permits, named by `via` as a reference is. A value outside them is an error; `required` reads as it does for a reference.",
      "by and in": "A reference whose type is read from its row (R9) rather than declared by the schema: the row's `by` column names the type and, where that type is owned, its `in` column names the owner. `to` is null, …"
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_rules`

No arguments. The vocabulary's conventions, not a company's own rules, which are entities of type `rule`, listed with `list_entities` and read with `get_entity`. `tagline`, and `rules` with each convention's number, `title` and the `part` of the file it stands in. `url` is that file, the `CONVENTIONS.md` beside the schemas at the served commit, null where a schema's would be.

```json
{
  "tool": "list_rules",
  "arguments": {},
  "answer": {
    "tagline": "What makes a graph of Markdown files checkable. Portable across companies by design: a rule that names an issue tracker, a wiki, a chat tool or a mail domain belongs in the instance, not here.",
    "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/core/CONVENTIONS.md",
    "rules": [
      {
        "rule": "R1",
        "title": "One entity per file",
        "part": "Structure"
      },
      {
        "rule": "R2",
        "title": "The canonical name of an entity is its H1",
        "part": "Structure"
      }
    ],
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `describe_rule`

`rule`, a number such as `R4`, in either case. The convention's `title`, `part` and `text` as written, and the `url` of the file it stands in, as `list_rules` gives it.

```json
{
  "tool": "describe_rule",
  "arguments": {
    "rule": "R4"
  },
  "answer": {
    "rule": "R4",
    "title": "An unresolvable reference is an error",
    "part": "Structure",
    "text": "Not a warning. A reference naming an entity that does not exist, or that exists under a different type, fails the check.\n\nA reference whose schema names an owned type, `ref → <type>` and its sibling f…",
    "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/core/CONVENTIONS.md",
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_checks`

No arguments. `checks` with each check's `name`, the `rule` it cites, that rule's `title` and what it `reports`: `failure`, or `note` for a check that states a fact worth seeing and fails nothing. `ranBy` says who runs them. A list and no verdict.

```json
{
  "tool": "list_checks",
  "arguments": {},
  "answer": {
    "checks": [
      {
        "name": "the container holds what the types imply",
        "rule": "R6",
        "title": "An entity that owns collections is a folder",
        "reports": "failure"
      },
      {
        "name": "references resolve",
        "rule": "R4",
        "title": "An unresolvable reference is an error",
        "reports": "failure"
      }
    ],
    "ranBy": "The instance's own gate runs these on every change to it, with the checker release its manifest pins, and a commit reaches its main branch only when every check that reports a failure passes; a check …",
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `describe_errors`

No argument. What a refused call looks like, for a client that reads only the protocol: a tool declares one output schema, which covers its answers, and an error result is exempt from it, so no tool's listing says what a refusal holds. `errors` has every code in the order of the table under Refusals, each with `when` it is raised and `details`, the JSON Schema of that code's details; `schema` is the JSON Schema of a whole refusal, `error` beside `model`. Both are written from the schema this package's suite holds every refusal to, and nothing in the answer but `model` depends on the instance. The example below is cut like every other, which here also shortens `required` and `oneOf`: the served schema requires every field of a refusal and holds every code.

```json
{
  "tool": "describe_errors",
  "arguments": {},
  "answer": {
    "errors": [
      {
        "code": "unknown_type",
        "when": "no schema declares the type",
        "details": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string"
            },
            "declared": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "type",
            "declared"
          ],
          "additionalProperties": false
        }
      },
      {
        "code": "unknown_entity",
        "when": "an id, or a type and name, resolves to nothing",
        "details": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                }
              },
              "required": [
                "id"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                }
              },
              "required": [
                "type",
                "name"
              ],
              "additionalProperties": false
            }
          ]
        }
      }
    ],
    "schema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "error": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "code": {
                  "type": "string",
                  "const": "unknown_type"
                },
                "message": {
                  "type": "string"
                },
                "rule": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "details": {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string"
                    },
                    "declared": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "type",
                    "declared"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "code",
                "message"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "code": {
                  "type": "string",
                  "const": "unknown_entity"
                },
                "message": {
                  "type": "string"
                },
                "rule": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "details": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "id"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string"
                        },
                        "name": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "name"
                      ],
                      "additionalProperties": false
                    }
                  ]
                }
              },
              "required": [
                "code",
                "message"
              ],
              "additionalProperties": false
            }
          ]
        },
        "model": {
          "type": "object",
          "properties": {
            "commit": {
              "type": [
                "string",
                "null"
              ]
            },
            "repo": {
              "type": [
                "string",
                "null"
              ]
            },
            "core": {
              "type": "string"
            },
            "parser": {
              "type": "string"
            }
          },
          "required": [
            "commit",
            "repo"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "error",
        "model"
      ],
      "additionalProperties": false
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_entities`

Optional `type`, which keeps its entities and, left out, lists every type; optional `owner`, an id or an address, to keep one owner's entities; optional `order`, `on`, `by`, `where` and `fields`; `limit` and `cursor`. `entities` and `page`, and `type`, the type named or null where none was. Every entity carries `fields`, the frontmatter facts its schema declares as one value, a date, an enum, a number, a string or a reference that is not an array, as its page writes them, a date at the precision the page states and a reference by the name it writes; `id`, `source`, `source-id` and an `image` are left out, and so is a field the page leaves out. Which fields those are is read from the schema's Frontmatter table, so a field core adds is listed without a release here. `fields`, an array of names, adds others, such as an array, and a name no listed type declares is refused as `invalid_argument`. `order` is `address`, where the pages sit, by default, or `newest` or `oldest`, by `created` and then by the id, `newest` being `oldest` reversed. An entity carries `created` where its id is a UUID version 7: the moment the id was made, in ISO 8601 and UTC to the millisecond. Every id `companygraph id` makes is one, and `companygraph ids` gave each page written before ids existed one from its first commit, so `created` is when the entity came into the model. An entity whose id is not version 7 carries no `created` and, in `newest` or `oldest` order, follows the ones that do, in address order; a list where none carries one is refused as `no_creation_time`, and `address` order lists it.

```json
{
  "tool": "list_entities",
  "arguments": {
    "type": "skill",
    "limit": 2
  },
  "answer": {
    "type": "skill",
    "entities": [
      {
        "id": "01a02f53-2408-7255-a610-b931d033c1d4",
        "type": "skill",
        "name": "Domain-Driven Design",
        "tagline": "Modeling software around the language the business already speaks.",
        "owner": null,
        "created": "2026-08-23T15:52:53.000Z",
        "fields": {
          "group": "Software Design"
        }
      },
      {
        "id": "01a02f53-2408-76c1-aee5-cc97a65fcc78",
        "type": "skill",
        "name": "Java Programming",
        "tagline": "Building and maintaining server-side systems on the JVM.",
        "owner": null,
        "created": "2026-08-23T15:52:53.000Z",
        "fields": {
          "group": "Programming Languages"
        }
      }
    ],
    "page": {
      "total": 3,
      "returned": 2,
      "hasMore": true,
      "nextCursor": "eyJvIjoyLCJjIjoiMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2NyJ9"
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_entities` by newest

Every type, the entity that came into the model last first: the ten newest entities with their taglines are `{ "order": "newest", "limit": 10 }`.

```json
{
  "tool": "list_entities",
  "arguments": {
    "order": "newest",
    "limit": 2
  },
  "answer": {
    "type": null,
    "entities": [
      {
        "id": "01a11fec-8800-7f1d-aefb-030f2f1a31f8",
        "type": "job",
        "name": "Managing Director",
        "tagline": "Leads Beacon Systems and answers for its direction, its results and the departments that carry them out.",
        "owner": null,
        "created": "2026-10-09T09:09:17.440Z",
        "fields": {}
      },
      {
        "id": "01a11fec-87c0-7d80-8aa2-fa64547264dc",
        "type": "profile",
        "name": "Jonas Whitcombe",
        "tagline": "Executive assistant who keeps the managing director's calendar and papers, so that what is decided is also prepared and followed up.",
        "owner": null,
        "created": "2026-10-09T09:09:17.376Z",
        "fields": {
          "nature": "human",
          "email": "jonas@example.invalid",
          "location": "Zurich"
        }
      }
    ],
    "page": {
      "total": 100,
      "returned": 2,
      "hasMore": true,
      "nextCursor": "eyJvIjoyLCJjIjoiMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2NyJ9"
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_entities` on a date

`on`, a date as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, keeps the entities whose period holds it. A period is a type that declares both `start` and `end`. A date coarser than a day stands for every day it covers, so a period holds the date where the two overlap, and a period with no `end` is still running and holds every date from its start. A named type with no period is refused as `invalid_argument`, naming the types that have one; with no type named, only those types are listed. `by` names a date field to order by, in the direction `order` gives, `newest` or `oldest`; a date compares by its first day, equal dates by their ids, and an entity without the field follows in address order. `by` beside `order: "address"`, or naming a field that is not a date, is refused. `where` keeps the entities whose single-valued field equals each value given, ignoring case, a reference by the name its page writes; a field that is not single-valued, or a value that is not a string, is refused. The cursor is an offset into the list these make, and `page.total` counts what they kept. The experiences running in June 2024:

```json
{
  "tool": "list_entities",
  "arguments": {
    "type": "experience",
    "on": "2024-06"
  },
  "answer": {
    "type": "experience",
    "entities": [
      {
        "id": "01a02f53-2408-7b1e-bad3-c39aa223228c",
        "type": "experience",
        "name": "Splitting the billing domain",
        "tagline": "Ongoing. Taking one service that three teams edited and making it two, each owned by one team.",
        "owner": "01a02f53-2408-7291-ac16-087fcdee4d71",
        "created": "2026-08-23T15:52:53.000Z",
        "fields": {
          "kind": "Role",
          "start": "2022-02",
          "organization": "Beacon Systems"
        }
      },
      {
        "id": "01a03a2c-2de8-7b8e-bec7-3618c8fbf2de",
        "type": "experience",
        "name": "Deciding which billing goes first",
        "tagline": "Ongoing. Choosing which of the two billing contexts serves customers first, and saying why.",
        "owner": "01a03a2c-2de8-73b4-9058-8664caea919a",
        "created": "2026-08-25T18:26:09.000Z",
        "fields": {
          "kind": "Role",
          "start": "2022-02",
          "organization": "Beacon Systems"
        }
      }
    ],
    "page": {
      "total": 2,
      "returned": 2,
      "hasMore": false,
      "nextCursor": null
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `get_entity`

`id`, which is an id or an address, or `type` and `name`; given both, the id wins. The entity's `fields`, `sections` and tables, and its edges both ways. An entity whose schema declares an `image` field and that names a picture carries `image_url`, where the site the identity names serves it, at `images/<address>.<extension>`, where `<address>` is the folder and slug the page sits at; an entity without one carries no such key. `references` and `referencedBy` hold at most 50 edges each, in the order `list_references` gives them; `referenceCounts` holds the true totals, and `list_references` pages the rest. An entity's own content is never cut. An entity carries `created` where its id is a UUID version 7, as under `list_entities`.

```json
{
  "tool": "get_entity",
  "arguments": {
    "id": "01a02f53-2408-7255-a610-b931d033c1d4"
  },
  "answer": {
    "entity": {
      "id": "01a02f53-2408-7255-a610-b931d033c1d4",
      "type": "skill",
      "name": "Domain-Driven Design",
      "tagline": "Modeling software around the language the business already speaks.",
      "fields": {
        "id": "01a02f53-2408-7255-a610-b931d033c1d4",
        "source": "Local",
        "group": "Software Design"
      },
      "owner": null,
      "path": "example/model/skills/domain-driven-design.md",
      "created": "2026-08-23T15:52:53.000Z",
      "sections": [
        {
          "heading": "In practice",
          "text": "Name things as the business names them, and refuse a name that only makes sense inside the codebase. Draw the boundary between one model and the next, and hold it when a second team wants to reach acr…",
          "tables": []
        }
      ],
      "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/skills/domain-driven-design.md",
      "references": [
        {
          "from": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "via": "source",
          "to": {
            "id": "01a03a3a-5eb8-7ba4-a6bd-79f024667d98",
            "type": "source",
            "name": "Local"
          },
          "attrs": {}
        }
      ],
      "referencedBy": [
        {
          "from": {
            "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Evidence.Skill",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "What it shows": "Split the billing domain into two bounded contexts; the seams have held under two years of change.",
            "Experience": {
              "id": "01a02f53-2408-7b1e-bad3-c39aa223228c",
              "type": "experience",
              "name": "Splitting the billing domain"
            }
          }
        },
        {
          "from": {
            "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Skills.Skill",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "Level": {
              "id": "01a02f8b-db90-7f26-8c18-79e44090fddb",
              "type": "proficiency-level",
              "name": "Competent"
            }
          }
        }
      ],
      "referenceCounts": {
        "references": 1,
        "referencedBy": 7
      }
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `list_references`

Optional `entity`, an id or an address; `direction` (`out`, `in` or `both`, relative to the entity, which it needs); `via`, matched exactly; `type`, the far end's type with an entity and either end's without; `limit` and `cursor`. With no argument it pages through every edge of the model. Edges are ordered by the address of `from`, where its page sits, then `via`, then the address of `to`; each end still carries its id.

```json
{
  "tool": "list_references",
  "arguments": {
    "entity": "01a02f53-2408-7291-ac16-087fcdee4d71",
    "direction": "in",
    "via": "nested-in"
  },
  "answer": {
    "edges": [
      {
        "from": {
          "id": "01a02f53-2408-729e-aa93-95bce1b59a93",
          "type": "experience",
          "name": "Rebuilding the order pipeline"
        },
        "via": "nested-in",
        "to": {
          "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
          "type": "profile",
          "name": "Mira Halvorsen"
        },
        "attrs": {}
      },
      {
        "from": {
          "id": "01a02f53-2408-7b1e-bad3-c39aa223228c",
          "type": "experience",
          "name": "Splitting the billing domain"
        },
        "via": "nested-in",
        "to": {
          "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
          "type": "profile",
          "name": "Mira Halvorsen"
        },
        "attrs": {}
      }
    ],
    "page": {
      "total": 2,
      "returned": 2,
      "hasMore": false,
      "nextCursor": null
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `find_evidence`

`skill`, an id, a canonical name or an address, and optionally `limit` and `cursor`. Every edge into the skill, under `evidence`, keyed by the type of the page that drew it; each entry is an edge with that page's `owner` and, where it has one, its `stamp`. The edges are paged in one order, the drawing page's type and then the order `list_references` gives, so `page` counts edges and not groups, and a group the end of a page cuts goes on at the top of the next under the same key.

```json
{
  "tool": "find_evidence",
  "arguments": {
    "skill": "01a02f53-2408-7255-a610-b931d033c1d4"
  },
  "answer": {
    "skill": {
      "id": "01a02f53-2408-7255-a610-b931d033c1d4",
      "type": "skill",
      "name": "Domain-Driven Design",
      "tagline": "Modeling software around the language the business already speaks."
    },
    "evidence": {
      "experience": [
        {
          "from": {
            "id": "01a02f53-2408-7b1e-bad3-c39aa223228c",
            "type": "experience",
            "name": "Splitting the billing domain"
          },
          "via": "skills",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {},
          "owner": "01a02f53-2408-7291-ac16-087fcdee4d71",
          "stamp": {
            "kind": "Role",
            "start": "2022-02",
            "end": null
          }
        },
        {
          "from": {
            "id": "01a03a2c-2de8-7b8e-bec7-3618c8fbf2de",
            "type": "experience",
            "name": "Deciding which billing goes first"
          },
          "via": "skills",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {},
          "owner": "01a03a2c-2de8-73b4-9058-8664caea919a",
          "stamp": {
            "kind": "Role",
            "start": "2022-02",
            "end": null
          }
        }
      ],
      "profile": [
        {
          "from": {
            "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Evidence.Skill",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "What it shows": "Split the billing domain into two bounded contexts; the seams have held under two years of change.",
            "Experience": {
              "id": "01a02f53-2408-7b1e-bad3-c39aa223228c",
              "type": "experience",
              "name": "Splitting the billing domain"
            }
          },
          "owner": null
        },
        {
          "from": {
            "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Skills.Skill",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "Level": {
              "id": "01a02f8b-db90-7f26-8c18-79e44090fddb",
              "type": "proficiency-level",
              "name": "Competent"
            }
          },
          "owner": null
        }
      ],
      "seat": [
        {
          "from": {
            "id": "01a0a6b8-7e80-74e2-8c05-e4518d7679c9",
            "type": "seat",
            "name": "Reviewer"
          },
          "via": "requires",
          "to": {
            "id": "01a02f53-2408-7255-a610-b931d033c1d4",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {},
          "owner": null
        }
      ]
    },
    "page": {
      "total": 7,
      "returned": 7,
      "hasMore": false,
      "nextCursor": null
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `search`

`query`; optional `match`; `type`, to keep one type's entities; `owner`, an id or an address, to keep one owner's; `limit` and `cursor`. `match: "text"`, the default, is a case-insensitive substring over name, tagline, fields, section text and table cells. `match: "name"` is the exact canonical name, case-insensitive, across types. `match: "words"` cuts the query into words, reduces each to its stem and keeps every entity whose name, tagline, fields, section text or table cells hold every required stem, anywhere: the words need not stand together or in one place. A word is a run of letters and digits, lowered, with diacritics folded and a possessive's apostrophe-s dropped, so "the owner's" asks for owner. The stemmer is Porter's algorithm for English, which joins the inflections of one word and not its relatives, so deciding meets decide and decided, and decision meets neither. A stem that occurs in more than half of the model's entities is common: it is reported and not required, and a query of common stems alone is held to all of them. A function word outside that set is required like any other, so a client sends the words that carry the meaning and leaves the rest out. A query with no words is refused as `invalid_argument` on `query`. `matched` says where each result hit: `where` is one of `name`, `tagline`, `field`, `section` or `table`, and `key` the field or section heading, null for the first two; in words mode it names each place where a required stem occurs. Results whose name matched come first, then all are ordered by type, name and address: past that one tier a listing, not a ranking, so an entity named by a common word stands before everything that merely mentions it. A result's name is under `title`, as it is for `fetch`, because some clients call only these two tools and require that field. An entity carries `created` where its id is a UUID version 7, as under `list_entities`.

```json
{
  "tool": "search",
  "arguments": {
    "query": "bounded context",
    "limit": 2
  },
  "answer": {
    "query": "bounded context",
    "match": "text",
    "results": [
      {
        "id": "01a02f53-2408-7291-ac16-087fcdee4d71",
        "title": "Mira Halvorsen",
        "type": "profile",
        "owner": null,
        "tagline": "Backend engineer who ended up owning the parts nobody else wanted to.",
        "created": "2026-08-23T15:52:53.000Z",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/profiles/mira-halvorsen/mira-halvorsen.md",
        "matched": [
          {
            "where": "table",
            "key": "Evidence"
          }
        ]
      },
      {
        "id": "01a0a6b8-7e80-7c97-aab2-32e4469383db",
        "title": "Backend Engineer",
        "type": "seat",
        "owner": null,
        "tagline": "The seat that keeps the services the product runs on correct, and answers for them when they are not.",
        "created": "2026-09-15T20:18:24.000Z",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/seats/backend-engineer.md",
        "matched": [
          {
            "where": "section",
            "key": "What it takes"
          }
        ]
      }
    ],
    "page": {
      "total": 2,
      "returned": 2,
      "hasMore": false,
      "nextCursor": null
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `search` with `words`

The same tool in its third mode. Beside `query` and `match` the answer carries `words`, one `{word, stem, common}` per word of the query in the query's order: what the server read, what it searched for, and whether the stem was too common in this model to be required. The field is absent in the other two modes.

```json
{
  "tool": "search",
  "arguments": {
    "query": "decided the billing contexts",
    "match": "words",
    "limit": 2
  },
  "answer": {
    "query": "decided the billing contexts",
    "match": "words",
    "words": [
      {
        "word": "decided",
        "stem": "decid",
        "common": false
      },
      {
        "word": "the",
        "stem": "the",
        "common": true
      }
    ],
    "results": [
      {
        "id": "01a03a2c-2de8-7b8e-bec7-3618c8fbf2de",
        "title": "Deciding which billing goes first",
        "type": "experience",
        "owner": "01a03a2c-2de8-73b4-9058-8664caea919a",
        "tagline": "Ongoing. Choosing which of the two billing contexts serves customers first, and saying why.",
        "created": "2026-08-25T18:26:09.000Z",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/profiles/tomas-reyes/experiences/2022-beacon-systems.md",
        "matched": [
          {
            "where": "name",
            "key": null
          },
          {
            "where": "tagline",
            "key": null
          }
        ]
      },
      {
        "id": "01a03a2c-2de8-73b4-9058-8664caea919a",
        "title": "Tomas Reyes",
        "type": "profile",
        "owner": null,
        "tagline": "Product person who learned to read the code so the conversation with engineering stayed honest.",
        "created": "2026-08-25T18:26:09.000Z",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/profiles/tomas-reyes/tomas-reyes.md",
        "matched": [
          {
            "where": "table",
            "key": "Evidence"
          },
          {
            "where": "section",
            "key": "Summary"
          }
        ]
      }
    ],
    "page": {
      "total": 2,
      "returned": 2,
      "hasMore": false,
      "nextCursor": null
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `fetch`

`id`, and nothing else: a name is no id. `text` is the page's Markdown source and `url` its file at the commit, null where the repository is not known.

```json
{
  "tool": "fetch",
  "arguments": {
    "id": "01a02f53-2408-7255-a610-b931d033c1d4"
  },
  "answer": {
    "id": "01a02f53-2408-7255-a610-b931d033c1d4",
    "title": "Domain-Driven Design",
    "type": "skill",
    "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/skills/domain-driven-design.md",
    "text": "---\nid: 01a02f53-2408-7255-a610-b931d033c1d4\nsource: Local\ngroup: Software Design\n---\n\n# Domain-Driven Design\n\n> Modeling software around the language the business already speaks.\n\n## In practice\n\nNam…",
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `diagram`

A picture of part of the model as Mermaid source, built from its edges and never from prose, or of the schemas it is written in. `shape` is `concepts`, `process`, `neighborhood`, `schema`, `context`, `aggregate`, `flow` or `lifecycle`. `concepts` is a class diagram of every concept and the associations their Relations tables draw, each labeled with its Cardinality and its As; `domain`, a domain's id or address, narrows it to that domain's concepts and any concept outside it they reach, labeled with its own domain's name after its title. `process` takes the `id` of a process and draws its phases in the order of its Phases table, each with who executes it, and an arrow for each `gate-to`, labeled with the gate's approvers, then, where a phase's page holds an If not met table, one dashed arrow per target after it, labeled with the escalation authority and the outcomes that lead there, in table order; a row that leads nowhere is drawn into one Stop node instead, shared by every phase. `neighborhood` takes any `id` and draws that entity with everything one hop from it, one arrow for each `via` and far entity, labeled with the `via` and, where several edges stand behind it, how many; since its nodes mix types a title alone cannot tell apart, each one's first line names its type, `«type»`, set in `<small>` above the title. `schema` is a class diagram of the types the instance's core and the packs it takes declare, each named by its slug, with an association for each reference a schema declares to one type, from the type declaring it, labeled with its field or `Section.Column` and with its multiplicity at the far end, `1`, `0..1`, `0..*` or `1..*`, solid for `ref` and dashed for `ref?` and `qualifier`, and a composition from each owned type to its owner labeled `nested-in`; `type` narrows it to that type and every type it declares, is declared to or nests with, and to those declarations only. `context` takes the `id` of a bounded context and draws its context map: that context, every context its Relationships names and every context naming it, one hop out, as a flowchart from top to bottom, each node's first line `«bounded-context»` and its classification. Each Relationships row is one arrow from the upstream context it names to the downstream context that wrote it, labeled `U → D · ` and the pattern; `partnership`, `shared kernel` and `separate ways` have no upstream side and are one arrow with a head at each end, labeled with the pattern; two rows naming each other with the same one of them draw one arrow, and rows that disagree each keep their own. A context map always holds its middle and is never refused as empty, and its `edges` counts the rows behind its arrows. `aggregate` takes the `id` of an aggregate, or of a bounded context to draw all its aggregates in one picture: a class per root and member, annotated with its kind and the root `aggregate root`, its Attributes as members, a composition from the root to each member with the cardinality the root's Relations gives it, `1`, `0..1`, `*` or `1..*`, other Relations rows between drawn terms as associations, and each event whose `emitted-by` names the aggregate as a class annotated `domain event`, reached by a dashed arrow labeled `emits`; given a context with no aggregate, or an aggregate that holds nothing, it is refused as `empty`. `flow` takes the same `id` and draws a sequence diagram of the commands sent to an aggregate and the events each emits, read from its Handled commands table: a participant for the caller and one for each aggregate, a message from the caller labeled with each command, in the table's order, and a dashed message back for each event the row's `Emits` names. A command of several rows is one `alt`, a branch for each row headed by its `When`, and a branch that emits nothing holds a note of one dash, so a command whose rows all name no event is drawn and never refused. `links` holds one arrow for each event emitted, from the aggregate to the event, labeled `Command · When`, or `Command` where the row has no `When`; the same event emitted by two commands is two links, each labeled with its own command. A context draws its aggregates side by side in name order, those with no handled command left out. `nodes` of a flow holds each aggregate drawn and each event emitted, an event being a message in the source and not a participant. `lifecycle` takes the same `id` and draws a state diagram of the states an aggregate passes through, one transition for each row of its State transitions table in the table's order: a blank From starts at the initial state, a state that no row leaves ends, and a row with no Command is a step the aggregate takes on its own. A state is a word in a cell and no entity, so it is in no node and no link and the answer's `transitions` lists each step instead, `aggregate`, `from`, `to` and `command`, null for a blank From or Command; a context draws each aggregate's states in a composite state under its name, so a state two aggregates share is two states, and the aggregates with no transition are left out. `nodes` of a lifecycle holds the aggregates drawn, and its `edges` counts the transitions. The four shapes the software pack draws, `context`, `aggregate`, `flow` and `lifecycle`, are refused with `unknown_type` on an instance that does not take it, and with `invalid_argument` on `id` for an id of another type. A reference whose type its row names is declared to no one type and is not drawn, and a field every other type declares to one type, as `source` is, would bury the rest, so it is drawn by none and named once in `everyType`, with its `via`, `to` and `multiplicity`; both are counted in `omitted`.

`nodes` says which entity each node of the source is, `n0` and on in the order drawn, so a client links a node without reading the source back; a node of `schema` is a type, with `id` its schema's address, the unit that declares it and the type, `core/phase` for a core type and `software/bounded-context` for a pack's, `type` `schema`, and `url` the schema's file at the served commit, null where that is not known; `links` says the same for each arrow, `from`, `to` and its `label` unescaped, one entry per arrow in the order drawn, so a client states a relation without decoding Mermaid; `title` is the name of what is drawn, null for every concept and for every type; `edges` counts the edges drawn and `omitted` those left out. A process's dashed arrow to a phase is an edge like the ones `gate-to` draws and is counted the same way, in `links` and in `edges`; its dashed arrow into the Stop node is not, since the Stop node is no entity and is never in `nodes`, so neither it nor an arrow into it is ever in `links` or counted in `edges`. A picture holds fifty nodes besides a neighborhood's middle. A neighborhood takes its groups of arrows smallest first, leaves out whole any group that does not fit, and names those on a last node, `more`, which is not in `nodes`. A concepts, process, schema, context, aggregate, flow or lifecycle diagram that would hold more is refused as `cannot_draw` with `reason: "too_large"`, and a concepts, process, schema, aggregate, flow or lifecycle diagram with nothing to draw with `reason: "empty"`, which a context map never is; a flow holds the caller, each aggregate and each message towards that count, and a lifecycle each state; a context's `aggregate`, `flow` or `lifecycle` with nothing to draw is `cannot_draw` with `reason: "empty"`.

```json
{
  "tool": "diagram",
  "arguments": {
    "shape": "process",
    "id": "01a0a8c7-74d8-7c00-b7dd-6a8118ddc0d3"
  },
  "answer": {
    "shape": "process",
    "title": "Delivery",
    "mermaid": "flowchart LR\n  n0[\"<b>Specify</b><br/><small>Backend Engineer</small>\"]\n  n1[\"<b>Build</b><br/><small>Backend Engineer, Reviewer</small>\"]\n  n2[\"<b>Release</b><br/><small>Reviewer</small>\"]\n  n0 -->|\"…",
    "nodes": [
      {
        "node": "n0",
        "id": "01a0a8c7-74d8-7c8a-9e3a-0d72ef94fce1",
        "title": "Specify",
        "type": "phase"
      },
      {
        "node": "n1",
        "id": "01a0a8c7-74d8-774b-ad7c-383aad1f52ec",
        "title": "Build",
        "type": "phase"
      }
    ],
    "links": [
      {
        "from": "n0",
        "to": "n1",
        "label": "Reviewer"
      },
      {
        "from": "n1",
        "to": "n2",
        "label": "Reviewer"
      }
    ],
    "edges": 4,
    "omitted": 0,
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `diagram` of a context

```json
{
  "tool": "diagram",
  "arguments": {
    "shape": "context",
    "id": "01a0ffff-0000-7000-8000-0000000000bc"
  },
  "answer": {
    "shape": "context",
    "title": "Quoting",
    "mermaid": "flowchart TB\n  n0[\"<small>«bounded-context» · core</small><br/><b>Quoting</b>\"]\n  n1[\"<small>«bounded-context» · supporting</small><br/>Catalog\"]\n  n2[\"<small>«bounded-context» · core</small><br/>Invo…",
    "nodes": [
      {
        "node": "n0",
        "id": "01a0ffff-0000-7000-8000-0000000000bc",
        "title": "Quoting",
        "type": "bounded-context"
      },
      {
        "node": "n1",
        "id": "01a0ffff-0000-7000-8000-000000000101",
        "title": "Catalog",
        "type": "bounded-context"
      }
    ],
    "links": [
      {
        "from": "n1",
        "to": "n0",
        "label": "U → D · conformist"
      },
      {
        "from": "n2",
        "to": "n0",
        "label": "shared kernel"
      }
    ],
    "edges": 4,
    "omitted": 0,
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/pack-instance",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `diagram` of its aggregates

```json
{
  "tool": "diagram",
  "arguments": {
    "shape": "aggregate",
    "id": "01a0ffff-0000-7000-8000-0000000000bc"
  },
  "answer": {
    "shape": "aggregate",
    "title": "Quoting",
    "mermaid": "classDiagram\n  class n0[\"Price list\"] {\n    <<aggregate root>>\n  }\n  class n1[\"Money\"] {\n    <<value object>>\n    Amount : decimal\n    Currency : ISO 4217 code\n  }\n  class n2[\"Quote\"] {\n    <<aggregat…",
    "nodes": [
      {
        "node": "n0",
        "id": "01a0ffff-0000-7000-8000-000000000126",
        "title": "Price list",
        "type": "concept-design"
      },
      {
        "node": "n1",
        "id": "01a0ffff-0000-7000-8000-000000000123",
        "title": "Money",
        "type": "concept-design"
      }
    ],
    "links": [
      {
        "from": "n0",
        "to": "n1",
        "label": "*"
      },
      {
        "from": "n2",
        "to": "n3",
        "label": "1..*"
      }
    ],
    "edges": 7,
    "omitted": 0,
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/pack-instance",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `diagram` of its flow

```json
{
  "tool": "diagram",
  "arguments": {
    "shape": "flow",
    "id": "01a0ffff-0000-7000-8000-0000000000bc"
  },
  "answer": {
    "shape": "flow",
    "title": "Quoting",
    "mermaid": "sequenceDiagram\n  participant caller as Caller\n  participant n0 as Price list\n  participant n1 as Quote\n  caller->>n0: Publish price list\n  caller->>n1: Send quote\n  n1--)caller: Quote sent\n  caller->…",
    "nodes": [
      {
        "node": "n0",
        "id": "01a0ffff-0000-7000-8000-000000000112",
        "title": "Price list",
        "type": "aggregate"
      },
      {
        "node": "n1",
        "id": "01a0ffff-0000-7000-8000-000000000111",
        "title": "Quote",
        "type": "aggregate"
      }
    ],
    "links": [
      {
        "from": "n1",
        "to": "n2",
        "label": "Send quote"
      },
      {
        "from": "n1",
        "to": "n3",
        "label": "Accept quote · the customer signs before it expires"
      }
    ],
    "edges": 2,
    "omitted": 0,
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/pack-instance",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

### `diagram` of its lifecycle

```json
{
  "tool": "diagram",
  "arguments": {
    "shape": "lifecycle",
    "id": "01a0ffff-0000-7000-8000-0000000000bc"
  },
  "answer": {
    "shape": "lifecycle",
    "title": "Quoting",
    "mermaid": "stateDiagram-v2\n  state \"Quote\" as n0 {\n    state \"Sent\" as s0\n    state \"Accepted\" as s1\n    state \"Expired\" as s2\n    [*] --> s0 : Send quote\n    s0 --> s1 : Accept quote\n    s0 --> s2\n    s1 --> [*…",
    "nodes": [
      {
        "node": "n0",
        "id": "01a0ffff-0000-7000-8000-000000000111",
        "title": "Quote",
        "type": "aggregate"
      }
    ],
    "links": [],
    "transitions": [
      {
        "aggregate": "Quote",
        "from": null,
        "to": "Sent",
        "command": "Send quote"
      },
      {
        "aggregate": "Quote",
        "from": "Sent",
        "to": "Accepted",
        "command": "Accept quote"
      }
    ],
    "edges": 3,
    "omitted": 0,
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/pack-instance",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

## Paging

`list_entities`, `list_references`, `find_evidence` and `search` take `limit`, 50 by default, at least 1 and 200 at most, and `cursor`. A limit outside the range is served at the nearest bound and not refused, so `limit: 0` returns one entry and `limit: 1000` returns 200; `page.returned` says how many came back. Both arguments say so themselves in every paged tool's input schema. Follow `page.nextCursor` while `page.hasMore`. The order of each list is fixed and a served model never changes, so a walk neither repeats nor skips.

A cursor is opaque. It belongs to one commit of the model: sent after the deployment moved to another, it is refused as `invalid_cursor` with the reason `other_commit`, and the walk starts again. What is not detected is a cursor sent with other arguments than the call that produced it, or to another tool; the answer is then a page of the wrong list, so a client keeps its tool and its arguments unchanged for the length of a walk.

## Refusals

A refused call is a tool error. Its text is a sentence for a reader, and its structured content is the same refusal for a program: `error.code`, `error.message`, `error.rule`, the convention it rests on or null, and `error.details`, whose keys the code fixes. `model` stands beside `error`. `describe_errors` serves this section to a client as data: the codes, when each is raised, and the refusal's JSON Schema.

| Code | When | `details` |
| --- | --- | --- |
| `unknown_type` | no schema declares the type | `type`, `declared` |
| `unknown_entity` | an id, or a type and name, resolves to nothing | `id`, or `type` and `name` |
| `ambiguous_name` | more than one entity of the type holds the name | `type`, `name`, `candidates`: entity references, each with `owner` |
| `unknown_rule` | no rule has the number | `rule`, `rules` |
| `invalid_argument` | an argument missing, of the wrong type or outside its enumeration; an empty query, neither id nor type and name, a direction with nothing to be relative to | `argument`, `reason` |
| `invalid_cursor` | a cursor this server did not write, or one from another commit | `reason`: `malformed` or `other_commit` |
| `unsupported_snapshot` | the snapshot predates what the tool reads | `missing` |
| `cannot_draw` | a diagram would draw nothing, or more nodes than it holds | `shape`, `reason`: `too_large` or `empty`, `nodes`, `limit` |
| `no_creation_time` | an order by when entities came into the model, over a list whose ids carry no time | `order`: `newest` or `oldest`, `type`: the type named or null |

Arguments that fail a tool's input schema, a missing one, a number where a string belongs or a value outside an enumeration, are refused like any other: `invalid_argument`, with the `argument` at fault and the `reason`. Where several are at fault the sentence names each and `details` holds the first. An argument no schema names is ignored and not refused. What carries no code is what never reaches a tool: a tool name nobody registered and a request that is not the protocol's are answered by the MCP SDK as JSON-RPC errors, not as tool results.

### A refusal

The worked example holds no ambiguous name, so this refusal is answered over a copy of it in which a second profile is given an experience under the first one's title. The second candidate's id exists only in that copy.

```json
{
  "tool": "get_entity",
  "arguments": {
    "type": "experience",
    "name": "Rebuilding the order pipeline"
  },
  "answer": {
    "error": {
      "code": "ambiguous_name",
      "message": "R2: \"Rebuilding the order pipeline\" is the name of 2 experience entities, one in each of their owners (01a02f53-2408-729e-aa93-95bce1b59a93, 01a0ffff-0000-7000-8000-000000000001); ask for the one mean…",
      "rule": "R2",
      "details": {
        "type": "experience",
        "name": "Rebuilding the order pipeline",
        "candidates": [
          {
            "id": "01a02f53-2408-729e-aa93-95bce1b59a93",
            "type": "experience",
            "name": "Rebuilding the order pipeline",
            "owner": "01a02f53-2408-7291-ac16-087fcdee4d71"
          },
          {
            "id": "01a0ffff-0000-7000-8000-000000000001",
            "type": "experience",
            "name": "Rebuilding the order pipeline",
            "owner": "01a03a2c-2de8-73b4-9058-8664caea919a"
          }
        ]
      }
    },
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
      "core": "0.0.0",
      "parser": "v0.0.0"
    }
  }
}
```

## What counts as a break

**Breaking: a tool's name; an argument's name or meaning; a required output field's name or type; an error code or the keys of its details; the order of a paged list; how an id is formed.** Additive: a new tool, a new optional argument, a new output field, a new error code. Below 1.0 a minor release may break; every release that does names each break in its notes under a heading of its own, `Interface`, and a release that leaves the interface alone says so there in one line.
