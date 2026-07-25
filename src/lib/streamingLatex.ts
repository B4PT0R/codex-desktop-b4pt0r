export type StreamingLatexSegment =
  | { kind: "text"; value: string }
  | { display: boolean; kind: "math"; value: string };

/**
 * Extracts only fully delimited math while a message is streaming. An unmatched
 * opener and everything after it remain literal until a later delta closes it.
 */
export function splitStableStreamingLatex(
  source: string,
): StreamingLatexSegment[] {
  const segments: StreamingLatexSegment[] = [];
  let textStart = 0;
  let index = 0;
  let codeTicks = 0;

  while (index < source.length) {
    if (source[index] === "`") {
      const ticks = runLength(source, index, "`");
      if (codeTicks === 0) codeTicks = ticks;
      else if (ticks === codeTicks) codeTicks = 0;
      index += ticks;
      continue;
    }
    if (codeTicks > 0) {
      index += 1;
      continue;
    }

    const delimiter = openingDelimiter(source, index);
    if (!delimiter) {
      index += 1;
      continue;
    }
    const closeAt = findClosingDelimiter(
      source,
      index + delimiter.open.length,
      delimiter,
    );
    if (closeAt < 0) break;
    if (index > textStart) {
      segments.push({ kind: "text", value: source.slice(textStart, index) });
    }
    segments.push({
      kind: "math",
      display: delimiter.display,
      value: source.slice(index + delimiter.open.length, closeAt),
    });
    index = closeAt + delimiter.close.length;
    textStart = index;
  }

  if (textStart < source.length || segments.length === 0) {
    segments.push({ kind: "text", value: source.slice(textStart) });
  }
  return segments;
}

type Delimiter = {
  close: string;
  display: boolean;
  open: string;
};

function openingDelimiter(
  source: string,
  index: number,
): Delimiter | undefined {
  if (source.startsWith("$$", index) && !isEscaped(source, index)) {
    return { open: "$$", close: "$$", display: true };
  }
  if (source[index] === "$" && !isEscaped(source, index)) {
    return { open: "$", close: "$", display: false };
  }
  if (source.startsWith("\\(", index) && !isEscaped(source, index)) {
    return { open: "\\(", close: "\\)", display: false };
  }
  if (source.startsWith("\\[", index) && !isEscaped(source, index)) {
    return { open: "\\[", close: "\\]", display: true };
  }
  return undefined;
}

function findClosingDelimiter(
  source: string,
  start: number,
  delimiter: Delimiter,
) {
  let cursor = start;
  while (cursor < source.length) {
    const found = source.indexOf(delimiter.close, cursor);
    if (found < 0) return -1;
    if (
      !isEscaped(source, found) &&
      (delimiter.open !== "$" ||
        (source[found - 1] !== "$" && source[found + 1] !== "$"))
    ) {
      return found;
    }
    cursor = found + delimiter.close.length;
  }
  return -1;
}

function isEscaped(source: string, index: number) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function runLength(source: string, start: number, character: string) {
  let end = start + 1;
  while (source[end] === character) end += 1;
  return end - start;
}
