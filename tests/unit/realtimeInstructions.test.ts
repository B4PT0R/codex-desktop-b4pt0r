import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const isDesktopAppMock = vi.hoisted(() => vi.fn());
const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: isDesktopAppMock,
}));
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { realtimeInstructionItems } from "../../src/lib/realtimeInstructions";

beforeEach(() => {
  invokeMock.mockReset();
  isDesktopAppMock.mockReset().mockReturnValue(true);
  requestMock.mockReset().mockResolvedValue({
    config: { developer_instructions: "Global developer instructions" },
  });
});

describe("instructions initiales Realtime", () => {
  it("convertit les instructions attestées en item développeur", async () => {
    invokeMock.mockResolvedValue({
      content: "Effective AGENTS.md instructions",
      sourceCount: 2,
    });

    await expect(
      realtimeInstructionItems("thread-1", "/workspace"),
    ).resolves.toEqual([
      { role: "developer", text: "Effective AGENTS.md instructions" },
    ]);
    expect(requestMock).toHaveBeenCalledWith("config/read", {
      cwd: "/workspace",
      includeLayers: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("read_thread_instructions", {
      threadId: "thread-1",
      developerInstructions: "Global developer instructions",
    });
  });

  it("reste vide sans source ou hors Electron", async () => {
    requestMock.mockResolvedValue({ config: {} });
    invokeMock.mockResolvedValue({ content: "", sourceCount: 0 });
    await expect(realtimeInstructionItems("thread-1")).resolves.toEqual([]);

    isDesktopAppMock.mockReturnValue(false);
    await expect(realtimeInstructionItems("preview")).resolves.toEqual([]);
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it("n'ouvre pas Realtime si la configuration effective est indisponible", async () => {
    requestMock.mockRejectedValue(new Error("config unavailable"));

    await expect(realtimeInstructionItems("thread-1")).rejects.toThrow(
      "config unavailable",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
