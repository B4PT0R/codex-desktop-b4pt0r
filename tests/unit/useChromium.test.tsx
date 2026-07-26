// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => true,
}));

import { useChromium } from "../../src/lib/useChromium";

const missing = {
  available: false,
  enabled: false,
  running: false,
  installing: false,
  installSupported: true,
  installPackage: "Playwright Chromium",
};

beforeEach(() => {
  invokeMock.mockReset();
});

describe("navigateur Chromium partagé", () => {
  it("détecte le runtime puis ne lance l’activation qu’après l’action dédiée", async () => {
    const installed = {
      ...missing,
      available: true,
      enabled: true,
      running: true,
      version: "Chrome for Testing 151",
      mcpVersion: "0.0.78",
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

  it("désactive le partage et recharge la configuration MCP", async () => {
    const enabled = {
      ...missing,
      available: true,
      enabled: true,
      running: true,
    };
    const reloadMcp = vi.fn().mockResolvedValue(undefined);
    invokeMock.mockResolvedValueOnce(enabled).mockResolvedValueOnce({
      ...enabled,
      enabled: false,
      running: false,
    });
    const { result } = renderHook(useChromium);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.disable(reloadMcp));
    expect(invokeMock).toHaveBeenLastCalledWith("disable_chromium");
    expect(result.current.status?.enabled).toBe(false);
    expect(reloadMcp).toHaveBeenCalledOnce();
  });

  it("rend les erreurs de détection récupérables", async () => {
    invokeMock.mockRejectedValueOnce(new Error("status unavailable"));
    const { result } = renderHook(useChromium);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("status unavailable");
    expect(result.current.refresh).toBeTypeOf("function");
  });
});
