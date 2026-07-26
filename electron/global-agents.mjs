import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";
import { codexHomePath } from "./codex-config.mjs";

const MAX_AGENTS_BYTES = 1_000_000;

export function globalAgentsPath(home, env = process.env) {
  return path.join(codexHomePath(home, env), "AGENTS.md");
}

export async function readGlobalAgents(filePath) {
  await rejectSymbolicLink(filePath);
  const document = await readOptionalFile(filePath);
  validateSize(document.content);
  const overrideFilePath = path.join(path.dirname(filePath), "AGENTS.override.md");
  const override = await readOptionalFile(overrideFilePath);
  validateSize(override.content);
  return {
    content: document.content,
    exists: document.exists,
    filePath,
    overrideActive: override.content.trim().length > 0,
    overrideFilePath,
    version: contentVersion(document.content),
  };
}

export async function writeGlobalAgents(filePath, content, expectedVersion) {
  if (typeof content !== "string") throw new Error("Invalid global AGENTS.md");
  if (typeof expectedVersion !== "string") {
    throw new Error("Global AGENTS.md version is required");
  }
  validateSize(content);
  const current = await readGlobalAgents(filePath);
  if (current.version !== expectedVersion) {
    const error = new Error("Global AGENTS.md changed outside the application");
    error.code = "GLOBAL_AGENTS_CONFLICT";
    throw error;
  }
  const mode = current.exists ? (await stat(filePath)).mode & 0o777 : 0o600;
  await writeFileAtomically(filePath, content, {
    createDirectory: true,
    mode,
  });
  return readGlobalAgents(filePath);
}

async function readOptionalFile(filePath) {
  try {
    return { content: await readFile(filePath, "utf8"), exists: true };
  } catch (error) {
    if (error.code === "ENOENT") return { content: "", exists: false };
    throw error;
  }
}

async function rejectSymbolicLink(filePath) {
  try {
    if ((await lstat(filePath)).isSymbolicLink()) {
      throw new Error("Symbolic global AGENTS.md files are not supported");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function validateSize(content) {
  if (Buffer.byteLength(content, "utf8") > MAX_AGENTS_BYTES) {
    throw new Error("Global AGENTS.md exceeds the 1 MB limit");
  }
}

function contentVersion(content) {
  return createHash("sha256").update(content).digest("hex");
}
