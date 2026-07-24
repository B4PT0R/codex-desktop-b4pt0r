// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useChromium } from "../../src/lib/useChromium";

const missing = {
  available: false,
  installing: false,
  installSupported: true,
  installPackage: "chromium-browser",
};

beforeEach(() => {
  invokeMock.mockReset();
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
});

describe("navigateur Chromium géré", () => {
  it("détecte Chromium puis ne lance l’installation qu’après l’action dédiée", async () => {
    const installed = {
      ...missing,
      available: true,
      executable: "/usr/bin/chromium",
      version: "Chromium 148",
    };
    invokeMock.mockResolvedValueOnce(missing).mockResolvedValueOnce(installed);
    const { result } = renderHook(useChromium);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toEqual(missing);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await act(result.current.install);
    expect(invokeMock).toHaveBeenLastCalledWith("install_chromium", {
      confirmed: true,
    });
    expect(result.current.status).toEqual(installed);
  });

  it("annule une installation en cours", async () => {
    invokeMock
      .mockResolvedValueOnce({ ...missing, installing: true })
      .mockResolvedValueOnce(true);
    const { result } = renderHook(useChromium);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(result.current.cancelInstall);
    expect(invokeMock).toHaveBeenLastCalledWith("cancel_chromium_install");
  });

  it("rend les erreurs de détection récupérables", async () => {
    invokeMock.mockRejectedValueOnce(new Error("status unavailable"));
    const { result } = renderHook(useChromium);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("status unavailable");
    expect(result.current.refresh).toBeTypeOf("function");
  });
});
