// A refusal, as a program reads it. The sentence is the message, as it always was; `code` is one
// of a closed list a client may branch on, `rule` the convention the refusal rests on where one
// does, and `details` the facts the sentence names, under keys the code fixes. The list is
// closed because a client switches on it: a code added is an additive change to the interface,
// a code renamed is a break.
export const CODES = ["unknown_type", "unknown_entity", "ambiguous_name", "unknown_rule", "invalid_argument", "invalid_cursor", "unsupported_snapshot"];

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
