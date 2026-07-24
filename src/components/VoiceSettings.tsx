import { AudioLines, RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { realtimeVoiceLabel } from "../lib/realtimeVoices";
import type { RealtimeSettingsController } from "../lib/useRealtimeSettings";

export function VoiceSettings({
  controller,
}: {
  controller: RealtimeSettingsController;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.voice.description")}</p>
      </header>
      <div className="settings-card settings-fields voice-settings-card">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.voice.voice")}</strong>
            <small>{t("settings.voice.voiceDetail")}</small>
          </span>
          <select
            aria-label={t("settings.voice.voice")}
            value={controller.voice}
            disabled={controller.loading || controller.saving}
            onChange={(event) =>
              void controller.setVoice(
                event.target.value as typeof controller.voice,
              )
            }
          >
            {controller.voices.map((voice) => (
              <option key={voice} value={voice}>
                {realtimeVoiceLabel(voice)}
              </option>
            ))}
          </select>
        </label>
        <div className="voice-capability-row">
          <span className="settings-field-description">
            <strong>{t("settings.voice.protocol")}</strong>
            <small>{t("settings.voice.protocolDetail")}</small>
          </span>
          <span className="voice-version">
            <AudioLines /> {t("settings.voice.v3")}
          </span>
        </div>
        <div className="voice-capability-row">
          <span className="settings-field-description">
            <strong>{t("settings.voice.microphone")}</strong>
            <small>{t("settings.voice.microphoneDetail")}</small>
          </span>
          <small>{t("settings.voice.microphoneOnDemand")}</small>
        </div>
      </div>
      <button
        className="settings-inline-refresh secondary-button"
        disabled={controller.loading}
        onClick={() => void controller.refresh()}
      >
        <RefreshCw className={controller.loading ? "spinning" : undefined} />
        {t(
          controller.loading
            ? "settings.voice.loading"
            : "settings.voice.refresh",
        )}
      </button>
      {controller.error && (
        <div className="inventory-message error" role="alert">
          {controller.error}
        </div>
      )}
      {controller.persistenceError && (
        <div className="inventory-message error" role="alert">
          {t("settings.persistence.error")} {controller.persistenceError}
        </div>
      )}
    </section>
  );
}
