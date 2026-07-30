import { useCallback, useEffect, useState } from "react";
import type { ThreadSummary } from "../types";
import {
  loadDesktopSettings,
  updateDesktopSettings,
} from "./desktopSettings";

export type DefaultThreadSettingsController = {
  defaultThreadId?: string;
  error?: string;
  saving: boolean;
  threadOptions: ThreadSummary[];
  setDefaultThreadId: (threadId?: string) => Promise<boolean>;
};

export function useDefaultThreadSettings(
  threadOptions: ThreadSummary[],
): DefaultThreadSettingsController {
  const [defaultThreadId, setDefaultThreadIdState] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (!disposed) setDefaultThreadIdState(settings.defaultThreadId);
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      });
    return () => {
      disposed = true;
    };
  }, []);

  const setDefaultThreadId = useCallback(
    async (nextThreadId?: string) => {
      if (saving || nextThreadId === defaultThreadId) return false;
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
        setSaving(false);
      }
    },
    [defaultThreadId, saving],
  );

  return {
    defaultThreadId,
    error,
    saving,
    threadOptions,
    setDefaultThreadId,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
