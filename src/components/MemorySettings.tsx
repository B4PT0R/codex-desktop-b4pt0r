import { Brain, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIconButton } from "./RoundIcon";
import { IconToggle } from "./IconToggle";
import { IconSubheader } from "./IconSubheader";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { Note } from "./Note";
import { Alert } from "./Alert";
import type { MemorySettingsController } from "../lib/useMemorySettings";

export function MemorySettings({
  controller,
}: {
  controller: MemorySettingsController;
}) {
  const { t } = useI18n();
  const [confirmReset, setConfirmReset] = useState(false);
  const disabled = controller.loading || controller.saving;
  return (
    <section className="settings-page">
      <SettingsPageHeader
        badge={t("settings.memory.experimental")}
        badgeTone="experimental"
        description={t("settings.memory.description")}
      />
      <IconSubheader
        icon={<Brain />}
        title={t("settings.memory.localTitle")}
        subtitle={t("settings.memory.localDetail")}
      />
      <CardStack className="settings-fields memory-settings-fields">
        <MemoryToggle
          checked={controller.enabled}
          disabled={disabled}
          title={t("settings.memory.enabled")}
          detail={t("settings.memory.enabledDetail")}
          onChange={controller.setEnabled}
        />
        <MemoryToggle
          checked={controller.useMemories}
          disabled={disabled || !controller.enabled}
          title={t("settings.memory.use")}
          detail={t("settings.memory.useDetail")}
          onChange={controller.setUseMemories}
        />
        <MemoryToggle
          checked={controller.generateMemories}
          disabled={disabled || !controller.enabled}
          title={t("settings.memory.generate")}
          detail={t("settings.memory.generateDetail")}
          onChange={controller.setGenerateMemories}
        />
        <MemoryToggle
          checked={controller.disableOnExternalContext}
          disabled={disabled || !controller.enabled}
          title={t("settings.memory.external")}
          detail={t("settings.memory.externalDetail")}
          onChange={controller.setDisableOnExternalContext}
        />
        <IconCard
          as="label"
          title={t("settings.memory.threshold")}
          subtitle={t("settings.memory.thresholdDetail")}
          trailing={<span className="memory-threshold">
            <select
              aria-label={t("settings.memory.threshold")}
              disabled={disabled || !controller.enabled}
              value={controller.minRateLimitRemainingPercent}
              onChange={(event) =>
                void controller.setMinRateLimitRemainingPercent(
                  Number(event.target.value),
                )
              }
            >
              {Array.from(
                new Set([
                  0,
                  10,
                  25,
                  50,
                  controller.minRateLimitRemainingPercent,
                ]),
              )
                .sort((left, right) => left - right)
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </select>
            <span>%</span>
          </span>}
        />
      </CardStack>
      <Note
        className="memory-privacy-note"
        title={t("settings.memory.guidanceTitle")}
      >
        {t("settings.memory.guidanceDetail")}
      </Note>
      <CardStack className="memory-reset-card">
        <IconCard
          title={t("settings.memory.reset")}
          subtitle={t("settings.memory.resetDetail")}
          trailing={confirmReset ? (
          <span className="memory-reset-confirm">
            <RoundIconButton
              label={t("common.cancel")}
              onClick={() => setConfirmReset(false)}
              size="medium"
              variant="secondary"
            />
            <RoundIconButton
              className="danger"
              disabled={controller.resetting}
              label={t("settings.memory.resetConfirm")}
              onClick={async () => {
                if (await controller.reset()) setConfirmReset(false);
              }}
              size="medium"
              variant="secondary"
            />
          </span>
        ) : (
          <RoundIconButton
            disabled={controller.resetting}
            icon={RotateCcw}
            label={t("settings.memory.resetAction")}
            onClick={() => setConfirmReset(true)}
            size="medium"
            variant="secondary"
          />
          )}
        />
      </CardStack>
      {controller.error && (
        <Alert tone="error">
          {t("settings.memory.error")} {controller.error}
        </Alert>
      )}
    </section>
  );
}

function MemoryToggle({
  checked,
  detail,
  disabled,
  onChange,
  title,
}: {
  checked: boolean;
  detail: string;
  disabled: boolean;
  onChange: (value: boolean) => Promise<boolean>;
  title: string;
}) {
  return (
    <IconCard
      as="label"
      title={title}
      subtitle={detail}
      trailing={<IconToggle
        checked={checked}
        disabled={disabled}
        label={title}
        onCheckedChange={(value) => void onChange(value)}
      />}
    />
  );
}
