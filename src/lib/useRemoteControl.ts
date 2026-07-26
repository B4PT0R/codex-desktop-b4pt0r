import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RemoteControlClient,
  RemoteControlClientsListResponse,
  RemoteControlPairing,
  RemoteControlStatus,
} from "./appServerTypes";
import { appServerRecord } from "./appServerValues";
import {
  isDesktopApp,
  request,
  subscribeAppServerMessages,
} from "./codex";
import {
  remoteControlClientRevokeParams,
  remoteControlClientsListParams,
  remoteControlDisableParams,
  remoteControlEnableParams,
  remoteControlPairingStartParams,
  remoteControlPairingStatusParams,
} from "./protocol";

export type RemoteControlController = {
  available: boolean;
  allowed: boolean;
  clients: RemoteControlClient[];
  clientsLoading: boolean;
  disabling: boolean;
  enabling: boolean;
  error?: string;
  loading: boolean;
  nextCursor: string | null;
  pairing?: RemoteControlPairing;
  pairingClaimed: boolean;
  pairingLoading: boolean;
  revokingClientId?: string;
  status?: RemoteControlStatus;
  disable: () => Promise<boolean>;
  enable: () => Promise<boolean>;
  loadMoreClients: () => Promise<void>;
  refresh: () => Promise<void>;
  revokeClient: (clientId: string) => Promise<boolean>;
  startPairing: () => Promise<boolean>;
};

