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
  voices: RealtimeVoice[];
  loading: boolean;
  saving: boolean;
  error?: string;
  persistenceError?: string;
  refresh: () => Promise<void>;
  setVoice: (voice: RealtimeVoice) => Promise<void>;
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [persistenceError, setPersistenceError] = useState<string>();
  const loadGeneration = useRef(0);

  useEffect(() => {
    let disposed = false;
    void loadDesktopSettings()
      .then((settings) => {
        if (!disposed && isRealtimeVoice(settings.realtimeVoice)) {
          setVoiceState(settings.realtimeVoice);
        }
      })
      .catch((cause) => {
        if (!disposed) setPersistenceError(errorMessage(cause));
      });
    return () => {
      disposed = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!isDesktopApp()) {
      setVoices(fallbackRealtimeVoices.v1);
      setLoading(false);
      setError(undefined);
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
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const setVoice = useCallback(
    async (nextVoice: RealtimeVoice) => {
      if (!voices.includes(nextVoice) || saving) return;
      const previous = voice;
      setVoiceState(nextVoice);
      setSaving(true);
      setPersistenceError(undefined);
      try {
        await updateDesktopSettings({ realtimeVoice: nextVoice });
      } catch (cause) {
        setVoiceState(previous);
        setPersistenceError(errorMessage(cause));
      } finally {
        setSaving(false);
      }
    },
    [saving, voice, voices],
  );

  return {
    voice,
    voices,
    loading,
    saving,
    error: error ? t("settings.voice.inventoryError", { detail: error }) : undefined,
    persistenceError,
    refresh,
    setVoice,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
