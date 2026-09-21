# The interface

What a client of this server may rely on: the tools, their arguments, the fields of every answer, the codes of every refusal, how a list is paged, and what counts as a break. It holds for every deployment of the package, since a deployment adds a model and no tool. The schemas it describes are the ones the server registers; a client reads them from the tool listing, or imports them from `companygraph-mcp-server/schemas`.

## Terms

An **id** identifies one entity across the whole model, such as `skills/domain-driven-design`, and every tool that takes an entity takes its id. A **canonical name** is an entity's title, unique within its type and, for an owned type, within its owner, so a name alone can be ambiguous where an id cannot. An **owner** is the entity another is nested under. A **reference** is an edge from one entity to another, and **`via`** names the field or `Section.Column` that drew it, or `nested-in` for nesting. A **qualifier** is a value on a table row that describes that row's edge and draws none of its own.

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

`get_entity` is an entity as structured data, for a client that reasons over the model. `fetch` is the same entity's page as written, the Markdown source, for a client that quotes or displays it, and carries no structured copy. `search` with `match: "name"` answers a name with every entity that carries it, which is the way from a name to an id. `list_entities` browses one type, `list_references` the edges, and `describe_schema` and `describe_relations` what the schemas declare, for one type and for all of them.

## The tools

In the examples an array is cut to its first two entries and a string to 200 characters, and `model` shows placeholders: `core` and `parser` are not real versions and `commit` is not a real commit, so an example's `url` names a file that is not there. Nothing else differs from what the server answered over the meta-model's worked example.

### `list_types`

No arguments. `types` holds every type the schemas declare, with its `owner` type, null where it nests under none, and the `count` of entities it holds.

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
        "type": "concept",
        "name": "Concept Schema",
        "tagline": "Required structure for concept files.",
        "owner": null,
        "count": 8
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

