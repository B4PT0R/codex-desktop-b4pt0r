import { request } from "./codex";
import { realtimeStartParams } from "./protocol";

const SAMPLE_RATE = 24000;
type WebKitAudioGlobal = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};
let connection: RTCPeerConnection | undefined;
let microphone: MediaStream | undefined;
let output: HTMLAudioElement | undefined;
let activeThread: string | undefined;
let audioContext: AudioContext | undefined;
let processor: ScriptProcessorNode | undefined;
let playbackAt = 0;
let failureHandler: ((error: unknown) => void) | undefined;
let failureReported = false;

export async function startRealtime(
  threadId: string,
  onFailure?: (error: unknown) => void,
) {
  await stopRealtime();
  activeThread = threadId;
  failureHandler = onFailure;
  failureReported = false;
  if ("RTCPeerConnection" in globalThis) {
    await startWebRtc(threadId);
    return;
  }
  await startWebSocketAudio(threadId);
}

async function startWebRtc(threadId: string) {
  const pc = new RTCPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
  };
  pc.addTrack(stream.getAudioTracks()[0], stream);
  pc.createDataChannel("oai-events");
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  connection = pc;
  microphone = stream;
  output = audio;
  try {
    await request(
      "thread/realtime/start",
      realtimeStartParams(threadId, { type: "webrtc", sdp: offer.sdp ?? "" }),
    );
  } catch (error) {
    await stopRealtime(false);
    throw error;
  }
}

async function startWebSocketAudio(threadId: string) {
  const Context =
    globalThis.AudioContext ||
    (globalThis as WebKitAudioGlobal).webkitAudioContext;
  if (!Context)
    throw new Error("Le moteur audio WebKitGTK n’est pas disponible.");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const context = new Context();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const node = context.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (event) => {
    if (activeThread !== threadId) return;
    const pcm = resample(
      event.inputBuffer.getChannelData(0),
      context.sampleRate,
      SAMPLE_RATE,
    );
    request("thread/realtime/appendAudio", {
      threadId,
      audio: {
        data: encodePcm(pcm),
        sampleRate: SAMPLE_RATE,
        numChannels: 1,
        samplesPerChannel: pcm.length,
        itemId: null,
      },
    }).catch(reportRealtimeFailure);
  };
  source.connect(node);
  node.connect(context.destination);
  microphone = stream;
  audioContext = context;
  processor = node;
  playbackAt = context.currentTime;
  try {
    await request(
      "thread/realtime/start",
      realtimeStartParams(threadId, { type: "websocket" }),
    );
  } catch (error) {
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

export function playRealtimeAudio(
  threadId: string,
  audio: { data: string; sampleRate: number; numChannels: number },
) {
  if (threadId !== activeThread || connection || !audioContext) return;
  try {
    const bytes = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
    const samples = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++)
      samples[i] = view.getInt16(i * 2, true) / 32768;
    const buffer = audioContext.createBuffer(
      1,
      samples.length,
      audio.sampleRate,
    );
    buffer.copyToChannel(samples, 0);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    playbackAt = Math.max(playbackAt, audioContext.currentTime);
    source.start(playbackAt);
    playbackAt += buffer.duration;
  } catch (error) {
    reportRealtimeFailure(error);
  }
}

export async function stopRealtime(notify = true) {
  const threadId = activeThread;
  activeThread = undefined;
  failureHandler = undefined;
  processor?.disconnect();
  processor = undefined;
  microphone?.getTracks().forEach((track) => track.stop());
  microphone = undefined;
  connection?.close();
  connection = undefined;
  if (output) {
    output.pause();
    output.srcObject = null;
    output = undefined;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = undefined;
  }
  if (notify && threadId)
    try {
      await request("thread/realtime/stop", { threadId });
    } catch {
      /* session may already be closed */
    }
}

function reportRealtimeFailure(error: unknown) {
  if (failureReported) return;
  failureReported = true;
  const handler = failureHandler;
  void stopRealtime(false).catch(() => undefined);
  handler?.(error);
}

export function resample(input: Float32Array, from: number, to: number) {
  const length = Math.round((input.length * to) / from);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = (i * from) / to;
    const left = Math.floor(position);
    const mix = position - left;
    output[i] =
      (input[left] ?? 0) * (1 - mix) +
      (input[left + 1] ?? input[left] ?? 0) * mix;
  }
  return output;
}
export function encodePcm(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, i) =>
    view.setInt16(i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true),
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
