import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadSummary } from "../types";
import type { ThreadSearchResponse } from "./appServerTypes";
import { request } from "./codex";
import { threadSearchParams } from "./protocol";
import { threadSummary } from "./threadSummary";

export type ThreadSearchController = {
  query: string;
  results: ThreadSummary[];
  loading: boolean;
  error?: string;
  hasMore: boolean;
  setQuery: (query: string) => void;
  loadMore: () => void;
  remove: (threadId: string) => void;
};

/** Searches persisted history rather than only the bounded recent-thread page. */
export function useThreadSearch(connected: boolean): ThreadSearchController {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThreadSummary[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const loadingPage = useRef(false);

  const searchPage = useCallback(
    async (
      searchTerm: string,
      pageCursor: string | undefined,
      currentGeneration: number,
      append: boolean,
    ) => {
      try {
        const response = await request<ThreadSearchResponse>(
          "thread/search",
          threadSearchParams(searchTerm, pageCursor),
        );
        if (generation.current !== currentGeneration) return;
        const page = normalizeSearchResults(response);
        setResults((current) => (append ? mergeThreads(current, page) : page));
        setCursor(normalizeCursor(response.nextCursor));
      } catch (cause) {
        if (generation.current === currentGeneration) {
          setError(
            t("sidebar.searchError", {
              detail: cause instanceof Error ? cause.message : String(cause),
            }),
          );
        }
      } finally {
        if (generation.current === currentGeneration) {
          loadingPage.current = false;
          setLoading(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    const searchTerm = query.trim().slice(0, 500);
    generation.current += 1;
    loadingPage.current = false;
    const currentGeneration = generation.current;
    setCursor(undefined);
    setError(undefined);
    if (!searchTerm || !connected) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void searchPage(searchTerm, undefined, currentGeneration, false);
    }, 180);
    return () => clearTimeout(timer);
  }, [connected, query, searchPage]);

  const loadMore = useCallback(() => {
    const searchTerm = query.trim().slice(0, 500);
    if (!searchTerm || !cursor || loadingPage.current) return;
    loadingPage.current = true;
    setLoading(true);
    void searchPage(searchTerm, cursor, generation.current, true);
  }, [cursor, query, searchPage]);

  const remove = useCallback(
    (threadId: string) =>
      setResults((current) =>
        current.filter((thread) => thread.id !== threadId),
      ),
    [],
  );

  return {
    query,
    results,
    loading,
    error,
    hasMore: Boolean(cursor),
    setQuery,
    loadMore,
    remove,
  };
}

function normalizeSearchResults(response: ThreadSearchResponse) {
  if (!Array.isArray(response.data)) return [];
  const results: ThreadSummary[] = [];
  for (const candidate of response.data.slice(0, 50)) {
    if (!candidate?.thread || typeof candidate.thread.id !== "string") continue;
    const summary = threadSummary(candidate.thread);
    results.push({
      ...summary,
      searchSnippet:
        typeof candidate.snippet === "string"
          ? candidate.snippet.replace(/\s+/g, " ").trim().slice(0, 500)
          : undefined,
    });
  }
  return results;
}

function normalizeCursor(cursor: unknown) {
  return typeof cursor === "string" && cursor.length <= 8_192
    ? cursor
    : undefined;
}

function mergeThreads(current: ThreadSummary[], page: ThreadSummary[]) {
  const seen = new Set(current.map((thread) => thread.id));
  return [...current, ...page.filter((thread) => !seen.has(thread.id))];
}
