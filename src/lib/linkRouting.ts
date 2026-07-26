export type RoutedLink =
  | { kind: "web"; url: string }
  | { kind: "mailto"; url: string }
  | {
      kind: "file";
      path: string;
      line?: number;
      column?: number;
    }
  | { kind: "anchor" }
  | { kind: "unsupported" };

export function classifyMarkdownLink(href: string): RoutedLink {
  const value = href.trim();
  if (!value || value.startsWith("#")) return { kind: "anchor" };
  if (value.length > 32_768) return { kind: "unsupported" };
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:")
      return { kind: "web", url: url.toString() };
    if (url.protocol === "mailto:")
      return { kind: "mailto", url: url.toString() };
    if (url.protocol === "file:")
      return fileTarget(decodeURIComponent(url.pathname), url.hash);
    return { kind: "unsupported" };
  } catch {
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/:\d+(?::\d+)?$/.test(value))
      return { kind: "unsupported" };
    const hashIndex = value.indexOf("#");
    const path = decodeURIComponent(
      hashIndex >= 0 ? value.slice(0, hashIndex) : value,
    );
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    return fileTarget(path, hash);
  }
}

function fileTarget(pathWithPosition: string, hash: string): RoutedLink {
  let path = pathWithPosition;
  let line = lineFromHash(hash);
  let column: number | undefined;
  const suffix = path.match(/:(\d+)(?::(\d+))?$/);
  if (suffix) {
    path = path.slice(0, -suffix[0].length);
    line ??= positiveInteger(suffix[1]);
    column = positiveInteger(suffix[2]);
  }
  if (!path || path.includes("\0")) return { kind: "unsupported" };
  return {
    kind: "file",
    path,
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
  };
}

function lineFromHash(hash: string) {
  const match = hash.match(/^#L?(\d+)(?:-L?\d+)?$/i);
  return positiveInteger(match?.[1]);
}

function positiveInteger(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
