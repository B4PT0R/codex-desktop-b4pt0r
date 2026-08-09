import { invoke, isDesktopApp } from "./nativeBridge";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { request } from "./codex";
import { configReadParams } from "./protocol";
import type { ClientVersions } from "./clientContext";
import { configuredDeveloperInstructions } from "./adultMode";
import { readDesktopSettingsSnapshot } from "./desktopSettings";

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
  const voiceInstructions = (await readDesktopSettingsSnapshot())
    .realtimeVoiceInstructions?.trim();
  const composedInstructions = [
    await configuredDeveloperInstructions(effectiveInstructions, versions),
    voiceInstructions
      ? `<voice_instructions>\n${voiceInstructions}\n</voice_instructions>`
      : undefined,
  ].filter(Boolean).join("\n\n");
  return [
    {
      role: "developer",
      text: composedInstructions,
    },
  ];
}
