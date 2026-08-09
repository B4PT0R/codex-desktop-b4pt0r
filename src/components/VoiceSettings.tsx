import { useState } from "react";
import { AudioLines, Pencil, RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { realtimeVoiceLabel } from "../lib/realtimeVoices";
import type { RealtimeSettingsController } from "../lib/useRealtimeSettings";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { IconButton } from "./IconButton";
import { Alert } from "./Alert";
import { VoiceInstructionsDialog } from "./VoiceInstructionsDialog";

export function VoiceSettings({
  controller,
}: {
  controller: RealtimeSettingsController;
}) {
  const { t } = useI18n();
  const [editingInstructions, setEditingInstructions] = useState(false);
  return (
    <section className="settings-page">
      <SettingsPageHeader description={t("settings.voice.description")} />
      <CardStack className="settings-fields voice-settings-card">
        <IconCard
          as="label"
          title={t("settings.voice.voice")}
          subtitle={t("settings.voice.voiceDetail")}
          trailing={<span className="voice-picker-controls">
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
            <IconButton
              disabled={controller.loading}
              icon={RefreshCw}
              iconClassName={controller.loading ? "spinning" : undefined}
              label={t(
                controller.loading
                  ? "settings.voice.loading"
                  : "settings.voice.refresh",
              )}
              onClick={() => void controller.refresh()}
              size="medium"
              variant="tertiary"
            />
          </span>}
        />
        <IconCard
          title={t("settings.voice.instructions")}
          subtitle={t("settings.voice.instructionsDetail")}
          trailing={
            <IconButton
              aria-label={t("settings.voice.instructionsEdit")}
              gap="small"
              icon={Pencil}
              label={t("settings.voice.instructionsEdit")}
              onClick={() => setEditingInstructions(true)}
              size="medium"
              variant="tertiary"
            />
          }
        />
        <IconCard
          title={t("settings.voice.protocol")}
          subtitle={t("settings.voice.protocolDetail")}
          trailing={<span className="voice-version">
            <AudioLines /> {t("settings.voice.v3")}
          </span>}
        />
        <IconCard
          title={t("settings.voice.microphone")}
          subtitle={t("settings.voice.microphoneDetail")}
          trailing={<small className="voice-microphone-on-demand">
            {t("settings.voice.microphoneOnDemand")}
          </small>}
        />
      </CardStack>
      {controller.error && (
        <Alert tone="error">
          {controller.error}
        </Alert>
      )}
      {controller.persistenceError && (
        <Alert tone="error">
          {t("settings.persistence.error")} {controller.persistenceError}
        </Alert>
      )}
      {editingInstructions && (
        <VoiceInstructionsDialog
          initialValue={controller.voiceInstructions}
          onCancel={() => setEditingInstructions(false)}
          onSave={controller.setVoiceInstructions}
          saving={controller.saving}
        />
      )}
    </section>
  );
}
