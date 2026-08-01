import { RotateCcw } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { RoundIconButton } from "./RoundIcon";
import type { SettingsViewProps } from "./SettingsView";

let settingsModule: Promise<ComponentType<SettingsViewProps>> | undefined;

function loadSettings() {
  settingsModule ??= import("./SettingsView")
    .then(({ SettingsView }) => SettingsView)
    .catch((error) => {
      settingsModule = undefined;
      throw error;
    });
  return settingsModule;
}

export function SettingsLoader(props: SettingsViewProps) {
  const { t } = useI18n();
  const [View, setView] = useState<ComponentType<SettingsViewProps>>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    setError(undefined);
    void loadSettings()
      .then((component) => {
        if (!disposed) setView(() => component);
      })
      .catch((cause) => {
        if (!disposed)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      disposed = true;
    };
  }, [attempt]);

  if (View) return <View {...props} />;

  return (
    <main className="settings-loader">
      {error ? (
        <div role="alert">
          <strong>{t("settings.loadError")}</strong>
          <small>{error}</small>
          <span>
            <RoundIconButton label={t("settings.back")} onClick={props.onClose} variant="secondary" />
            <RoundIconButton
              icon={RotateCcw}
              label={t("settings.retry")}
              onClick={() => setAttempt((value) => value + 1)}
              variant="secondary"
            />
          </span>
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <span className="settings-loader-spinner" />
          <span>{t("settings.loading")}</span>
        </div>
      )}
    </main>
  );
}
