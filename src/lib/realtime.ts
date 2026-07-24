import { request } from "./codex";
import { realtimeStartParams } from "./protocol";
import type { RealtimeVoice } from "./appServerTypes";

let connection: RTCPeerConnection | undefined;
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

    pc.createDataChannel("oai-events");
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
      ),
    );
  } catch (error) {
    pc.close();
    await stopRealtime(false);
    throw error;
  }
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

function reportRealtimeFailure(error: unknown) {
  if (failureReported) return;
  failureReported = true;
  const handler = failureHandler;
  void stopRealtime(false).catch(() => undefined);
  handler?.(error);
}
