import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isDesktopApp, openUrl } from "./nativeBridge";

export type AppVersions = {
  clientVersion: string;
  codexVersion?: string;
  codexError?: string;
};

export type UpdateStatus = {
  assetAvailable: boolean;
  currentVersion: string;
  installMode: "automatic" | "manual" | "unavailable";
  latestVersion: string;
  packageFormat: "appimage" | "deb" | "rpm" | "unknown";
  releaseUrl: string;
  updateAvailable: boolean;
};

export type AppUpdateController = {
  checking: boolean;
  error?: string;
  updateInstalled: boolean;
  installing: boolean;
  loadingVersions: boolean;
  native: boolean;
  versions?: AppVersions;
  status?: UpdateStatus;
  check: () => Promise<boolean>;
  install: () => Promise<boolean>;
  openRelease: () => Promise<boolean>;
};

export function useAppUpdate(enabled: boolean): AppUpdateController {
  const native = isDesktopApp();
  const [versions, setVersions] = useState<AppVersions>();
  const [status, setStatus] = useState<UpdateStatus>();
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [error, setError] = useState<string>();
  const operationRef = useRef<"check" | "install" | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!native) {
      setVersions({ clientVersion: __APP_VERSION__ });
      return;
    }
    let disposed = false;
    setLoadingVersions(true);
    void invoke<AppVersions>("read_app_versions")
      .then((result) => {
        if (!disposed) setVersions(result);
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!disposed) setLoadingVersions(false);
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
    setStatus(undefined);
    setError(undefined);
    try {
      const next = await invoke<UpdateStatus>("check_for_updates");
      setStatus(next);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      operationRef.current = null;
      setChecking(false);
    }
  }, [native]);

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

  return {
    check,
    checking,
    error,
    install,
    updateInstalled,
    installing,
    loadingVersions,
    native,
    openRelease,
    status,
    versions,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
