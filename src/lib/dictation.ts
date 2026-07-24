import { invoke, isDesktopApp } from "./nativeBridge";

const MAX_DICTATION_BYTES = 25 * 1024 * 1024;
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let chunks: Blob[] = [];

export async function startDictationCapture() {
  if (!isDesktopApp())
    throw new Error("Dictation is only available in the desktop app.");
  await stopLocalCapture();
  const nextStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const mimeType = preferredWebmMimeType();
  const nextRecorder = new MediaRecorder(nextStream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 32_000,
  });
  chunks = [];
  nextRecorder.addEventListener("dataavailable", ({ data }) => {
    if (data.size > 0) chunks.push(data);
  });
  nextRecorder.start(250);
  stream = nextStream;
  recorder = nextRecorder;
}

export async function finishDictationCapture(): Promise<string> {
  if (!isDesktopApp())
    throw new Error("Dictation is only available in the desktop app.");
  const activeRecorder = recorder;
  if (!activeRecorder || activeRecorder.state === "inactive") {
    throw new Error("dictation capture is not running");
  }
  await new Promise<void>((resolve, reject) => {
    activeRecorder.addEventListener("stop", () => resolve(), { once: true });
    activeRecorder.addEventListener(
      "error",
      (event) => reject(event.error),
      { once: true },
    );
    activeRecorder.stop();
  });
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  recorder = undefined;
  const audio = new Blob(chunks, { type: "audio/webm" });
  chunks = [];
  if (audio.size === 0 || audio.size > MAX_DICTATION_BYTES) {
    throw new Error("dictation is empty or too long");
  }
  const result = await invoke<{ text: string }>("transcribe_dictation", {
    audio: new Uint8Array(await audio.arrayBuffer()),
  });
  return result.text;
}

function preferredWebmMimeType() {
  return ["audio/webm;codecs=opus", "audio/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

async function stopLocalCapture() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  stream?.getTracks().forEach((track) => track.stop());
  recorder = undefined;
  stream = undefined;
  chunks = [];
}
