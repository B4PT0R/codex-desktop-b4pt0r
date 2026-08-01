// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  invoke: vi.fn(),
  native: true,
  openUrl: vi.fn(),
}));
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: bridge.invoke,
  isDesktopApp: () => bridge.native,
  openUrl: bridge.openUrl,
}));

import { useAppUpdate } from "../../src/lib/useAppUpdate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  bridge.invoke.mockReset();
  bridge.native = true;
  bridge.openUrl.mockReset().mockResolvedValue(undefined);
});

describe("mise à jour de l’application", () => {
  it("lit les versions seulement lorsque Général est ouvert", async () => {
    bridge.invoke.mockResolvedValue({
      clientVersion: "0.3.12",
      codexVersion: "codex-cli 0.145.0",
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useAppUpdate(enabled),
      { initialProps: { enabled: false } },
    );

    expect(bridge.invoke).not.toHaveBeenCalled();
    rerender({ enabled: true });

    await waitFor(() =>
      expect(result.current.versions).toEqual({
        clientVersion: "0.3.12",
        codexVersion: "codex-cli 0.145.0",
      }),
    );
    expect(bridge.invoke).toHaveBeenCalledWith("read_app_versions");
  });

  it("contrôle la release puis ouvre le paquet validé", async () => {
    bridge.invoke.mockImplementation(async (command) => {
      if (command === "read_app_versions") {
        return { clientVersion: "0.3.12" };
      }
      if (command === "check_for_updates") {
        return {
          assetAvailable: true,
          currentVersion: "0.3.12",
          installMode: "automatic",
          latestVersion: "0.3.13",
          packageFormat: "deb",
          releaseUrl:
            "https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v0.3.13",
          updateAvailable: true,
        };
      }
      if (command === "install_update") return { installed: true };
      throw new Error(`Unexpected command: ${command}`);
    });
    const { result } = renderHook(() => useAppUpdate(true));
    await waitFor(() => expect(result.current.versions).toBeDefined());

    await act(async () => {
      expect(await result.current.check()).toBe(true);
    });
    expect(result.current.status?.latestVersion).toBe("0.3.13");

    await act(async () => {
      expect(await result.current.install()).toBe(true);
    });
    expect(bridge.invoke).toHaveBeenCalledWith("install_update", {
      confirmed: true,
    });
    expect(result.current.updateInstalled).toBe(true);
  });

  it("reste informatif mais non mutable dans la preview web", async () => {
    bridge.native = false;
    const { result } = renderHook(() => useAppUpdate(true));

    await waitFor(() =>
      expect(result.current.versions?.clientVersion).toBe(__APP_VERSION__),
    );
    await act(async () => {
      expect(await result.current.check()).toBe(false);
    });
    expect(bridge.invoke).not.toHaveBeenCalled();
  });

  it("ouvre la release validée pour une mise à jour manuelle", async () => {
    bridge.invoke.mockImplementation(async (command) => {
      if (command === "read_app_versions") {
        return { clientVersion: "0.3.12" };
      }
      if (command === "check_for_updates") {
        return {
          assetAvailable: true,
          currentVersion: "0.3.12",
          installMode: "manual",
          latestVersion: "0.3.13",
          packageFormat: "rpm",
          releaseUrl:
            "https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v0.3.13",
          updateAvailable: true,
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const { result } = renderHook(() => useAppUpdate(true));
    await waitFor(() => expect(result.current.versions).toBeDefined());
    await act(async () => expect(await result.current.check()).toBe(true));

    await act(async () => {
      expect(await result.current.install()).toBe(false);
      expect(await result.current.openRelease()).toBe(true);
    });
    expect(bridge.openUrl).toHaveBeenCalledWith(
      "https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v0.3.13",
    );
    expect(bridge.invoke).not.toHaveBeenCalledWith(
      "install_update",
      expect.anything(),
    );
  });

  it("sérialise les contrôles déclenchés dans le même rendu", async () => {
    const pending = deferred<{
      assetAvailable: boolean;
      currentVersion: string;
      installMode: "automatic";
      latestVersion: string;
      packageFormat: "deb";
      releaseUrl: string;
      updateAvailable: boolean;
    }>();
    bridge.invoke.mockImplementation((command) => {
      if (command === "read_app_versions") {
        return Promise.resolve({ clientVersion: "0.3.12" });
      }
      if (command === "check_for_updates") return pending.promise;
      throw new Error(`Unexpected command: ${command}`);
    });
    const { result } = renderHook(() => useAppUpdate(true));
    await waitFor(() => expect(result.current.versions).toBeDefined());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.check();
      expect(await result.current.check()).toBe(false);
    });
    expect(bridge.invoke).toHaveBeenCalledTimes(2);

    pending.resolve({
      assetAvailable: true,
      currentVersion: "0.3.12",
      installMode: "automatic",
      latestVersion: "0.3.13",
      packageFormat: "deb",
      releaseUrl:
        "https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v0.3.13",
      updateAvailable: true,
    });
    await act(async () => expect(await first).toBe(true));
  });

  it("ne relance pas un contrôle pendant une installation", async () => {
    const pendingInstall = deferred<{ installed: boolean }>();
    bridge.invoke.mockImplementation((command) => {
      if (command === "read_app_versions") {
        return Promise.resolve({ clientVersion: "0.3.12" });
      }
      if (command === "check_for_updates") {
        return Promise.resolve({
          assetAvailable: true,
          currentVersion: "0.3.12",
          installMode: "automatic",
          latestVersion: "0.3.13",
          packageFormat: "deb",
          releaseUrl:
            "https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v0.3.13",
          updateAvailable: true,
        });
      }
      if (command === "install_update") return pendingInstall.promise;
      throw new Error(`Unexpected command: ${command}`);
    });
    const { result } = renderHook(() => useAppUpdate(true));
    await waitFor(() => expect(result.current.versions).toBeDefined());
    await act(async () => expect(await result.current.check()).toBe(true));

    let installation!: Promise<boolean>;
    await act(async () => {
      installation = result.current.install();
      expect(await result.current.check()).toBe(false);
      expect(await result.current.install()).toBe(false);
    });
    expect(
      bridge.invoke.mock.calls.filter(([command]) =>
        ["check_for_updates", "install_update"].includes(command),
      ),
    ).toHaveLength(2);

    pendingInstall.resolve({ installed: true });
    await act(async () => expect(await installation).toBe(true));
  });
});
