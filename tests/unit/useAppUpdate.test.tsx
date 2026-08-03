// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => true,
  openUrl: vi.fn(),
}));

import { useAppUpdate, type UpdateStatus } from "../../src/lib/useAppUpdate";

const versions = {
  clientVersion: "0.5.4",
  codexCompatible: true,
  codexVersion: "codex-cli 0.146.0",
  minimumCodexVersion: "0.146.0",
};

const status: UpdateStatus = {
  assetAvailable: false,
  currentVersion: "0.5.4",
  installMode: "unavailable",
  latestVersion: "0.5.4",
  packageFormat: "deb",
  releaseUrl: "",
  updateAvailable: false,
  codexUpdate: {
    compatible: true,
    currentVersion: "0.146.0",
    latestVersion: "0.146.0",
    minimumVersion: "0.146.0",
    updateAvailable: false,
  },
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command) => {
    if (command === "read_app_versions" || command === "update_codex") {
      return versions;
    }
    if (command === "check_for_updates") return status;
    throw new Error(`Unexpected command: ${command}`);
  });
});

afterEach(() => vi.useRealTimers());

describe("mises à jour de l’application", () => {
  it("recherche les versions au démarrage puis toutes les heures", async () => {
    vi.useFakeTimers();
    renderHook(() => useAppUpdate(true, true));
    await act(async () => Promise.resolve());
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "check_for_updates")).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);
    });
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "check_for_updates")).toHaveLength(2);
  });

  it("recontrôle les releases après la mise à jour de la CLI", async () => {
    const { result } = renderHook(() => useAppUpdate(true));
    await waitFor(() => expect(result.current.loadingVersions).toBe(false));

    await act(async () => {
      expect(await result.current.updateCodex()).toBe(true);
    });

    expect(invokeMock).toHaveBeenCalledWith("update_codex", {
      confirmed: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("check_for_updates");
    expect(result.current.codexUpdateInstalled).toBe(true);
  });
});
