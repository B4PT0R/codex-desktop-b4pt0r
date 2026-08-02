import { useCallback, useEffect, useRef, useState } from "react";
import { request, subscribeAppServerMessages } from "./codex";
import {
  fuzzyFileSearchSessionStartParams,
  fuzzyFileSearchSessionStopParams,
  fuzzyFileSearchSessionUpdateParams,
} from "./protocol";

export type FileSearchResult = {
  root: string;
  path: string;
  fileName: string;
};

type FileSearchState = {
  results: FileSearchResult[];
  loading: boolean;
  complete: boolean;
  error?: string;
};

const INITIAL_STATE: FileSearchState = {
  results: [],
  loading: false,
  complete: false,
};

export function useFileSearch(active: boolean, root: string) {
  const [state, setState] = useState(INITIAL_STATE);
  const session = useRef<string | undefined>(undefined);
  const latestQuery = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!active || !root) {
      setState(INITIAL_STATE);
      return;
    }

    const sessionId = crypto.randomUUID();
    session.current = sessionId;
    let disposed = false;
    const unsubscribe = subscribeAppServerMessages((message) => {
      if (
        message.method === "fuzzyFileSearch/sessionUpdated" &&
        isRecord(message.params) &&
        message.params.sessionId === sessionId &&
        message.params.query === latestQuery.current
      ) {
        setState({
          results: normalizeResults(message.params.files),
          loading: false,
          complete: false,
        });
      }
      if (
        message.method === "fuzzyFileSearch/sessionCompleted" &&
        isRecord(message.params) &&
        message.params.sessionId === sessionId
      ) {
        setState((current) => ({ ...current, loading: false, complete: true }));
      }
    });

    void request(
      "fuzzyFileSearch/sessionStart",
      fuzzyFileSearchSessionStartParams(sessionId, root),
    ).catch((cause) => {
      if (!disposed)
        setState({
          ...INITIAL_STATE,
          error: cause instanceof Error ? cause.message : String(cause),
        });
    });

    return () => {
      disposed = true;
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      if (session.current === sessionId) session.current = undefined;
      void request(
        "fuzzyFileSearch/sessionStop",
        fuzzyFileSearchSessionStopParams(sessionId),
      ).catch(() => undefined);
    };
  }, [active, root]);

  const search = useCallback((query: string) => {
    latestQuery.current = query;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (!query.trim()) {
      setState(INITIAL_STATE);
      return;
    }
    setState((current) => ({ ...current, loading: true, error: undefined }));
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const sessionId = session.current;
      if (!sessionId) return;
      void request(
        "fuzzyFileSearch/sessionUpdate",
        fuzzyFileSearchSessionUpdateParams(sessionId, query),
      ).catch((cause) => {
        // A rejection belongs to both its session and query. A newer query in
        // the same session must keep ownership of the visible search state.
        if (
          session.current === sessionId &&
          latestQuery.current === query
        )
          setState({
            ...INITIAL_STATE,
            error: cause instanceof Error ? cause.message : String(cause),
          });
      });
    }, 120);
  }, []);

  return { ...state, search };
}

function normalizeResults(value: unknown): FileSearchResult[] {
  if (!Array.isArray(value)) return [];
  const results: FileSearchResult[] = [];
  for (const candidate of value.slice(0, 50)) {
    if (!isRecord(candidate) || candidate.match_type !== "file") continue;
    if (
      typeof candidate.root !== "string" ||
      typeof candidate.path !== "string" ||
      typeof candidate.file_name !== "string"
    )
      continue;
    results.push({
      root: candidate.root.slice(0, 32_768),
      path: candidate.path.slice(0, 32_768),
      fileName: candidate.file_name.slice(0, 512),
    });
  }
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
