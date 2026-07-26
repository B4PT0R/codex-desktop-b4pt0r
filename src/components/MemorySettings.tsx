import { Brain, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
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
      <header>
        <p>{t("settings.memory.description")}</p>
        <span className="planned-badge">{t("settings.memory.experimental")}</span>
      </header>
      <div className="settings-explanation">
        <Brain />
        <span>
          <strong>{t("settings.memory.localTitle")}</strong>
          <small>{t("settings.memory.localDetail")}</small>
        </span>
      </div>
      <div className="settings-card settings-fields memory-settings-fields">
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
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.memory.threshold")}</strong>
            <small>{t("settings.memory.thresholdDetail")}</small>
          </span>
          <span className="memory-threshold">
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
          </span>
        </label>
      </div>
      <div className="settings-explanation memory-privacy-note">
        <ShieldCheck />
        <span>
          <strong>{t("settings.memory.guidanceTitle")}</strong>
          <small>{t("settings.memory.guidanceDetail")}</small>
        </span>
      </div>
      <div className="memory-reset-row">
        <span>
          <strong>{t("settings.memory.reset")}</strong>
          <small>{t("settings.memory.resetDetail")}</small>
        </span>
        {confirmReset ? (
          <span className="memory-reset-confirm">
            <button onClick={() => setConfirmReset(false)}>
              {t("common.cancel")}
            </button>
            <button
              disabled={controller.resetting}
              onClick={async () => {
                if (await controller.reset()) setConfirmReset(false);
              }}
            >
              {t("settings.memory.resetConfirm")}
            </button>
          </span>
        ) : (
          <button
            className="secondary-button"
            disabled={controller.resetting}
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw />
            {t("settings.memory.resetAction")}
          </button>
        )}
      </div>
      {controller.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.memory.error")} {controller.error}
        </div>
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
    <label>
      <span className="settings-field-description">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <input
        aria-label={title}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => void onChange(event.target.checked)}
      />
    </label>
  );
}
