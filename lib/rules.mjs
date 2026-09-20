// The rules a core ships, read out of its CONVENTIONS.md into one entry each. A schema cites a
// rule by its number and says nothing of what it holds, so a reader given schemas alone has the
// citations and not the rules. The file's shape is what R-numbers already lean on everywhere:
// `## <Part>` groups the rules and `### R<n> — <Title>` opens one, which runs to the next
// heading of either depth. A heading inside a fenced block is an example and opens nothing.
const RULE = /^### (R\d+) — (.+)$/;

export function parseRules(text) {
  if (typeof text !== "string") return null;
  const lines = text.split("\n");
  const tagline = [];
  const rules = [];
  let part = null, current = null, fenced = false;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && line.match(RULE);
    if (heading) {
      current = { rule: heading[1], title: heading[2].trim(), part, lines: [] };
      rules.push(current);
    } else if (!fenced && line.startsWith("## ")) {
      part = line.slice(3).trim();
      current = null;
    } else if (current) {
      current.lines.push(line);
    } else if (part === null && line.startsWith(">")) {
      tagline.push(line.replace(/^>\s?/, ""));
    }
  }
  return {
    tagline: tagline.join(" ").trim(),
    rules: rules.map(({ lines: body, ...rule }) => ({ ...rule, text: body.join("\n").trim() })),
  };
}
