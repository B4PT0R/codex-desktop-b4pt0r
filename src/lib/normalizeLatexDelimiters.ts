/**
 * Normalizes the LaTeX delimiters commonly emitted by models to the dollar
 * syntax understood by remark-math. Fenced, indented, and inline code is left
 * untouched so examples and commands remain literal.
 */
export function normalizeLatexDelimiters(markdown: string) {
  let fence: { marker: "`" | "~"; length: number } | undefined;
  return markdown
    .split(/(\n)/)
    .map((part) => {
      if (part === "\n") return part;
      const fenceMatch = part.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const delimiter = fenceMatch[1];
        const marker = delimiter[0] as "`" | "~";
        if (!fence) fence = { marker, length: delimiter.length };
        else if (fence.marker === marker && delimiter.length >= fence.length) {
          fence = undefined;
        }
        return part;
      }
      if (fence || /^( {4}|\t)/.test(part)) return part;
      return normalizeProseLine(part);
    })
    .join("");
}

function normalizeProseLine(line: string) {
  let result = "";
  let index = 0;
  let inlineCodeTicks = 0;

  while (index < line.length) {
    if (line[index] === "`") {
      const run = backtickRun(line, index);
      if (inlineCodeTicks === 0) inlineCodeTicks = run;
      else if (run === inlineCodeTicks) inlineCodeTicks = 0;
      result += line.slice(index, index + run);
      index += run;
      continue;
    }
    if (inlineCodeTicks === 0 && line[index] === "\\") {
      const delimiter = line[index + 1];
      if (delimiter === "(" || delimiter === ")") {
        result += "$";
        index += 2;
        continue;
      }
      if (delimiter === "[" || delimiter === "]") {
        result += "$$";
        index += 2;
        continue;
      }
    }
    result += line[index];
    index += 1;
  }
  const display = result.match(/^(\s*)\$\$(.+)\$\$\s*$/);
  return display ? `${display[1]}$$\n${display[2]}\n${display[1]}$$` : result;
}

function backtickRun(value: string, start: number) {
  let end = start + 1;
  while (value[end] === "`") end += 1;
  return end - start;
}
