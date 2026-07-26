import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "smol-toml";
import { writeFileAtomically } from "./atomic-write.mjs";

const MAX_CONFIG_BYTES = 1_000_000;

export function codexConfigPath(home, env = process.env) {
  return path.join(codexHomePath(home, env), "config.toml");
}

export function codexHomePath(home, env = process.env) {
  const configuredHome = env.CODEX_HOME;
  return (
    typeof configuredHome === "string" && path.isAbsolute(configuredHome)
      ? configuredHome
      : path.join(home, ".codex")
  );
}

export async function readCodexConfig(file) {
  let content = "";
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  validateSize(content);
  return {
    content,
    filePath: file,
    version: contentVersion(content),
  };
}

export async function writeCodexConfig(file, content, expectedVersion) {
  if (typeof content !== "string") throw new Error("Invalid Codex config");
  if (typeof expectedVersion !== "string") {
    throw new Error("Codex config version is required");
  }
  validateSize(content);
  try {
    parse(content);
  } catch (error) {
    throw new Error(
      `Invalid TOML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const current = await readCodexConfig(file);
  if (current.version !== expectedVersion) {
    const error = new Error("Codex config changed outside the application");
    error.code = "CONFIG_CONFLICT";
    throw error;
  }
  await writeFileAtomically(file, content, {
    createDirectory: true,
    mode: 0o600,
  });
  return readCodexConfig(file);
}

function validateSize(content) {
  if (Buffer.byteLength(content, "utf8") > MAX_CONFIG_BYTES) {
    throw new Error("Codex config exceeds the 1 MB limit");
  }
}

function contentVersion(content) {
  return createHash("sha256").update(content).digest("hex");
}
