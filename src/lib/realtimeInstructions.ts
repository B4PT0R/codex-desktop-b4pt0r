import { invoke, isDesktopApp } from "./nativeBridge";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { request } from "./codex";
import { configReadParams } from "./protocol";
import {
  codexDesktopDeveloperInstructions,
  type ClientVersions,
} from "./clientContext";

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
  const versions = await invoke<ClientVersions>("read_app_versions");
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
  const effectiveInstructions = instructions.content.trim();
  return [
    {
      role: "developer",
      text: codexDesktopDeveloperInstructions(effectiveInstructions, versions),
    },
  ];
}
