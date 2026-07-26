import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OPENERS = new Set([
  "vscode",
  "vscode-insiders",
  "cursor",
  "windsurf",
  "none",
]);

export async function openFileReference(args, shell) {
  if (!args || typeof args.path !== "string" || args.path.length > 32_768)
    throw new Error("Invalid file reference");
  if (!OPENERS.has(args.opener)) throw new Error("Unsupported file opener");
  const isAbsoluteTarget = path.isAbsolute(args.path);
  if (
    !isAbsoluteTarget &&
    (typeof args.workspace !== "string" || !path.isAbsolute(args.workspace))
  )
    throw new Error("A workspace is required for relative file references");
  const workspace = isAbsoluteTarget ? undefined : await realpath(args.workspace);
  const candidate = isAbsoluteTarget
    ? args.path
    : path.resolve(workspace, args.path);
  const target = await realpath(candidate);
  const targetStat = await stat(target);
  if (targetStat.isDirectory()) {
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return { path: target, opener: "system", type: "directory" };
  }
  if (!targetStat.isFile())
    throw new Error("File reference is not a file or directory");

  const line = boundedPosition(args.line);
  const column = boundedPosition(args.column);
  const isUtf8Text = await containsUtf8Text(target);
  if (args.opener === "none" || !isUtf8Text) {
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return {
      path: target,
      opener: "system",
      type: "file",
      encoding: isUtf8Text ? "utf-8" : "other",
    };
  }
  const fileUrl = pathToFileURL(target);
  const suffix = line ? `:${line}${column ? `:${column}` : ""}` : "";
  const editorUrl = `${args.opener}://file${fileUrl.pathname}${suffix}`;
  await shell.openExternal(editorUrl);
  return { path: target, opener: args.opener, type: "file", encoding: "utf-8" };
}

async function containsUtf8Text(target) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for await (const chunk of createReadStream(target)) {
      if (chunk.includes(0)) return false;
      decoder.decode(chunk, { stream: true });
    }
    decoder.decode();
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function boundedPosition(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 10_000_000
    ? value
    : undefined;
}
