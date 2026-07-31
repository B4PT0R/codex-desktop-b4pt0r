import { invoke, isDesktopApp } from "./nativeBridge";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { request } from "./codex";
import { configReadParams } from "./protocol";

export type RealtimeInitialItem = {
  role: "developer" | "user" | "assistant";
  text: string;
};

type ThreadInstructions = {
  content: string;
  sourceCount: number;
};

export async function realtimeInstructionItems(
  threadId: string,
  cwd?: string,
): Promise<RealtimeInitialItem[]> {
  if (!isDesktopApp()) return [];
  const response = await request<ConfigReadResponse>(
    "config/read",
    configReadParams(cwd),
  );
  const developerInstructions = appServerString(
    appServerRecord(response.config)?.developer_instructions,
  );
  const instructions = await invoke<ThreadInstructions>(
    "read_thread_instructions",
    { threadId, developerInstructions },
  );
  return instructions.content.trim()
    ? [{ role: "developer", text: instructions.content }]
    : [];
}
