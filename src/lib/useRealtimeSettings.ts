import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { RealtimeVoice } from "./appServerTypes";
import { isDesktopApp, request } from "./codex";
import { loadDesktopSettings, updateDesktopSettings } from "./desktopSettings";
import { realtimeListVoicesParams } from "./protocol";
import {
  fallbackRealtimeVoices,
  isRealtimeVoice,
  normalizeRealtimeVoices,
} from "./realtimeVoices";

export type RealtimeSettingsController = {
  voice: RealtimeVoice;
  voiceInstructions: string;
  voices: RealtimeVoice[];
  loading: boolean;
  saving: boolean;
  error?: string;
  persistenceError?: string;
  refresh: () => Promise<void>;
  setVoice: (voice: RealtimeVoice) => Promise<void>;
  setVoiceInstructions: (instructions: string) => Promise<boolean>;
};

export function useRealtimeSettings(
  enabled: boolean,
): RealtimeSettingsController {
  const { t } = useI18n();
  const [voice, setVoiceState] = useState<RealtimeVoice>(
    fallbackRealtimeVoices.defaultV1,
  );
  const [voices, setVoices] = useState<RealtimeVoice[]>(
    fallbackRealtimeVoices.v1,
  );
  const [voiceInstructions, setVoiceInstructionsState] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [persistenceError, setPersistenceError] = useState<string>();
  const loadGeneration = useRef(0);
  const refreshInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const voiceVersion = useRef(0);

  useEffect(() => {
    const version = voiceVersion.current;
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (
          !disposed &&
          version === voiceVersion.current &&
          isRealtimeVoice(settings.realtimeVoice)
        ) {
          setVoiceState(settings.realtimeVoice);
        }
        if (!disposed && typeof settings.realtimeVoiceInstructions === "string") {
          setVoiceInstructionsState(settings.realtimeVoiceInstructions);
        }
      })
      .catch((cause) => {
        if (!disposed && version === voiceVersion.current) {
          setPersistenceError(errorMessage(cause));
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current || saveInFlight.current) return;
    refreshInFlight.current = true;
    const generation = ++loadGeneration.current;
    if (!isDesktopApp()) {
      setVoices(fallbackRealtimeVoices.v1);
      setLoading(false);
      setError(undefined);
      refreshInFlight.current = false;
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await request<{ voices?: unknown }>(
        "thread/realtime/listVoices",
        realtimeListVoicesParams(),
      );
      if (generation !== loadGeneration.current) return;
      const list = normalizeRealtimeVoices(response.voices);
      // V3 preserves V1 Codex Voice behavior and therefore uses the V1 voice catalog.
      setVoices(list.v1);
      setVoiceState((current) =>
        list.v1.includes(current) ? current : list.defaultV1,
      );
    } catch (cause) {
      if (generation === loadGeneration.current) {
        setError(errorMessage(cause));
        setVoices(fallbackRealtimeVoices.v1);
      }
    } finally {
      if (generation === loadGeneration.current) {
        refreshInFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void refresh();
      return;
    }
    loadGeneration.current += 1;
    refreshInFlight.current = false;
    setLoading(false);
  }, [enabled, refresh]);

  const setVoice = useCallback(
    async (nextVoice: RealtimeVoice) => {
      if (
        !voices.includes(nextVoice) ||
        refreshInFlight.current ||
        saveInFlight.current
      ) {
        return;
      }
      saveInFlight.current = true;
      const version = ++voiceVersion.current;
      const previous = voice;
      setVoiceState(nextVoice);
      setSaving(true);
      setPersistenceError(undefined);
      try {
        await updateDesktopSettings({ realtimeVoice: nextVoice });
      } catch (cause) {
        if (version === voiceVersion.current) {
          setVoiceState(previous);
          setPersistenceError(errorMessage(cause));
        }
      } finally {
        saveInFlight.current = false;
        setSaving(false);
      }
    },
    [voice, voices],
  );

  const setVoiceInstructions = useCallback(async (instructions: string) => {
    if (saveInFlight.current) return false;
    saveInFlight.current = true;
    setSaving(true);
    setPersistenceError(undefined);
    try {
      const normalized = instructions.trim();
      await updateDesktopSettings({ realtimeVoiceInstructions: normalized });
      setVoiceInstructionsState(normalized);
      return true;
    } catch (cause) {
      setPersistenceError(errorMessage(cause));
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, []);

  return {
    voice,
    voiceInstructions,
    voices,
    loading,
    saving,
    error: error ? t("settings.voice.inventoryError", { detail: error }) : undefined,
    persistenceError,
    refresh,
    setVoice,
    setVoiceInstructions,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
