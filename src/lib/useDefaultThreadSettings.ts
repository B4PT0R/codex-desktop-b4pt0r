import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadSummary } from "../types";
import {
  loadDesktopSettings,
  updateDesktopSettings,
} from "./desktopSettings";

export type DefaultThreadSettingsController = {
  defaultThreadId?: string;
  error?: string;
  loading: boolean;
  saving: boolean;
  threadOptions: ThreadSummary[];
  setDefaultThreadId: (threadId?: string) => Promise<boolean>;
};

export function useDefaultThreadSettings(
  threadOptions: ThreadSummary[],
): DefaultThreadSettingsController {
  const [defaultThreadId, setDefaultThreadIdState] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const operation = useRef(true);

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (!disposed) setDefaultThreadIdState(settings.defaultThreadId);
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!disposed) {
          operation.current = false;
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const setDefaultThreadId = useCallback(
    async (nextThreadId?: string) => {
      if (operation.current || nextThreadId === defaultThreadId) return false;
      operation.current = true;
      const previous = defaultThreadId;
      setDefaultThreadIdState(nextThreadId);
      setSaving(true);
      setError(undefined);
      try {
        await updateDesktopSettings({ defaultThreadId: nextThreadId });
        return true;
      } catch (cause) {
        setDefaultThreadIdState(previous);
        setError(errorMessage(cause));
        return false;
      } finally {
        operation.current = false;
        setSaving(false);
      }
    },
    [defaultThreadId],
  );

  return {
    defaultThreadId,
    error,
    loading,
    saving,
    threadOptions,
    setDefaultThreadId,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
