import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";

const MAX_AGENTS_BYTES = 1_000_000;

export function workspaceAgentsPath(workspace) {
  if (typeof workspace !== "string" || !path.isAbsolute(workspace)) {
    throw new Error("A valid workspace is required");
  }
  return path.join(path.resolve(workspace), "AGENTS.md");
}

export async function readWorkspaceAgents(workspace) {
  const filePath = workspaceAgentsPath(workspace);
  await rejectSymbolicLink(filePath);
  let content = "";
  let exists = true;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    exists = false;
  }
  validateSize(content);
  return {
    content,
    exists,
    filePath,
    version: contentVersion(content),
  };
}

export async function writeWorkspaceAgents(
  workspace,
  content,
  expectedVersion,
) {
  if (typeof content !== "string") throw new Error("Invalid AGENTS.md content");
  if (typeof expectedVersion !== "string") {
    throw new Error("AGENTS.md version is required");
  }
  validateSize(content);
  const filePath = workspaceAgentsPath(workspace);
  const current = await readWorkspaceAgents(workspace);
  if (current.version !== expectedVersion) {
    const error = new Error("AGENTS.md changed outside the application");
    error.code = "AGENTS_CONFLICT";
    throw error;
  }
  const directory = path.dirname(filePath);
  const directoryStats = await stat(directory);
  if (!directoryStats.isDirectory()) {
    throw new Error("Workspace is not a directory");
  }
  const mode = current.exists ? (await stat(filePath)).mode & 0o777 : 0o644;
  await writeFileAtomically(filePath, content, { mode });
  return readWorkspaceAgents(workspace);
}

async function rejectSymbolicLink(filePath) {
  try {
    if ((await lstat(filePath)).isSymbolicLink()) {
      throw new Error("Symbolic AGENTS.md files are not supported");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function validateSize(content) {
  if (Buffer.byteLength(content, "utf8") > MAX_AGENTS_BYTES) {
    throw new Error("AGENTS.md exceeds the 1 MB limit");
  }
}

function contentVersion(content) {
  return createHash("sha256").update(content).digest("hex");
}
