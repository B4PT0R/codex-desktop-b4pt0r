import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export type LaunchAtLoginController = {
  available: boolean;
  enabled: boolean;
  error?: string;
  loading: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
};

export function useLaunchAtLogin(): LaunchAtLoginController {
  const available = isNative();
  const [enabled, setCurrentEnabled] = useState(false);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    setError(undefined);
    try {
      setCurrentEnabled(await invoke<boolean>("read_launch_at_login"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [available]);

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (!available || loading) return;
      setLoading(true);
      setError(undefined);
      try {
        setCurrentEnabled(
          await invoke<boolean>("set_launch_at_login", {
            enabled: nextEnabled,
          }),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [available, loading],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { available, enabled, error, loading, setEnabled };
}

function isNative() {
  return "__TAURI_INTERNALS__" in window;
}
