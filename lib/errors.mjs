// A refusal, as a program reads it. The sentence is the message, as it always was; `code` is one
// of a closed list a client may branch on, `rule` the convention the refusal rests on where one
// does, and `details` the facts the sentence names, under keys the code fixes. The list is
// closed because a client switches on it: a code added is an additive change to the interface,
// a code renamed is a break.
export const CODES = ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot"];

// When each code is raised, in the words `describe_errors` serves and the interface document's
// table repeats. One copy, keyed by the closed list, so a code cannot be added without its sentence.
export const WHEN = {
  unknown_type: "no schema declares the type",
  unknown_entity: "an id, or a type and name, resolves to nothing",
  ambiguous_name: "more than one entity of the type holds the name",
  unknown_rule: "no rule has the number",
  invalid_argument: "an argument missing, of the wrong type or outside its enumeration; an empty query, neither id nor type and name, a direction with nothing to be relative to",
  invalid_cursor: "a cursor this server did not write, or one from another commit",
  unsupported_snapshot: "the snapshot predates what the tool reads",
};

export class ModelError extends Error {
  constructor(code, message, { rule = null, details = {} } = {}) {
    if (!CODES.includes(code)) throw new TypeError(`"${code}" is no error code; the codes are ${CODES.join(", ")}`);
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.rule = rule;
    this.details = details;
  }
}
