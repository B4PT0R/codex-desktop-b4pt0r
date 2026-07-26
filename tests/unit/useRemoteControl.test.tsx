// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import {
  normalizeRemoteControlClients,
  normalizeRemoteControlPairing,
  normalizeRemoteControlStatus,
  useRemoteControl,
} from "../../src/lib/useRemoteControl";

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockClear();
});

describe("contrôle à distance", () => {
  it("hydrate le statut et les appareils, puis applique les notifications", async () => {
    requestMock.mockImplementation(async (method) => {
      if (method === "remoteControl/status/read")
        return {
          status: "connected",
          serverName: "linux-box",
          installationId: "install-1",
          environmentId: "env-1",
        };
      if (method === "remoteControl/client/list")
        return {
          data: [{ clientId: "client-1", displayName: "Téléphone" }],
          nextCursor: null,
        };
      return {};
    });

    const { result } = renderHook(() => useRemoteControl(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status?.status).toBe("connected");
    expect(result.current.clients[0]?.displayName).toBe("Téléphone");

    const handler = subscribeMock.mock.calls[0]?.[0];
    act(() =>
      handler?.({
        method: "remoteControl/status/changed",
        params: {
          status: "disabled",
          serverName: "linux-box",
          installationId: "install-1",
          environmentId: null,
        },
      }),
    );
    expect(result.current.status?.status).toBe("disabled");
    expect(result.current.clients).toEqual([]);
  });

  it("active durablement, crée un pairing et révoque un appareil", async () => {
    requestMock.mockImplementation(async (method) => {
      if (method === "remoteControl/status/read")
        return {
          status: "disabled",
          serverName: "linux-box",
          installationId: "install-1",
          environmentId: null,
        };
      if (method === "remoteControl/enable")
        return {
          status: "connected",
          serverName: "linux-box",
          installationId: "install-1",
          environmentId: "env-1",
        };
      if (method === "remoteControl/client/list")
        return {
          data: [{ clientId: "client-1", displayName: "Téléphone" }],
          nextCursor: null,
        };
      if (method === "remoteControl/pairing/start")
        return {
          pairingCode: "pair-1",
          manualPairingCode: "ABCD-EFGH",
          environmentId: "env-1",
          expiresAt: Math.floor(Date.now() / 1_000) + 300,
        };
      if (method === "remoteControl/pairing/status")
        return { claimed: false };
      return {};
    });
    const { result } = renderHook(() => useRemoteControl(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.enable()).toBe(true);
    });
    expect(requestMock).toHaveBeenCalledWith("remoteControl/enable", {});
    expect(result.current.clients).toHaveLength(1);

    await act(async () => {
      expect(await result.current.startPairing()).toBe(true);
    });
    expect(requestMock).toHaveBeenCalledWith("remoteControl/pairing/start", {
      manualCode: true,
    });
    expect(result.current.pairing?.manualPairingCode).toBe("ABCD-EFGH");

    await act(async () => {
      expect(await result.current.revokeClient("client-1")).toBe(true);
    });
    expect(requestMock).toHaveBeenCalledWith("remoteControl/client/revoke", {
      environmentId: "env-1",
      clientId: "client-1",
    });
    expect(result.current.clients).toEqual([]);
  });

  it("rejette les réponses mal formées à la frontière protocolaire", () => {
    expect(() => normalizeRemoteControlStatus({ status: "unknown" })).toThrow();
    expect(() => normalizeRemoteControlPairing({ pairingCode: 12 })).toThrow();
    expect(() => normalizeRemoteControlClients({ data: [{}] })).toThrow();
  });
});
