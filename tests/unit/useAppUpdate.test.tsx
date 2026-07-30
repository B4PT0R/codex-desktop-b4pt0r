// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  invoke: vi.fn(),
  native: true,
}));
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: bridge.invoke,
  isDesktopApp: () => bridge.native,
}));

import { useAppUpdate } from "../../src/lib/useAppUpdate";

beforeEach(() => {
  bridge.invoke.mockReset();
  bridge.native = true;
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
          latestVersion: "0.3.13",
          updateAvailable: true,
        };
      }
      if (command === "install_update") return { opened: true };
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
    expect(result.current.installerOpened).toBe(true);
  });

  it("reste informatif mais non mutable dans la preview web", async () => {
    bridge.native = false;
    const { result } = renderHook(() => useAppUpdate(true));

    await waitFor(() =>
      expect(result.current.versions?.clientVersion).toBe("0.3.13"),
    );
    await act(async () => {
      expect(await result.current.check()).toBe(false);
    });
    expect(bridge.invoke).not.toHaveBeenCalled();
  });
});
