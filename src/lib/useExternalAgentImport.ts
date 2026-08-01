import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type {
  ExternalAgentImportHistory,
  ExternalAgentImportTypeResult,
  ExternalAgentMigrationItem,
  ExternalAgentMigrationSource,
} from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import {
  normalizeExternalAgentHistories,
  externalAgentHistoryResults,
  normalizeExternalAgentItems,
  normalizeExternalAgentResults,
} from "./externalAgentImport";
import {
  externalAgentDetectParams,
  externalAgentImportHistoriesReadParams,
  externalAgentImportParams,
} from "./protocol";

export type ExternalAgentImportController = {
  items: ExternalAgentMigrationItem[];
  histories: ExternalAgentImportHistory[];
  detecting: boolean;
  historyLoading: boolean;
  importing: boolean;
  completed: boolean;
  results: ExternalAgentImportTypeResult[];
  error?: string;
  detect: (source: ExternalAgentMigrationSource) => Promise<void>;
  importItems: (items: ExternalAgentMigrationItem[]) => Promise<void>;
  refreshHistory: () => Promise<void>;
  clearResult: () => void;
};

export function useExternalAgentImport({
  cwd,
  enabled,
}: {
  cwd: string;
  enabled: boolean;
}): ExternalAgentImportController {
  const { t } = useI18n();
  const [items, setItems] = useState<ExternalAgentMigrationItem[]>([]);
  const [histories, setHistories] = useState<ExternalAgentImportHistory[]>([]);
  const [results, setResults] = useState<ExternalAgentImportTypeResult[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string>();
  const detectedSource = useRef<ExternalAgentMigrationSource>("claude-code");
  const activeImportId = useRef<string | undefined>(undefined);
  const importInFlight = useRef(false);
  const detectionGeneration = useRef(0);
  const detectionCwd = useRef(cwd);
  const historyGeneration = useRef(0);
  const queuedNotifications = useRef(
    new Map<
      string,
      { completed: boolean; results: ExternalAgentImportTypeResult[] }
    >(),
  );

  const refreshHistory = useCallback(async () => {
    const generation = ++historyGeneration.current;
    if (!isDesktopApp()) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const response = await request<{ data?: unknown }>(
        "externalAgentConfig/import/readHistories",
        externalAgentImportHistoriesReadParams(),
      );
      if (generation === historyGeneration.current) {
        const normalized = normalizeExternalAgentHistories(response.data);
        setHistories(normalized);
        const recovered = normalized.find(
          (history) => history.importId === activeImportId.current,
        );
        if (recovered) {
          activeImportId.current = undefined;
          importInFlight.current = false;
          setImporting(false);
          setCompleted(true);
          setResults(externalAgentHistoryResults(recovered));
        }
      }
    } catch (cause) {
      if (generation === historyGeneration.current) {
        setError(errorMessage(cause));
      }
    } finally {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    }
  }, []);

  const detect = useCallback(async (source: ExternalAgentMigrationSource) => {
    const generation = ++detectionGeneration.current;
    if (!isDesktopApp()) {
      setItems([]);
      setError(t("externalImport.nativeOnly"));
      return;
    }
    setDetecting(true);
    setItems([]);
    setError(undefined);
    setCompleted(false);
    setResults([]);
    try {
      const response = await request<{ items?: unknown }>(
        "externalAgentConfig/detect",
        externalAgentDetectParams(cwd, source),
      );
      if (
        generation === detectionGeneration.current &&
        cwd === detectionCwd.current
      ) {
        detectedSource.current = source;
        setItems(normalizeExternalAgentItems(response.items));
      }
    } catch (cause) {
      if (
        generation === detectionGeneration.current &&
        cwd === detectionCwd.current
      )
        setError(errorMessage(cause));
    } finally {
      if (
        generation === detectionGeneration.current &&
        cwd === detectionCwd.current
      )
        setDetecting(false);
    }
  }, [cwd, t]);

  const importItems = useCallback(
    async (selectedItems: ExternalAgentMigrationItem[]) => {
      if (importInFlight.current || selectedItems.length === 0) return;
      if (!isDesktopApp()) {
        setError(t("externalImport.nativeOnly"));
        return;
      }
      importInFlight.current = true;
      setImporting(true);
      setCompleted(false);
      setResults([]);
      setError(undefined);
      try {
        const response = await request<{ importId?: unknown }>(
          "externalAgentConfig/import",
          externalAgentImportParams(selectedItems, detectedSource.current),
        );
        if (typeof response.importId !== "string")
          throw new Error(t("externalImport.invalidResponse"));
        activeImportId.current = response.importId;
        const queued = queuedNotifications.current.get(response.importId);
        if (queued) {
          setResults(queued.results);
          if (queued.completed) {
            setCompleted(true);
            setImporting(false);
            importInFlight.current = false;
            activeImportId.current = undefined;
            queuedNotifications.current.delete(response.importId);
            void refreshHistory();
          }
        }
      } catch (cause) {
        importInFlight.current = false;
        setImporting(false);
        setError(errorMessage(cause));
      }
    },
    [refreshHistory, t],
  );

  const clearResult = useCallback(() => {
    if (importInFlight.current) return;
    setCompleted(false);
    setResults([]);
    setError(undefined);
  }, []);

  useEffect(() => {
    if (enabled) void refreshHistory();
  }, [enabled, refreshHistory]);

  useEffect(() => {
    detectionCwd.current = cwd;
    detectionGeneration.current += 1;
    setDetecting(false);
    setItems([]);
  }, [cwd]);

  useEffect(() => {
    if ((!enabled && !importing) || !isDesktopApp()) return;
    return subscribeAppServerMessages((message) => {
      const completedMessage =
        message.method === "externalAgentConfig/import/completed";
      if (
        !completedMessage &&
        message.method !== "externalAgentConfig/import/progress"
      )
        return;
      const params = asRecord(message.params);
      const importId =
        typeof params?.importId === "string" ? params.importId : undefined;
      if (!importId) return;
      const nextResults = normalizeExternalAgentResults(params?.itemTypeResults);
      if (activeImportId.current !== importId) {
        queuedNotifications.current.set(importId, {
          completed: completedMessage,
          results: nextResults,
        });
        if (queuedNotifications.current.size > 20) {
          const oldest = queuedNotifications.current.keys().next().value;
          if (typeof oldest === "string")
            queuedNotifications.current.delete(oldest);
        }
        return;
      }
      setResults(nextResults);
      if (completedMessage) {
        activeImportId.current = undefined;
        importInFlight.current = false;
        setImporting(false);
        setCompleted(true);
        void refreshHistory();
      }
    });
  }, [enabled, importing, refreshHistory]);

  useEffect(
    () => () => {
      detectionGeneration.current += 1;
      historyGeneration.current += 1;
    },
    [],
  );

  return {
    items,
    histories,
    detecting,
    historyLoading,
    importing,
    completed,
    results,
    error,
    detect,
    importItems,
    refreshHistory,
    clearResult,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