`type`. The schema's `sections` as written and its `relations` as data: `owner`, `owns`, `references`, `referencedBy`, `enums`, `joins`, `lists`. `url` is the schema's own file at the served commit, in the core the instance vendors and not in the meta-model's, since the server answers from the first; it is null where the repository, the commit or the core's place is not known. The file location a schema's first section gives is where an entity of the type is written, which is another file.

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
        "text": "`model/skills/*.md`\n\nA skill owns nothing, so it is a file. Nothing owns a skill either: a profile claims one and a role requires one, and it outlives both.",
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
                "`source`",
                "Yes"
              ],
              [
                "`source-id`",
                "No"
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
          "array": false,
          "required": true,
          "min": 1,
          "max": 1
        }
      ],
      "referencedBy": [
        {
          "from": "experience",
          "via": "skills",
          "form": "ref",
          "array": true,
          "required": false,
          "min": 0,
          "max": null
        },
        {
          "from": "profile",
          "via": "Skills.Skill",
          "form": "ref",
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

Optional `type`, `direction` (`declares`, `declared-to` or `both`; needs `type`) and `via`. `type` narrows `relations`, `ownership`, `enums`, `joins` and `lists` to the one type, `direction` keeps one side of its `relations`, and `via` narrows the two lists that carry one, `relations` and `enums`; `forms` and `reading` always arrive whole, since they explain the terms of whatever part is returned. Not paged: the vocabulary is the size of the core.

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
        "from": "experience",
        "via": "skills",
        "to": "skill",
        "form": "ref",
        "array": true,
        "required": false,
        "min": 0,
        "max": null
      },
      {
        "from": "profile",
        "via": "Skills.Skill",
        "to": "skill",
        "form": "ref",
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
      "roles": "A join: where two rows of the section's table name the same entity in the `by` column, each carries a value in the named column and no two carry the same one, because that value is the only thing tell…",
      "enums": "The values a field or a column typed enum permits, named by `via` as a reference is. A value outside them is an error; `required` reads as it does for a reference."
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

No arguments. `tagline`, and `rules` with each rule's number, `title` and the `part` of the file it stands in. `url` is that file, the `CONVENTIONS.md` beside the schemas at the served commit, null where a schema's would be.

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

`rule`, a number such as `R4`, in either case. The rule's `title`, `part` and `text` as written, and the `url` of the file it stands in, as `list_rules` gives it.

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
    "text": "Not a warning. A reference naming an entity that does not exist, or that exists under a different type, fails the check.\n\nA reference to an owned type is resolved within the owner it is written in: th…",
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

No arguments. `checks` with each check's `name`, the `rule` it cites and that rule's `title`, and `ranBy`, which says who runs them. A list and no verdict.

```json
{
  "tool": "list_checks",
  "arguments": {},
  "answer": {
    "checks": [
      {
        "name": "the container holds what the types imply",
        "rule": "R6",
        "title": "An entity that owns collections is a folder"
      },
      {
        "name": "references resolve",
        "rule": "R4",
        "title": "An unresolvable reference is an error"
      }
    ],
    "ranBy": "The instance's own gate runs these on every change to it, with the checker release its manifest pins, and a commit reaches its main branch only when they pass. They are listed here and not run by this…",
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

`type`; optional `owner`, an id, to keep one owner's entities; `limit` and `cursor`. `entities` in id order, and `page`.

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
        "id": "skills/domain-driven-design",
        "type": "skill",
        "name": "Domain-Driven Design",
        "tagline": "Modeling software around the language the business already speaks.",
        "owner": null
      },
      {
        "id": "skills/java-programming",
        "type": "skill",
        "name": "Java Programming",
        "tagline": "Building and maintaining server-side systems on the JVM.",
        "owner": null
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

### `get_entity`

`id`, or `type` and `name`; given both, the id wins. The entity's `fields`, `sections` and tables, and its edges both ways. `references` and `referencedBy` hold at most 50 edges each, in the order `list_references` gives them; `referenceCounts` holds the true totals, and `list_references` pages the rest. An entity's own content is never cut.

```json
{
  "tool": "get_entity",
  "arguments": {
    "id": "skills/domain-driven-design"
  },
  "answer": {
    "entity": {
      "id": "skills/domain-driven-design",
      "type": "skill",
      "name": "Domain-Driven Design",
      "tagline": "Modeling software around the language the business already speaks.",
      "fields": {
        "source": "Local",
        "group": "Software Design"
      },
      "owner": null,
      "path": "example/model/skills/domain-driven-design.md",
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
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "via": "source",
          "to": {
            "id": "sources/local",
            "type": "source",
            "name": "Local"
          },
          "attrs": {}
        }
      ],
      "referencedBy": [
        {
          "from": {
            "id": "profiles/mira-halvorsen",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Evidence.Skill",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "What it shows": "Split the billing domain into two bounded contexts; the seams have held under two years of change.",
            "Experience": {
              "id": "profiles/mira-halvorsen/experiences/2022-beacon-systems",
              "type": "experience",
              "name": "Splitting the billing domain"
            }
          }
        },
        {
          "from": {
            "id": "profiles/mira-halvorsen",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Skills.Skill",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "Level": {
              "id": "proficiency-levels/competent",
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

Optional `entity`, an id; `direction` (`out`, `in` or `both`, relative to the entity, which it needs); `via`, matched exactly; `type`, the far end's type with an entity and either end's without; `limit` and `cursor`. With no argument it pages through every edge of the model. Edges are ordered by `from.id`, then `via`, then `to.id`.

```json
{
  "tool": "list_references",
  "arguments": {
    "entity": "profiles/mira-halvorsen",
    "direction": "in",
    "via": "nested-in"
  },
  "answer": {
    "edges": [
      {
        "from": {
          "id": "profiles/mira-halvorsen/experiences/2018-northwind-atelier",
          "type": "experience",
          "name": "Rebuilding the order pipeline"
        },
        "via": "nested-in",
        "to": {
          "id": "profiles/mira-halvorsen",
          "type": "profile",
          "name": "Mira Halvorsen"
        },
        "attrs": {}
      },
      {
        "from": {
          "id": "profiles/mira-halvorsen/experiences/2022-beacon-systems",
          "type": "experience",
          "name": "Splitting the billing domain"
        },
        "via": "nested-in",
        "to": {
          "id": "profiles/mira-halvorsen",
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

`skill`, an id or a canonical name, and optionally `limit` and `cursor`. Every edge into the skill, under `evidence`, keyed by the type of the page that drew it; each entry is an edge with that page's `owner` and, where it has one, its `stamp`. The edges are paged in one order, the drawing page's type and then the order `list_references` gives, so `page` counts edges and not groups, and a group the end of a page cuts goes on at the top of the next under the same key.

```json
{
  "tool": "find_evidence",
  "arguments": {
    "skill": "skills/domain-driven-design"
  },
  "answer": {
    "skill": {
      "id": "skills/domain-driven-design",
      "type": "skill",
      "name": "Domain-Driven Design",
      "tagline": "Modeling software around the language the business already speaks."
    },
    "evidence": {
      "experience": [
        {
          "from": {
            "id": "profiles/mira-halvorsen/experiences/2022-beacon-systems",
            "type": "experience",
            "name": "Splitting the billing domain"
          },
          "via": "skills",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {},
          "owner": "profiles/mira-halvorsen",
          "stamp": {
            "kind": "Role",
            "start": "2022-02",
            "end": null
          }
        },
        {
          "from": {
            "id": "profiles/tomas-reyes/experiences/2022-beacon-systems",
            "type": "experience",
            "name": "Deciding which billing goes first"
          },
          "via": "skills",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {},
          "owner": "profiles/tomas-reyes",
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
            "id": "profiles/mira-halvorsen",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Evidence.Skill",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "What it shows": "Split the billing domain into two bounded contexts; the seams have held under two years of change.",
            "Experience": {
              "id": "profiles/mira-halvorsen/experiences/2022-beacon-systems",
              "type": "experience",
              "name": "Splitting the billing domain"
            }
          },
          "owner": null
        },
        {
          "from": {
            "id": "profiles/mira-halvorsen",
            "type": "profile",
            "name": "Mira Halvorsen"
          },
          "via": "Skills.Skill",
          "to": {
            "id": "skills/domain-driven-design",
            "type": "skill",
            "name": "Domain-Driven Design"
          },
          "attrs": {
            "Level": {
              "id": "proficiency-levels/competent",
              "type": "proficiency-level",
              "name": "Competent"
            }
          },
          "owner": null
        }
      ],
      "role": [
        {
          "from": {
            "id": "roles/reviewer",
            "type": "role",
            "name": "Reviewer"
          },
          "via": "requires",
          "to": {
            "id": "skills/domain-driven-design",
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

`query`; optional `match`; `type`, to keep one type's entities; `owner`, an id, to keep one owner's; `limit` and `cursor`. `match: "text"`, the default, is a case-insensitive substring over name, tagline, fields, section text and table cells. `match: "name"` is the exact canonical name, case-insensitive, across types. `matched` says where each result hit: `where` is one of `name`, `tagline`, `field`, `section` or `table`, and `key` the field or section heading, null for the first two. Results are ordered by type, then name, then id: a listing, not a ranking. A result's name is under `title`, as it is for `fetch`, because some clients call only these two tools and require that field.

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
        "id": "profiles/mira-halvorsen",
        "title": "Mira Halvorsen",
        "type": "profile",
        "owner": null,
        "tagline": "Backend engineer who ended up owning the parts nobody else wanted to.",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/profiles/mira-halvorsen/mira-halvorsen.md",
        "matched": [
          {
            "where": "table",
            "key": "Evidence"
          }
        ]
      },
      {
        "id": "roles/backend-engineer",
        "title": "Backend Engineer",
        "type": "role",
        "owner": null,
        "tagline": "The seat that keeps the services the product runs on correct, and answers for them when they are not.",
        "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/roles/backend-engineer.md",
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

### `fetch`

`id`, and nothing else: a name is no id. `text` is the page's Markdown source and `url` its file at the commit, null where the repository is not known.

```json
{
  "tool": "fetch",
  "arguments": {
    "id": "skills/domain-driven-design"
  },
  "answer": {
    "id": "skills/domain-driven-design",
    "title": "Domain-Driven Design",
    "type": "skill",
    "url": "https://github.com/companygraph/meta-model/blob/0123456789abcdef0123456789abcdef01234567/example/model/skills/domain-driven-design.md",
    "text": "---\nsource: Local\ngroup: Software Design\n---\n\n# Domain-Driven Design\n\n> Modeling software around the language the business already speaks.\n\n## In practice\n\nName things as the business names them, and …",
    "model": {
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "repo": "companygraph/meta-model",
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
| `invalid_argument` | an empty query, neither id nor type and name, a direction with nothing to be relative to | `argument`, `reason` |
| `invalid_cursor` | a cursor this server did not write, or one from another commit | `reason`: `malformed` or `other_commit` |
| `unsupported_snapshot` | the snapshot predates what the tool reads | `missing` |

One kind of refusal carries no code. Arguments that fail a tool's input schema, a number where a string belongs or a value outside an enumeration, are refused by the MCP SDK before this package runs, as a sentence alone.

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
      "message": "R2: \"Rebuilding the order pipeline\" is the name of 2 experience entities, one in each of their owners (profiles/mira-halvorsen/experiences/2018-northwind-atelier, profiles/tomas-reyes/experiences/2018…",
      "rule": "R2",
      "details": {
        "type": "experience",
        "name": "Rebuilding the order pipeline",
        "candidates": [
          {
            "id": "profiles/mira-halvorsen/experiences/2018-northwind-atelier",
            "type": "experience",
            "name": "Rebuilding the order pipeline",
            "owner": "profiles/mira-halvorsen"
          },
          {
            "id": "profiles/tomas-reyes/experiences/2018-northwind-atelier",
            "type": "experience",
            "name": "Rebuilding the order pipeline",
            "owner": "profiles/tomas-reyes"
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
