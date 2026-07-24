// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => true,
}));

import { useLaunchAtLogin } from "../../src/lib/useLaunchAtLogin";

beforeEach(() => {
  invokeMock.mockReset();
});

describe("démarrage automatique", () => {
  it("lit l’état système puis applique le choix utilisateur", async () => {
    invokeMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderHook(useLaunchAtLogin);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("read_launch_at_login");

    await act(async () => result.current.setEnabled(false));
    expect(invokeMock).toHaveBeenLastCalledWith("set_launch_at_login", {
      enabled: false,
    });
    expect(result.current.enabled).toBe(false);
  });

  it("conserve une erreur récupérable si le gestionnaire système échoue", async () => {
    invokeMock.mockRejectedValueOnce(new Error("autostart unavailable"));
    const { result } = renderHook(useLaunchAtLogin);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("autostart unavailable");
  });
});
