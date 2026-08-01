import { invoke, isDesktopApp } from "./nativeBridge";
import { useCallback, useEffect, useRef, useState } from "react";

export type ChromiumStatus = {
  available: boolean;
  enabled: boolean;
  running: boolean;
  executable?: string;
  version?: string;
  mcpVersion?: string;
  detail?: string;
  installing: boolean;
  installSupported: boolean;
  installPackage?: string;
};

export type ChromiumController = {
  native: boolean;
  status?: ChromiumStatus;
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  install: (afterConfigure?: () => Promise<void>) => Promise<void>;
  disable: (afterConfigure?: () => Promise<void>) => Promise<void>;
  cancelInstall: () => Promise<void>;
};

export function useChromium(): ChromiumController {
  const native = isDesktopApp();
  const [status, setStatus] = useState<ChromiumStatus>();
  const [loading, setLoading] = useState(native);
  const [error, setError] = useState<string>();
  const operationRef = useRef<"refresh" | "install" | "disable" | null>(null);

  const readStatus = useCallback(
    () => invoke<ChromiumStatus>("read_chromium_status"),
    [],
  );
  const recoverStatus = useCallback(async () => {
    try {
      setStatus(await readStatus());
    } catch {
      // Keep the initiating operation's more actionable failure.
    }
  }, [readStatus]);

  const refresh = useCallback(async () => {
    if (!native || operationRef.current) return;
    operationRef.current = "refresh";
    setLoading(true);
    setError(undefined);
    try {
      setStatus(await readStatus());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operationRef.current = null;
      setLoading(false);
    }
  }, [native, readStatus]);

  const install = useCallback(async (afterConfigure?: () => Promise<void>) => {
    if (!native || operationRef.current) return;
    operationRef.current = "install";
    setLoading(true);
    setError(undefined);
    setStatus((current) =>
      current ? { ...current, installing: true } : current,
    );
    try {
      setStatus(
        await invoke<ChromiumStatus>("install_chromium", {
          confirmed: true,
        }),
      );
      await afterConfigure?.();
    } catch (cause) {
      const operationError = errorMessage(cause);
      await recoverStatus();
      setError(operationError);
    } finally {
      operationRef.current = null;
      setLoading(false);
    }
  }, [native, recoverStatus]);

  const cancelInstall = useCallback(async () => {
    if (!native || !status?.installing) return;
    setError(undefined);
    try {
      await invoke<boolean>("cancel_chromium_install");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [native, status?.installing]);

  const disable = useCallback(
    async (afterConfigure?: () => Promise<void>) => {
      if (!native || operationRef.current || !status?.enabled) return;
      operationRef.current = "disable";
      setLoading(true);
      setError(undefined);
      try {
        setStatus(await invoke<ChromiumStatus>("disable_chromium"));
        await afterConfigure?.();
      } catch (cause) {
        const operationError = errorMessage(cause);
        await recoverStatus();
        setError(operationError);
      } finally {
        operationRef.current = null;
        setLoading(false);
      }
    },
    [native, recoverStatus, status?.enabled],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    native,
    status,
    loading,
    error,
    refresh,
    install,
    disable,
    cancelInstall,
  };
}

export async function openInChromium(target: string) {
  await invoke("open_chromium_target", { target });
}

export async function openImageInChromium(dataUrl: string) {
  await invoke("open_chromium_image", { dataUrl });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
