import { invoke, isDesktopApp } from "./nativeBridge";
import { useCallback, useEffect, useState } from "react";

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
  cancelInstall: () => Promise<void>;
};

export function useChromium(): ChromiumController {
  const native = isDesktopApp();
  const [status, setStatus] = useState<ChromiumStatus>();
  const [loading, setLoading] = useState(native);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!native) return;
    setLoading(true);
    setError(undefined);
    try {
      setStatus(await invoke<ChromiumStatus>("read_chromium_status"));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [native]);

  const install = useCallback(async (afterConfigure?: () => Promise<void>) => {
    if (!native || loading) return;
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
      setError(errorMessage(cause));
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [loading, native, refresh]);

  const cancelInstall = useCallback(async () => {
    if (!native || !status?.installing) return;
    setError(undefined);
    try {
      await invoke<boolean>("cancel_chromium_install");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [native, status?.installing]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { native, status, loading, error, refresh, install, cancelInstall };
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
