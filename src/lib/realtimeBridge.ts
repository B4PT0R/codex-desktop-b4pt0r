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
  onFailure?: (error: unknown) => void,
) {
  const realtime = await loadRealtime();
  await realtime.startRealtime(threadId, onFailure);
}

export async function acceptRealtimeAnswer(threadId: string, sdp: string) {
  if (!realtimeModule) return;
  const realtime = await realtimeModule;
  await realtime.acceptRealtimeAnswer(threadId, sdp);
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
