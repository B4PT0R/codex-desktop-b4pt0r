// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const desktopRuntime = vi.hoisted(() => ({ active: false }));
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => desktopRuntime.active,
}));

beforeEach(() => {
  vi.resetModules();
  invokeMock.mockReset();
  localStorage.clear();
  desktopRuntime.active = false;
});

describe("préférences desktop", () => {
  it("utilise localStorage uniquement comme repli navigateur", async () => {
    const { loadDesktopSettings, updateDesktopSettings } =
      await import("../../src/lib/desktopSettings");

    await updateDesktopSettings({
      locale: "en",
      lastWorkspace: "/work/app",
      theme: "light",
      fontSize: "large",
      maxVisibleActionsPerGroup: 4,
      defaultThreadId: "thread-voice",
      realtimeVoice: "juniper",
      sidebarWidth: 320,
    });

    expect(await loadDesktopSettings()).toEqual({
      version: 1,
      locale: "en",
      lastWorkspace: "/work/app",
      theme: "light",
      fontSize: "large",
      maxVisibleActionsPerGroup: 4,
      defaultThreadId: "thread-voice",
      realtimeVoice: "juniper",
      sidebarWidth: 320,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("migre les anciennes clés vers le fichier natif unique", async () => {
    desktopRuntime.active = true;
    localStorage.setItem("codex-desktop.locale", "fr");
    localStorage.setItem("codex-desktop.cwd", "/work/codex");
    invokeMock.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({
      version: 1,
      locale: "fr",
      lastWorkspace: "/work/codex",
    });
    const { loadDesktopSettings } =
      await import("../../src/lib/desktopSettings");

    await expect(loadDesktopSettings()).resolves.toEqual({
      version: 1,
      locale: "fr",
      lastWorkspace: "/work/codex",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "read_desktop_settings");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "update_desktop_settings", {
      patch: { locale: "fr", lastWorkspace: "/work/codex" },
    });
    expect(localStorage.getItem("codex-desktop.locale")).toBeNull();
    expect(localStorage.getItem("codex-desktop.cwd")).toBeNull();
  });
});
