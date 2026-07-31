import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MAX_SOURCE_COUNT = 32;
const MAX_SOURCE_BYTES = 1_000_000;
const MAX_DEVELOPER_INSTRUCTION_BYTES = 1_000_000;
const MAX_REALTIME_INSTRUCTION_BYTES = 28_000;
const TRUNCATION_MARKER = "\n\n[... instructions truncated for Realtime ...]\n\n";

export async function readThreadInstructions(sources, developerInstructions) {
  if (!Array.isArray(sources) || sources.length > MAX_SOURCE_COUNT) {
    throw new Error("Invalid thread instruction sources");
  }
  if (
    developerInstructions != null &&
    (typeof developerInstructions !== "string" ||
      Buffer.byteLength(developerInstructions, "utf8") >
        MAX_DEVELOPER_INSTRUCTION_BYTES)
  ) {
    throw new Error("Invalid developer instructions");
  }
  const sections = [];
  if (developerInstructions?.trim()) {
    sections.push(
      `<developer_instructions>\n${developerInstructions}\n</developer_instructions>`,
    );
  }
  let sourceCount = 0;
  for (const source of sources) {
    if (typeof source !== "string" || !path.isAbsolute(source)) continue;
    try {
      const metadata = await stat(source);
      if (!metadata.isFile() || metadata.size > MAX_SOURCE_BYTES) continue;
      const content = await readFile(source, "utf8");
      if (!content.trim()) continue;
      sections.push(
        `<instruction_source path=${JSON.stringify(source)}>\n${content}\n</instruction_source>`,
      );
      sourceCount += 1;
    } catch {
      // Sources may belong to a remote environment or disappear after the
      // App Server loaded them. Realtime can still use the remaining sources.
    }
  }
  if (sections.length === 0) return { content: "", sourceCount: 0 };
  const content = [
    "These are the effective developer instructions and AGENTS.md sources loaded by Codex for this thread. Apply all of them throughout this Realtime conversation. AGENTS.md sources follow their normal hierarchy: later, more specific sources take precedence when guidance conflicts.",
    ...sections,
  ].join("\n\n");
  return {
    content: truncateMiddleUtf8(content, MAX_REALTIME_INSTRUCTION_BYTES),
    sourceCount,
  };
}

function truncateMiddleUtf8(value, maxBytes) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, "utf8");
  const available = Math.max(0, maxBytes - markerBytes);
  const headBytes = Math.ceil(available / 2);
  const tailBytes = Math.floor(available / 2);
  const buffer = Buffer.from(value, "utf8");
  return `${validUtf8Prefix(buffer.subarray(0, headBytes))}${TRUNCATION_MARKER}${validUtf8Suffix(buffer.subarray(buffer.length - tailBytes))}`;
}

function validUtf8Prefix(buffer) {
  while (buffer.length > 0 && (buffer.at(-1) & 0xc0) === 0x80) {
    buffer = buffer.subarray(0, -1);
  }
  return buffer.toString("utf8").replace(/\uFFFD$/, "");
}

function validUtf8Suffix(buffer) {
  let offset = 0;
  while (offset < buffer.length && (buffer[offset] & 0xc0) === 0x80) offset += 1;
  return buffer.subarray(offset).toString("utf8").replace(/^\uFFFD/, "");
}
