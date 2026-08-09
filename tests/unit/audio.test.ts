// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import {
  acceptRealtimeAnswer,
  sendRealtimeText,
  startRealtime,
  stopRealtime,
} from "../../src/lib/realtime";

afterEach(async () => {
  await stopRealtime(false);
  vi.unstubAllGlobals();
  requestMock.mockReset();
});

function installWebRtc() {
  const track = { stop: vi.fn() };
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  };
  const eventsChannel = {
    readyState: "open",
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const pc = {
    addTrack: vi.fn(),
    addTransceiver: vi.fn(),
    close: vi.fn(),
    createDataChannel: vi.fn(() => eventsChannel),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0" })),
    setLocalDescription: vi.fn(async () => undefined),
    setRemoteDescription: vi.fn(async () => undefined),
    ontrack: null as ((event: { streams: MediaStream[] }) => void) | null,
  };
  vi.stubGlobal("RTCPeerConnection", class {
    constructor() {
      return pc;
    }
  });
  vi.stubGlobal("Audio", class {
    autoplay = false;
    srcObject: MediaStream | null = null;
    pause = vi.fn();
    play = vi.fn(async () => undefined);
  });
  const getUserMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  requestMock.mockResolvedValue(undefined);
  return { eventsChannel, getUserMedia, pc, stream, track };
}

describe("audio realtime Electron", () => {
  it("négocie WebRTC en mono avec Chromium", async () => {
    const { getUserMedia, pc, stream, track } = installWebRtc();

    await startRealtime("thread-1", "juniper", "conversation");

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        channelCount: { exact: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    expect(pc.addTrack).toHaveBeenCalledWith(track, stream);
    expect(requestMock).toHaveBeenCalledWith(
      "thread/realtime/start",
      expect.objectContaining({
        threadId: "thread-1",
        transport: { type: "webrtc", sdp: "v=0" },
      }),
    );
  });

  it("accepte seulement la réponse SDP de la session active", async () => {
    const { pc } = installWebRtc();
    await startRealtime("thread-1", "juniper", "conversation");

    await acceptRealtimeAnswer("other-thread", "ignored");
    await acceptRealtimeAnswer("thread-1", "answer");

    expect(pc.setRemoteDescription).toHaveBeenCalledOnce();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer",
    });
  });

  it("injecte le texte et déclenche la réponse sur le canal Realtime actif", async () => {
    const { eventsChannel } = installWebRtc();
    await startRealtime("thread-1", "juniper", "conversation");

    await sendRealtimeText("Continue par écrit");

    expect(eventsChannel.send.mock.calls.map(([event]) => JSON.parse(event)))
      .toEqual([
        {
          type: "session.context.append",
          channel: "speakable",
          content: [{ type: "input_text", text: "Continue par écrit" }],
        },
      ]);
  });

  it("refuse le texte quand aucune session Realtime n'est active", async () => {
    await expect(sendRealtimeText("Message perdu")).rejects.toThrow(
      "No active Realtime conversation",
    );
  });

  it("arrête le micro, la connexion et la session distante", async () => {
    const { pc, track } = installWebRtc();
    await startRealtime("thread-1", "juniper", "conversation");

    await stopRealtime();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(pc.close).toHaveBeenCalledOnce();
    expect(requestMock).toHaveBeenLastCalledWith("thread/realtime/stop", {
      threadId: "thread-1",
    });
  });

  it("échoue proprement sans API audio Chromium", async () => {
    await expect(
      startRealtime("thread-1", "juniper", "conversation"),
    ).rejects.toThrow("Realtime audio is unavailable");
  });
});
