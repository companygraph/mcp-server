# CompanyGraph — MCP Server

A read-only MCP server for any CompanyGraph instance. An agent connects to it and asks about
the company the way a person would read the model: which types it declares, what one entity
says, what evidence a profile gives for a skill. Every answer is what the model says at one
commit, verbatim, and the server adds nothing of its own.

It serves a snapshot parsed at build time with the meta-model's own parser, so a new type in
core appears here with no change to this package, and it knows no instance-specific type, name
or fact. The reference instance runs it at `mcp.blust.ch`; the deployment is
`robertblust/mcp-blust-ch`.

The design is in `docs/superpowers/specs/`. Nothing else is built yet.

## License

Apache 2.0. See `LICENSE`.
