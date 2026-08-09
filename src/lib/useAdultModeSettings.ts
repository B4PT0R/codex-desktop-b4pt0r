import { useCallback, useEffect, useRef, useState } from "react";
import { loadDesktopSettings, updateDesktopSettings } from "./desktopSettings";
import { createAdultModeCredential, verifyAdultModeCredential, type AdultModeCredential } from "./adultModeCredential";

export type AdultModeSettingsController = {
  enabled: boolean;
  error?: string;
  loading: boolean;
  saving: boolean;
  hasCredential: boolean;
  activate: (password: string) => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
};

export function useAdultModeSettings(): AdultModeSettingsController {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credential, setCredential] = useState<AdultModeCredential>();
  const [error, setError] = useState<string>();
  const mutating = useRef(false);

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (!disposed) { setEnabledState(settings.adultModeEnabled === true); setCredential(settings.adultModeCredential); }
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

  const setEnabled = useCallback(async (next: boolean) => {
    if (next) return false;
    if (mutating.current) return false;
    mutating.current = true;
    const previous = enabled;
    setEnabledState(next);
    setSaving(true);
    setError(undefined);
    try {
      await updateDesktopSettings({ adultModeEnabled: next });
      return true;
    } catch (cause) {
      setEnabledState(previous);
      setError(errorMessage(cause));
      return false;
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  }, [enabled]);

  const activate = useCallback(async (password: string) => {
    if (mutating.current) return false;
    mutating.current = true; setSaving(true); setError(undefined);
    try {
      if (credential && !(await verifyAdultModeCredential(password, credential))) return false;
      const nextCredential = credential ?? await createAdultModeCredential(password);
      await updateDesktopSettings({ adultModeCredential: nextCredential, adultModeEnabled: true });
      setCredential(nextCredential); setEnabledState(true); return true;
    } catch (cause) { setError(errorMessage(cause)); return false; }
    finally { mutating.current = false; setSaving(false); }
  }, [credential]);

  return { activate, enabled, error, hasCredential: Boolean(credential), loading, saving, setEnabled };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
