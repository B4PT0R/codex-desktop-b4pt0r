// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke,
  isDesktopApp: () => true,
}));

import {
  finishDictationCapture,
  startDictationCapture,
} from "../../src/lib/dictation";

let recorder: {
  state: RecordingState;
  listeners: Map<string, (event: never) => void>;
  addEventListener: (type: string, listener: (event: never) => void) => void;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  invoke.mockReset();
  vi.stubGlobal(
    "Blob",
    class {
      size: number;
      type: string;
      constructor(parts: unknown[] = [], options?: { type?: string }) {
        this.size = parts.length;
        this.type = options?.type ?? "";
      }
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3]).buffer;
      }
    },
  );
  const track = { stop: vi.fn() };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [track],
      })),
    },
  });
  recorder = {
    state: "recording",
    listeners: new Map(),
    addEventListener(type, listener) {
      recorder.listeners.set(type, listener);
    },
    start: vi.fn(),
    stop: vi.fn(() => {
      recorder.listeners.get("dataavailable")?.({
        data: new Blob(["audio"]),
      } as never);
      recorder.state = "inactive";
      recorder.listeners.get("stop")?.({} as never);
    }),
  };
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        return recorder;
      }
    },
  );
});

describe("dictée Electron", () => {
  it("capture en WebM puis ne restitue que le texte transcrit", async () => {
    invoke.mockResolvedValue({ text: "bonjour" });

    await startDictationCapture();
    await expect(finishDictationCapture()).resolves.toBe("bonjour");

    expect(invoke).toHaveBeenCalledWith("transcribe_dictation", {
      audio: expect.any(Uint8Array),
    });
  });
});
