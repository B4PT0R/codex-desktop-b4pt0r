import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./codex";
import {
  backgroundTerminalsListParams,
  backgroundTerminalTerminateParams,
} from "./protocol";

export type BackgroundTerminal = {
  itemId: string;
  processId: string;
  command: string;
  cwd: string;
  osPid?: number;
  cpuPercent?: number;
  rssKb?: number;
};

export type BackgroundTerminalsController = {
  error?: string;
  loading: boolean;
  refresh: () => Promise<BackgroundTerminal[]>;
  terminals: BackgroundTerminal[];
  terminate: (processId: string) => Promise<boolean>;
  terminating: string[];
};

type BackgroundTerminalsOptions = {
  busy: boolean;
  connected: boolean;
  threadId?: string;
};

export function useBackgroundTerminals({
  busy,
  connected,
  threadId,
}: BackgroundTerminalsOptions) {
  const [terminals, setTerminals] = useState<BackgroundTerminal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [terminating, setTerminating] = useState<string[]>([]);
  const refreshVersion = useRef(0);
  const pendingRequests = useRef(new Map<string, number>());
  const terminatingProcesses = useRef(new Set<string>());
  const activeThreadId = useRef(threadId);
  const terminalsRef = useRef(terminals);
  activeThreadId.current = threadId;
  terminalsRef.current = terminals;

  useEffect(() => {
    refreshVersion.current += 1;
    pendingRequests.current.clear();
    setTerminals([]);
    setError(undefined);
    setLoading(false);
    setTerminating([]);
  }, [connected, threadId]);

  const refreshTerminals = useCallback(async (showLoading: boolean) => {
    if (!connected || !threadId) {
      if (!threadId) setTerminals([]);
      return [];
    }
    if (pendingRequests.current.has(threadId)) return terminalsRef.current;
    const version = ++refreshVersion.current;
    pendingRequests.current.set(threadId, version);
    if (showLoading) setLoading(true);
    setError(undefined);
    try {
      const items: BackgroundTerminal[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 4; page += 1) {
        const response = await request<unknown>(
          "thread/backgroundTerminals/list",
          backgroundTerminalsListParams(threadId, cursor),
        );
        const normalized = terminalPage(response);
        items.push(...normalized.data);
        cursor = normalized.nextCursor;
        if (!cursor) break;
      }
      if (version === refreshVersion.current) {
        setTerminals((current) =>
          sameTerminalSnapshots(current, items) ? current : items,
        );
      }
      return version === refreshVersion.current ? items : terminalsRef.current;
    } catch (cause) {
      if (version === refreshVersion.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      return terminalsRef.current;
    } finally {
      if (pendingRequests.current.get(threadId) === version) {
        pendingRequests.current.delete(threadId);
      }
      if (showLoading && version === refreshVersion.current) setLoading(false);
    }
  }, [connected, threadId]);

  const refresh = useCallback(
    () => refreshTerminals(true),
    [refreshTerminals],
  );

  useEffect(() => {
    void refreshTerminals(false);
  }, [busy, refreshTerminals]);

  useEffect(
    () => () => {
      refreshVersion.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!busy && terminals.length === 0) return;
    const interval = window.setInterval(
      () => void refreshTerminals(false),
      busy ? 1_000 : 5_000,
    );
    return () => window.clearInterval(interval);
  }, [busy, refreshTerminals, terminals.length]);

  const terminate = useCallback(
    async (processId: string) => {
      if (!threadId) return false;
      const targetThreadId = threadId;
      const terminationKey = `${targetThreadId}\u0000${processId}`;
      if (terminatingProcesses.current.has(terminationKey)) return false;
      terminatingProcesses.current.add(terminationKey);
      setTerminating((items) => [...items, processId]);
      setError(undefined);
      try {
        const response = await request<unknown>(
          "thread/backgroundTerminals/terminate",
          backgroundTerminalTerminateParams(targetThreadId, processId),
        );
        if (activeThreadId.current !== targetThreadId) return false;
        const terminated = record(response)?.terminated === true;
        if (terminated) {
          setTerminals((items) =>
            items.filter((terminal) => terminal.processId !== processId),
          );
        } else {
          await refresh();
        }
        return terminated;
      } catch (cause) {
        if (activeThreadId.current === targetThreadId) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
        return false;
      } finally {
        terminatingProcesses.current.delete(terminationKey);
        if (activeThreadId.current === targetThreadId) {
          setTerminating((items) => items.filter((id) => id !== processId));
        }
      }
    },
    [refresh, threadId],
  );

  return {
    error,
    loading,
    refresh,
    terminals,
    terminate,
    terminating,
  } satisfies BackgroundTerminalsController;
}

function terminalPage(value: unknown) {
  const page = record(value);
  const rawData = Array.isArray(page?.data) ? page.data.slice(0, 50) : [];
  return {
    data: rawData.flatMap((item) => {
      const terminal = record(item);
      if (
        typeof terminal?.itemId !== "string" ||
        typeof terminal.processId !== "string" ||
        typeof terminal.command !== "string" ||
        typeof terminal.cwd !== "string" ||
        terminal.command.length > 32_768 ||
        terminal.cwd.length > 32_768
      ) {
        return [];
      }
      return [
        {
          itemId: terminal.itemId,
          processId: terminal.processId,
          command: terminal.command,
          cwd: terminal.cwd,
          osPid: finiteNonNegativeInteger(terminal.osPid),
          cpuPercent: finiteNonNegativeNumber(terminal.cpuPercent),
          rssKb: finiteNonNegativeInteger(terminal.rssKb),
        },
      ];
    }),
    nextCursor:
      typeof page?.nextCursor === "string" && page.nextCursor.length <= 8_192
        ? page.nextCursor
        : undefined,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function finiteNonNegativeInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function finiteNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function sameTerminalSnapshots(
  current: BackgroundTerminal[],
  next: BackgroundTerminal[],
) {
  return (
    current.length === next.length &&
    current.every((terminal, index) => {
      const candidate = next[index];
      return (
        terminal.itemId === candidate.itemId &&
        terminal.processId === candidate.processId &&
        terminal.command === candidate.command &&
        terminal.cwd === candidate.cwd &&
        terminal.osPid === candidate.osPid &&
        terminal.cpuPercent === candidate.cpuPercent &&
        terminal.rssKb === candidate.rssKb
      );
    })
  );
}
