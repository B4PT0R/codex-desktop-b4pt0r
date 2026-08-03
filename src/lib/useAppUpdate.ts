import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isDesktopApp, openUrl } from "./nativeBridge";

export type AppVersions = {
  clientVersion: string;
  codexCompatible?: boolean;
  codexVersion?: string;
  codexError?: string;
  minimumCodexVersion: string;
};

export type CodexUpdateStatus = {
  compatible?: boolean;
  currentVersion?: string;
  error?: string;
  latestVersion?: string;
  minimumVersion: string;
  updateAvailable?: boolean;
};

export type UpdateStatus = {
  assetAvailable: boolean;
  currentVersion: string;
  installMode: "automatic" | "manual" | "unavailable";
  latestVersion: string;
  packageFormat: "appimage" | "deb" | "rpm" | "unknown";
  releaseUrl: string;
  updateAvailable: boolean;
  codexUpdate: CodexUpdateStatus;
  clientError?: string;
};

export type AppUpdateController = {
  checking: boolean;
  codexUpdateInstalled: boolean;
  codexUpdating: boolean;
  error?: string;
  updateInstalled: boolean;
  installing: boolean;
  loadingVersions: boolean;
  native: boolean;
  versions?: AppVersions;
  status?: UpdateStatus;
  check: () => Promise<boolean>;
  install: () => Promise<boolean>;
  updateCodex: () => Promise<boolean>;
  openRelease: () => Promise<boolean>;
};

export function useAppUpdate(
  enabled: boolean,
  checkOnLoad = false,
): AppUpdateController {
  const native = isDesktopApp();
  const [versions, setVersions] = useState<AppVersions>();
  const [status, setStatus] = useState<UpdateStatus>();
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [codexUpdateInstalled, setCodexUpdateInstalled] = useState(false);
  const [codexUpdating, setCodexUpdating] = useState(false);
  const [error, setError] = useState<string>();
  const operationRef = useRef<"check" | "install" | "codex" | null>(null);
  const initialCheckStartedRef = useRef(false);
  const versionsGeneration = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!native) {
      setVersions({
        clientVersion: __APP_VERSION__,
        minimumCodexVersion: "0.146.0",
      });
      return;
    }
    let disposed = false;
    const generation = ++versionsGeneration.current;
    setLoadingVersions(true);
    void invoke<AppVersions>("read_app_versions")
      .then((result) => {
        if (!disposed && versionsGeneration.current === generation)
          setVersions(result);
      })
      .catch((cause) => {
        if (!disposed && versionsGeneration.current === generation)
          setError(errorMessage(cause));
      })
      .finally(() => {
        if (!disposed && versionsGeneration.current === generation)
          setLoadingVersions(false);
      });
    return () => {
      disposed = true;
    };
  }, [enabled, native]);

  const check = useCallback(async () => {
    if (!native || operationRef.current) return false;
    operationRef.current = "check";
    setChecking(true);
    setUpdateInstalled(false);
    setError(undefined);
    try {
      const next = await invoke<UpdateStatus>("check_for_updates");
      setStatus(next);
      if (next.clientError) setError(next.clientError);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      operationRef.current = null;
      setChecking(false);
    }
  }, [native]);

  useEffect(() => {
    if (
      !enabled ||
      !native ||
      !checkOnLoad ||
      initialCheckStartedRef.current
    ) {
      return;
    }
    initialCheckStartedRef.current = true;
    void check();
  }, [check, checkOnLoad, enabled, native]);

  useEffect(() => {
    if (!enabled || !native || !checkOnLoad) return;
    const interval = window.setInterval(() => void check(), 60 * 60 * 1_000);
    return () => window.clearInterval(interval);
  }, [check, checkOnLoad, enabled, native]);

  const install = useCallback(async () => {
    if (
      !native ||
      operationRef.current ||
      !status?.updateAvailable ||
      !status.assetAvailable ||
      status.installMode !== "automatic"
    ) {
      return false;
    }
    operationRef.current = "install";
    setInstalling(true);
    setError(undefined);
    try {
      await invoke("install_update", { confirmed: true });
      setUpdateInstalled(true);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      operationRef.current = null;
      setInstalling(false);
    }
  }, [native, status]);

  const openRelease = useCallback(async () => {
    if (!native || !status?.updateAvailable || !status.releaseUrl) return false;
    try {
      await openUrl(status.releaseUrl);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, [native, status]);

  const updateCodex = useCallback(async () => {
    if (!native || operationRef.current) return false;
    operationRef.current = "codex";
    versionsGeneration.current += 1;
    setCodexUpdating(true);
    setLoadingVersions(false);
    setCodexUpdateInstalled(false);
    setError(undefined);
    try {
      const next = await invoke<AppVersions>("update_codex", {
        confirmed: true,
      });
      const nextStatus = await invoke<UpdateStatus>("check_for_updates");
      setVersions(next);
      setStatus(nextStatus);
      const completed = nextStatus.codexUpdate.updateAvailable !== true;
      setCodexUpdateInstalled(completed);
      if (!completed) setError("Codex CLI remains outdated after the update.");
      return completed;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      operationRef.current = null;
      setCodexUpdating(false);
    }
  }, [native]);

  return {
    check,
    checking,
    codexUpdateInstalled,
    codexUpdating,
    error,
    install,
    updateInstalled,
    installing,
    loadingVersions,
    native,
    openRelease,
    status,
    updateCodex,
    versions,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
