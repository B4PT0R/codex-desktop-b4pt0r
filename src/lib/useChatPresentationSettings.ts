import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDesktopSettings,
  updateDesktopSettings,
} from "./desktopSettings";

export const DEFAULT_MAX_VISIBLE_ACTIONS = 3;
export const MIN_VISIBLE_ACTIONS = 1;
export const MAX_VISIBLE_ACTIONS = 6;

export type ChatPresentationSettingsController = {
  error?: string;
  keepActionGroupsCollapsed: boolean;
  loading: boolean;
  maxVisibleActions: number;
  saving: boolean;
  setKeepActionGroupsCollapsed: (value: boolean) => Promise<boolean>;
  setMaxVisibleActions: (value: number) => Promise<boolean>;
  setShowReasoningItems: (value: boolean) => Promise<boolean>;
  showReasoningItems: boolean;
};

export function useChatPresentationSettings(): ChatPresentationSettingsController {
  const [maxVisibleActions, setMaxVisibleActionsState] = useState(
    DEFAULT_MAX_VISIBLE_ACTIONS,
  );
  const [showReasoningItems, setShowReasoningItemsState] = useState(true);
  const [keepActionGroupsCollapsed, setKeepActionGroupsCollapsedState] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (disposed) return;
        setMaxVisibleActionsState(
          normalizeMaxVisibleActions(settings.maxVisibleActionsPerGroup),
        );
        setShowReasoningItemsState(settings.showReasoningItems !== false);
        setKeepActionGroupsCollapsedState(
          settings.keepActionGroupsCollapsed === true,
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
      if (savingRef.current || !isValidMaxVisibleActions(value)) return false;
      savingRef.current = true;
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
        savingRef.current = false;
        setSaving(false);
      }
    },
    [maxVisibleActions],
  );

  const setShowReasoningItems = useCallback(
    async (value: boolean) => {
      if (savingRef.current) return false;
      savingRef.current = true;
      const previous = showReasoningItems;
      setShowReasoningItemsState(value);
      setSaving(true);
      setError(undefined);
      try {
        await updateDesktopSettings({ showReasoningItems: value });
        return true;
      } catch (cause) {
        setShowReasoningItemsState(previous);
        setError(errorMessage(cause));
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [showReasoningItems],
  );

  const setKeepActionGroupsCollapsed = useCallback(
    async (value: boolean) => {
      if (savingRef.current) return false;
      savingRef.current = true;
      const previous = keepActionGroupsCollapsed;
      setKeepActionGroupsCollapsedState(value);
      setSaving(true);
      setError(undefined);
      try {
        await updateDesktopSettings({ keepActionGroupsCollapsed: value });
        return true;
      } catch (cause) {
        setKeepActionGroupsCollapsedState(previous);
        setError(errorMessage(cause));
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [keepActionGroupsCollapsed],
  );

  return {
    error,
    keepActionGroupsCollapsed,
    loading,
    maxVisibleActions,
    saving,
    setKeepActionGroupsCollapsed,
    setMaxVisibleActions,
    setShowReasoningItems,
    showReasoningItems,
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
