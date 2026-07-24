// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

beforeEach(() => {
  vi.resetModules();
  invokeMock.mockReset();
  localStorage.clear();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
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
    });

    expect(await loadDesktopSettings()).toEqual({
      version: 1,
      locale: "en",
      lastWorkspace: "/work/app",
      theme: "light",
      fontSize: "large",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("migre les anciennes clés vers le fichier natif unique", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
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
