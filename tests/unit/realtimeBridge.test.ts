import { describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => ({
  acceptRealtimeAnswer: vi.fn(),
  playRealtimeAudio: vi.fn(),
  startRealtime: vi.fn(),
  stopRealtime: vi.fn(),
}));
vi.mock("../../src/lib/realtime", () => realtime);

import {
  acceptRealtimeAnswer,
  playRealtimeAudio,
  startRealtime,
  stopRealtime,
} from "../../src/lib/realtimeBridge";

describe("chargement différé du realtime", () => {
  it("ne charge le moteur qu’au premier démarrage puis conserve ses opérations", async () => {
    await stopRealtime();
    expect(realtime.stopRealtime).not.toHaveBeenCalled();

    const onFailure = vi.fn();
    await startRealtime("thread-1", onFailure);
    expect(realtime.startRealtime).toHaveBeenCalledWith("thread-1", onFailure);

    await acceptRealtimeAnswer("thread-1", "answer");
    expect(realtime.acceptRealtimeAnswer).toHaveBeenCalledWith(
      "thread-1",
      "answer",
    );

    playRealtimeAudio("thread-1", {
      data: "AA==",
      sampleRate: 24_000,
      numChannels: 1,
    });
    await Promise.resolve();
    expect(realtime.playRealtimeAudio).toHaveBeenCalledOnce();

    await stopRealtime(false);
    expect(realtime.stopRealtime).toHaveBeenCalledWith(false);
  });
});
