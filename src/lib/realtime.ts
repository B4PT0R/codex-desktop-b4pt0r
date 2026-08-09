import { request } from "./codex";
import { realtimeStartParams } from "./protocol";
import type { RealtimeVoice } from "./appServerTypes";
import type { RealtimeInitialItem } from "./realtimeInstructions";

let connection: RTCPeerConnection | undefined;
let eventsChannel: RTCDataChannel | undefined;
let microphone: MediaStream | undefined;
let output: HTMLAudioElement | undefined;
let activeThread: string | undefined;
let failureHandler: ((error: unknown) => void) | undefined;
let failureReported = false;

export async function startRealtime(
  threadId: string,
  voice: RealtimeVoice,
  mode: "conversation" | "dictation",
  onFailure?: (error: unknown) => void,
  initialItems: RealtimeInitialItem[] = [],
) {
  await stopRealtime();
  if (
    typeof RTCPeerConnection === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Realtime audio is unavailable in this environment.");
  }

  activeThread = threadId;
  failureHandler = onFailure;
  failureReported = false;

  const pc = new RTCPeerConnection();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { exact: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("No microphone audio track is available.");

    if (mode === "dictation") {
      pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
    } else {
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(reportRealtimeFailure);
      };
      pc.addTrack(track, stream);
      output = audio;
    }

    eventsChannel = pc.createDataChannel("oai-events");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    connection = pc;
    microphone = stream;
    await request(
      "thread/realtime/start",
      realtimeStartParams(
        threadId,
        { type: "webrtc", sdp: offer.sdp ?? "" },
        voice,
        mode,
        initialItems,
      ),
    );
  } catch (error) {
    pc.close();
    await stopRealtime(false);
    throw error;
  }
}

export async function sendRealtimeText(text: string) {
  const threadId = activeThread;
  const channel = eventsChannel;
  if (!threadId || !channel) {
    throw new Error("No active Realtime conversation is available.");
  }
  await waitForOpenChannel(channel);
  if (threadId !== activeThread || channel !== eventsChannel) {
    throw new Error("The Realtime conversation ended before the message was sent.");
  }
  channel.send(JSON.stringify({
    type: "session.context.append",
    channel: "speakable",
    content: [{ type: "input_text", text }],
  }));
}

export async function acceptRealtimeAnswer(threadId: string, sdp: string) {
  if (threadId !== activeThread || !connection) return;
  try {
    await connection.setRemoteDescription({ type: "answer", sdp });
  } catch (error) {
    reportRealtimeFailure(error);
  }
}

// WebRTC carries playback directly. This remains a no-op for forward
// compatibility with servers that also emit websocket PCM notifications.
export function playRealtimeAudio(
  _threadId: string,
  _audio: { data: string; sampleRate: number; numChannels: number },
) {}

export async function stopRealtime(notify = true) {
  const threadId = activeThread;
  activeThread = undefined;
  failureHandler = undefined;
  microphone?.getTracks().forEach((track) => track.stop());
  microphone = undefined;
  connection?.close();
  connection = undefined;
  eventsChannel = undefined;
  if (output) {
    output.pause();
    output.srcObject = null;
    output = undefined;
  }
  if (notify && threadId) {
    try {
      await request("thread/realtime/stop", { threadId });
    } catch {
      // The remote session may already be closed.
    }
  }
}

function waitForOpenChannel(channel: RTCDataChannel) {
  if (channel.readyState === "open") return Promise.resolve();
  if (channel.readyState === "closing" || channel.readyState === "closed") {
    return Promise.reject(new Error("The Realtime data channel is closed."));
  }
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The Realtime data channel did not become ready."));
    }, 5_000);
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("The Realtime data channel closed before sending."));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener("open", onOpen);
      channel.removeEventListener("close", onClose);
    };
    channel.addEventListener("open", onOpen, { once: true });
    channel.addEventListener("close", onClose, { once: true });
  });
}

function reportRealtimeFailure(error: unknown) {
  if (failureReported) return;
  failureReported = true;
  const handler = failureHandler;
  void stopRealtime(false).catch(() => undefined);
  handler?.(error);
}
