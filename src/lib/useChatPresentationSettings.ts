import { useCallback, useEffect, useState } from "react";
import {
  loadDesktopSettings,
  updateDesktopSettings,
} from "./desktopSettings";

export const DEFAULT_MAX_VISIBLE_ACTIONS = 3;
export const MIN_VISIBLE_ACTIONS = 1;
export const MAX_VISIBLE_ACTIONS = 6;

export type ChatPresentationSettingsController = {
  error?: string;
  loading: boolean;
  maxVisibleActions: number;
  saving: boolean;
  setMaxVisibleActions: (value: number) => Promise<boolean>;
};

export function useChatPresentationSettings(): ChatPresentationSettingsController {
  const [maxVisibleActions, setMaxVisibleActionsState] = useState(
    DEFAULT_MAX_VISIBLE_ACTIONS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (disposed) return;
        setMaxVisibleActionsState(
          normalizeMaxVisibleActions(settings.maxVisibleActionsPerGroup),
        );
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const setMaxVisibleActions = useCallback(
    async (value: number) => {
      if (saving || !isValidMaxVisibleActions(value)) return false;
      const previous = maxVisibleActions;
      setMaxVisibleActionsState(value);
      setSaving(true);
      setError(undefined);
      try {
        await updateDesktopSettings({
          maxVisibleActionsPerGroup: value,
        });
        return true;
      } catch (cause) {
        setMaxVisibleActionsState(previous);
        setError(errorMessage(cause));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [maxVisibleActions, saving],
  );

  return {
    error,
    loading,
    maxVisibleActions,
    saving,
    setMaxVisibleActions,
  };
}

function normalizeMaxVisibleActions(value: unknown) {
  return isValidMaxVisibleActions(value)
    ? value
    : DEFAULT_MAX_VISIBLE_ACTIONS;
}

function isValidMaxVisibleActions(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_VISIBLE_ACTIONS &&
    value <= MAX_VISIBLE_ACTIONS
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
