// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import {
  encodePcm,
  playRealtimeAudio,
  resample,
  startRealtime,
  stopRealtime,
} from "../../src/lib/realtime";

afterEach(async () => {
  await stopRealtime(false);
  vi.unstubAllGlobals();
  requestMock.mockReset();
});
describe("audio realtime", () => {
  it("rééchantillonne vers 24 kHz", () =>
    expect(resample(new Float32Array(480), 48000, 24000)).toHaveLength(240));
  it("encode en PCM16 little-endian", () => {
    const bytes = Uint8Array.from(
      atob(encodePcm(new Float32Array([-1, 0, 1]))),
      (c) => c.charCodeAt(0),
    );
    expect([...bytes]).toEqual([1, 128, 0, 0, 255, 127]);
  });
  it("sature hors plage", () =>
    expect(encodePcm(new Float32Array([-2, 2]))).toBe(
      encodePcm(new Float32Array([-1, 1])),
    ));

  it("arrête et signale une seule fois un flux audio illisible", async () => {
    const close = vi.fn(async () => undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0;
        destination = {};
        sampleRate = 48_000;
        close = close;
        resume = vi.fn(async () => undefined);
        createMediaStreamSource = () => ({ connect: vi.fn() });
        createScriptProcessor = () => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        });
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    requestMock.mockResolvedValue(undefined);
    const onFailure = vi.fn();

    await startRealtime("thread-1", onFailure);
    playRealtimeAudio("thread-1", {
      data: "%%%",
      sampleRate: 24_000,
      numChannels: 1,
    });
    playRealtimeAudio("thread-1", {
      data: "%%%",
      sampleRate: 24_000,
      numChannels: 1,
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
