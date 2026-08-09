import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const isDesktopAppMock = vi.hoisted(() => vi.fn());
const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: isDesktopAppMock,
}));
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));
vi.mock("../../src/lib/desktopSettings", () => ({
  readDesktopSettingsSnapshot: vi.fn(() => Promise.resolve({ version: 1 })),
}));

import { realtimeInstructionItems } from "../../src/lib/realtimeInstructions";
import { codexDesktopDeveloperInstructions } from "../../src/lib/clientContext";
import { readDesktopSettingsSnapshot } from "../../src/lib/desktopSettings";

const versions = {
  clientVersion: "0.5.1",
  codexVersion: "codex-cli 0.145.0",
};

beforeEach(() => {
  invokeMock.mockReset();
  isDesktopAppMock.mockReset().mockReturnValue(true);
  requestMock.mockReset().mockResolvedValue({
    config: { developer_instructions: "Global developer instructions" },
  });
});

describe("instructions initiales Realtime", () => {
  it("convertit les instructions attestées en item développeur", async () => {
    invokeMock.mockImplementation((method) =>
      method === "read_app_versions"
        ? Promise.resolve(versions)
        : method === "read_desktop_settings"
          ? Promise.resolve({ version: 1 })
        : Promise.resolve({
            content: "Effective AGENTS.md instructions",
            sourceCount: 2,
          }),
    );

    await expect(
      realtimeInstructionItems("thread-1", "/workspace"),
    ).resolves.toEqual([
      {
        role: "developer",
        text: codexDesktopDeveloperInstructions(
          "Effective AGENTS.md instructions",
          versions,
        ),
      },
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

  it("conserve le contexte Desktop sans source et reste vide hors Electron", async () => {
    requestMock.mockResolvedValue({ config: {} });
    invokeMock.mockImplementation((method) =>
      method === "read_app_versions"
        ? Promise.resolve(versions)
        : method === "read_desktop_settings"
          ? Promise.resolve({ version: 1 })
        : Promise.resolve({ content: "", sourceCount: 0 }),
    );
    await expect(realtimeInstructionItems("thread-1")).resolves.toEqual([
      {
        role: "developer",
        text: codexDesktopDeveloperInstructions(undefined, versions),
      },
    ]);

    isDesktopAppMock.mockReturnValue(false);
    await expect(realtimeInstructionItems("preview")).resolves.toEqual([]);
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it("ajoute les instructions vocales non vides sans remplacer le contexte", async () => {
    vi.mocked(readDesktopSettingsSnapshot).mockResolvedValueOnce({
      version: 1,
      realtimeVoiceInstructions: "Parle lentement et sans accent régional.",
    });
    invokeMock.mockImplementation((method) =>
      method === "read_app_versions"
        ? Promise.resolve(versions)
        : Promise.resolve({ content: "Base instructions", sourceCount: 1 }),
    );

    const [item] = await realtimeInstructionItems("thread-voice");
    expect(item.text).toContain("Base instructions");
    expect(item.text).toContain(
      "<voice_instructions>\nParle lentement et sans accent régional.\n</voice_instructions>",
    );
  });

  it("n'ouvre pas Realtime si la configuration effective est indisponible", async () => {
    requestMock.mockRejectedValue(new Error("config unavailable"));

    await expect(realtimeInstructionItems("thread-1")).rejects.toThrow(
      "config unavailable",
    );
    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("read_app_versions");
  });
});
