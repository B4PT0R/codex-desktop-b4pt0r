import { useCallback, useEffect, useState } from "react";
import { invoke, isDesktopApp } from "./nativeBridge";

export type AppVersions = {
  clientVersion: string;
  codexVersion?: string;
  codexError?: string;
};

export type UpdateStatus = {
  assetAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
};

export type AppUpdateController = {
  checking: boolean;
  error?: string;
  installerOpened: boolean;
  installing: boolean;
  loadingVersions: boolean;
  native: boolean;
  versions?: AppVersions;
  status?: UpdateStatus;
  check: () => Promise<boolean>;
  install: () => Promise<boolean>;
};

export function useAppUpdate(enabled: boolean): AppUpdateController {
  const native = isDesktopApp();
  const [versions, setVersions] = useState<AppVersions>();
  const [status, setStatus] = useState<UpdateStatus>();
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installerOpened, setInstallerOpened] = useState(false);
  const [error, setError] = useState<string>();

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
    if (!native || checking || installing) return false;
    setChecking(true);
    setInstallerOpened(false);
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
      setChecking(false);
    }
  }, [checking, installing, native]);

  const install = useCallback(async () => {
    if (
      !native ||
      installing ||
      !status?.updateAvailable ||
      !status.assetAvailable
    ) {
      return false;
    }
    setInstalling(true);
    setError(undefined);
    try {
      await invoke("install_update", { confirmed: true });
      setInstallerOpened(true);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setInstalling(false);
    }
  }, [installing, native, status]);

  return {
    check,
    checking,
    error,
    install,
    installerOpened,
    installing,
    loadingVersions,
    native,
    status,
    versions,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
