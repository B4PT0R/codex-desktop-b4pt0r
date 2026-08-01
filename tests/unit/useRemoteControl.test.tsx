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

  it("ignore une liste d'appareils devenue obsolète après désactivation", async () => {
    let resolveClients:
      | ((value: {
          data: { clientId: string; displayName: string }[];
          nextCursor: null;
        }) => void)
      | undefined;
    requestMock.mockImplementation((method) => {
      if (method === "remoteControl/status/read")
        return Promise.resolve({
          status: "connected",
          serverName: "linux-box",
          installationId: "install-1",
          environmentId: "env-1",
        });
      if (method === "remoteControl/client/list")
        return new Promise((resolve) => {
          resolveClients = resolve;
        });
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useRemoteControl(true));
    await waitFor(() => expect(resolveClients).toBeTypeOf("function"));

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
    await act(async () => {
      resolveClients?.({
        data: [{ clientId: "stale", displayName: "Ancien appareil" }],
        nextCursor: null,
      });
      await Promise.resolve();
    });

    expect(result.current.status?.status).toBe("disabled");
    expect(result.current.clients).toEqual([]);
    expect(result.current.clientsLoading).toBe(false);
  });

  it("ignore une seconde activation tant que la première est en cours", async () => {
    const enable = deferred<ReturnType<typeof remoteStatus>>();
    requestMock.mockImplementation((method) => {
      if (method === "remoteControl/status/read")
        return Promise.resolve(remoteStatus("disabled", null));
      if (method === "remoteControl/enable") return enable.promise;
      if (method === "remoteControl/client/list")
        return Promise.resolve({ data: [], nextCursor: null });
      return Promise.resolve({});
    });
    const { result } = renderHook(() => useRemoteControl(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = result.current.enable();
      duplicate = result.current.enable();
    });
    expect(
      requestMock.mock.calls.filter(
        ([method]) => method === "remoteControl/enable",
      ),
    ).toHaveLength(1);
    await expect(duplicate).resolves.toBe(false);
    enable.resolve(remoteStatus("connected", "env-1"));
    await act(() => first);
  });

  it("préserve une notification de statut plus récente qu’une activation", async () => {
    const enable = deferred<ReturnType<typeof remoteStatus>>();
    requestMock.mockImplementation((method) => {
      if (method === "remoteControl/status/read")
        return Promise.resolve(remoteStatus("disabled", null));
      if (method === "remoteControl/enable") return enable.promise;
      if (method === "remoteControl/client/list")
        return Promise.resolve({ data: [], nextCursor: null });
      return Promise.resolve({});
    });
    const { result } = renderHook(() => useRemoteControl(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.enable();
    });
    act(() => {
      subscribeMock.mock.calls[0]?.[0]({
        method: "remoteControl/status/changed",
        params: remoteStatus("disabled", null),
      });
    });
    enable.resolve(remoteStatus("connected", "env-1"));
    await act(() => pending);
    expect(result.current.status?.status).toBe("disabled");
    expect(result.current.clients).toEqual([]);
  });

  it("ignore les notifications de statut lorsque le transport est déconnecté", () => {
    const { result } = renderHook(() => useRemoteControl(false));
    act(() => {
      subscribeMock.mock.calls[0]?.[0]({
        method: "remoteControl/status/changed",
        params: remoteStatus("connected", "env-1"),
      });
    });
    expect(result.current.status).toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
  });
});

function remoteStatus(
  status: "disabled" | "connected",
  environmentId: string | null,
) {
  return {
    status,
    serverName: "linux-box",
    installationId: "install-1",
    environmentId,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
