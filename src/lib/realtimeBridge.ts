type RealtimeModule = typeof import("./realtime");

let realtimeModule: Promise<RealtimeModule> | undefined;

function loadRealtime() {
  realtimeModule ??= import("./realtime").catch((error) => {
    realtimeModule = undefined;
    throw error;
  });
  return realtimeModule;
}

export async function startRealtime(
  threadId: string,
  voice: import("./appServerTypes").RealtimeVoice,
  mode: "conversation" | "dictation",
  onFailure?: (error: unknown) => void,
  initialItems: import("./realtimeInstructions").RealtimeInitialItem[] = [],
) {
  const realtime = await loadRealtime();
  await realtime.startRealtime(
    threadId,
    voice,
    mode,
    onFailure,
    initialItems,
  );
}

export async function acceptRealtimeAnswer(threadId: string, sdp: string) {
  if (!realtimeModule) return;
  const realtime = await realtimeModule;
  await realtime.acceptRealtimeAnswer(threadId, sdp);
}

export async function sendRealtimeText(text: string) {
  if (!realtimeModule) {
    throw new Error("No active Realtime conversation is available.");
  }
  const realtime = await realtimeModule;
  await realtime.sendRealtimeText(text);
}

export function playRealtimeAudio(
  threadId: string,
  audio: { data: string; sampleRate: number; numChannels: number },
) {
  if (!realtimeModule) return;
  void realtimeModule.then((realtime) =>
    realtime.playRealtimeAudio(threadId, audio),
  );
}

export async function stopRealtime(notify = true) {
  if (!realtimeModule) return;
  const realtime = await realtimeModule;
  await realtime.stopRealtime(notify);
}