export function useRemoteControl(
  connected: boolean,
  allowed = true,
): RemoteControlController {
  const available = isDesktopApp();
  const [status, setStatus] = useState<RemoteControlStatus>();
  const [clients, setClients] = useState<RemoteControlClient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pairing, setPairing] = useState<RemoteControlPairing>();
  const [pairingClaimed, setPairingClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [revokingClientId, setRevokingClientId] = useState<string>();
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const clientsGeneration = useRef(0);
  const pairingPollInFlight = useRef(false);

  const loadClients = useCallback(
    async (environmentId: string, cursor: string | null = null) => {
      const current = cursor
        ? clientsGeneration.current
        : ++clientsGeneration.current;
      setClientsLoading(true);
      try {
        const response = normalizeRemoteControlClients(
          await request(
            "remoteControl/client/list",
            remoteControlClientsListParams(environmentId, cursor),
          ),
        );
        if (current !== clientsGeneration.current) return;
        setClients((current) =>
          cursor
            ? [
                ...current,
                ...response.data.filter(
                  (candidate) =>
                    !current.some(
                      (existing) => existing.clientId === candidate.clientId,
                    ),
                ),
              ]
            : response.data,
        );
        setNextCursor(response.nextCursor);
        setError(undefined);
      } catch (cause) {
        if (current === clientsGeneration.current)
          setError(errorMessage(cause));
      } finally {
        if (current === clientsGeneration.current) setClientsLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!connected || !available) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = normalizeRemoteControlStatus(
        await request("remoteControl/status/read"),
      );
      if (current !== generation.current) return;
      setStatus(next);
      setError(undefined);
      if (next.environmentId) await loadClients(next.environmentId);
      else {
        clientsGeneration.current += 1;
        setClientsLoading(false);
        setClients([]);
        setNextCursor(null);
      }
    } catch (cause) {
      if (current === generation.current) setError(errorMessage(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [available, connected, loadClients]);

  useEffect(() => {
    if (connected) void refresh();
    else {
      generation.current += 1;
      clientsGeneration.current += 1;
      setLoading(false);
      setClientsLoading(false);
      setStatus(undefined);
      setClients([]);
      setPairing(undefined);
    }
  }, [connected, refresh]);

  useEffect(
    () =>
      subscribeAppServerMessages((message) => {
        if (message.method !== "remoteControl/status/changed") return;
        const next = tryNormalizeRemoteControlStatus(message.params);
        if (!next) return;
        setStatus(next);
        if (next.environmentId) void loadClients(next.environmentId);
        else {
          clientsGeneration.current += 1;
          setClientsLoading(false);
          setClients([]);
          setNextCursor(null);
        }
      }),
    [loadClients],
  );

  useEffect(() => {
    if (!pairing) return;
    setPairingClaimed(false);
    const poll = async () => {
      if (
        pairingPollInFlight.current ||
        Date.now() >= pairing.expiresAt * 1_000
      )
        return;
      pairingPollInFlight.current = true;
      try {
        const response = appServerRecord(
          await request(
            "remoteControl/pairing/status",
            remoteControlPairingStatusParams(pairing.pairingCode),
          ),
        );
        if (response?.claimed === true) {
          setPairingClaimed(true);
          setPairing(undefined);
          await loadClients(pairing.environmentId);
        }
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        pairingPollInFlight.current = false;
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    const expiry = window.setTimeout(
      () => setPairing((current) => (current === pairing ? undefined : current)),
      Math.max(0, pairing.expiresAt * 1_000 - Date.now()),
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(expiry);
    };
  }, [loadClients, pairing]);

  async function setEnabled(enabled: boolean) {
    if (!available || !connected || (!allowed && enabled)) return false;
    const setBusy = enabled ? setEnabling : setDisabling;
    setBusy(true);
    setError(undefined);
    try {
      const next = normalizeRemoteControlStatus(
        await request(
          enabled ? "remoteControl/enable" : "remoteControl/disable",
          enabled
            ? remoteControlEnableParams()
            : remoteControlDisableParams(),
        ),
      );
      setStatus(next);
      if (!enabled) {
        clientsGeneration.current += 1;
        setClientsLoading(false);
        setPairing(undefined);
        setClients([]);
        setNextCursor(null);
      } else if (next.environmentId) {
        await loadClients(next.environmentId);
      }
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    available,
    allowed,
    clients,
    clientsLoading,
    disabling,
    enabling,
    error,
    loading,
    nextCursor,
    pairing,
    pairingClaimed,
    pairingLoading,
    revokingClientId,
    status,
    disable: () => setEnabled(false),
    enable: () => setEnabled(true),
    loadMoreClients: async () => {
      if (!status?.environmentId || !nextCursor || clientsLoading) return;
      await loadClients(status.environmentId, nextCursor);
    },
    refresh,
    revokeClient: async (clientId) => {
      if (!status?.environmentId || revokingClientId) return false;
      setRevokingClientId(clientId);
      setError(undefined);
      try {
        await request(
          "remoteControl/client/revoke",
          remoteControlClientRevokeParams(status.environmentId, clientId),
        );
        setClients((items) =>
          items.filter((item) => item.clientId !== clientId),
        );
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        setRevokingClientId(undefined);
      }
    },
    startPairing: async () => {
      if (
        !status?.environmentId ||
        status.status !== "connected" ||
        pairingLoading
      )
        return false;
      setPairingLoading(true);
      setPairingClaimed(false);
      setError(undefined);
      try {
        setPairing(
          normalizeRemoteControlPairing(
            await request(
              "remoteControl/pairing/start",
              remoteControlPairingStartParams(),
            ),
          ),
        );
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        setPairingLoading(false);
      }
    },
  };
}

export function normalizeRemoteControlStatus(value: unknown) {
  const status = tryNormalizeRemoteControlStatus(value);
  if (!status) throw new Error("Invalid remote-control status response");
  return status;
}

function tryNormalizeRemoteControlStatus(
  value: unknown,
): RemoteControlStatus | undefined {
  const record = appServerRecord(value);
  if (
    !record ||
    !isRemoteControlStatus(record.status) ||
    typeof record.serverName !== "string" ||
    typeof record.installationId !== "string" ||
    !(
      typeof record.environmentId === "string" ||
      record.environmentId === null ||
      record.environmentId === undefined
    )
  )
    return undefined;
  return {
    status: record.status,
    serverName: record.serverName,
    installationId: record.installationId,
    environmentId:
      typeof record.environmentId === "string" ? record.environmentId : null,
  };
}

export function normalizeRemoteControlPairing(
  value: unknown,
): RemoteControlPairing {
  const record = appServerRecord(value);
  if (
    !record ||
    typeof record.pairingCode !== "string" ||
    !(
      typeof record.manualPairingCode === "string" ||
      record.manualPairingCode === null
    ) ||
    typeof record.environmentId !== "string" ||
    typeof record.expiresAt !== "number"
  )
    throw new Error("Invalid remote-control pairing response");
  return {
    pairingCode: record.pairingCode,
    manualPairingCode: record.manualPairingCode,
    environmentId: record.environmentId,
    expiresAt: record.expiresAt,
  };
}

export function normalizeRemoteControlClients(
  value: unknown,
): RemoteControlClientsListResponse {
  const record = appServerRecord(value);
  if (!record || !Array.isArray(record.data))
    throw new Error("Invalid remote-control clients response");
  const data = record.data.map(normalizeRemoteControlClient);
  return {
    data,
    nextCursor:
      typeof record.nextCursor === "string" ? record.nextCursor : null,
  };
}

function normalizeRemoteControlClient(value: unknown): RemoteControlClient {
  const record = appServerRecord(value);
  if (!record || typeof record.clientId !== "string")
    throw new Error("Invalid remote-control client");
  return {
    clientId: record.clientId,
    displayName: optionalString(record.displayName),
    deviceType: optionalString(record.deviceType),
    platform: optionalString(record.platform),
    osVersion: optionalString(record.osVersion),
    deviceModel: optionalString(record.deviceModel),
    appVersion: optionalString(record.appVersion),
    lastSeenAt:
      typeof record.lastSeenAt === "number" ? record.lastSeenAt : null,
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRemoteControlStatus(
  value: unknown,
): value is RemoteControlStatus["status"] {
  return (
    value === "disabled" ||
    value === "connecting" ||
    value === "connected" ||
    value === "errored"
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
