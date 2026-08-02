import { invoke, isDesktopApp } from "./nativeBridge";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const operation = useRef(false);

  const refresh = useCallback(async () => {
    if (!available || operation.current) return;
    operation.current = true;
    setLoading(true);
    setError(undefined);
    try {
      setCurrentEnabled(await invoke<boolean>("read_launch_at_login"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      operation.current = false;
      setLoading(false);
    }
  }, [available]);

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (!available || operation.current) return;
      operation.current = true;
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
        operation.current = false;
        setLoading(false);
      }
    },
    [available],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { available, enabled, error, loading, setEnabled };
}

function isNative() {
  return isDesktopApp();
}
