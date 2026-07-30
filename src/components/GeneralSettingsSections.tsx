import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type {
  FileOpener,
  WebSearchMode,
} from "../lib/protocol";
import { useChromium } from "../lib/useChromium";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { IntegrationsController } from "../lib/useIntegrations";
import { useLaunchAtLogin } from "../lib/useLaunchAtLogin";
import type { DefaultThreadSettingsController } from "../lib/useDefaultThreadSettings";
import { DefaultThreadSettingsField } from "./DefaultThreadSettingsField";
import type { AppUpdateController } from "../lib/useAppUpdate";
import { AppUpdateSettings } from "./AppUpdateSettings";

export type AppServerRestartController = {
  available: boolean;
  error?: string;
  restart: () => Promise<boolean>;
  restarting: boolean;
};

const webSearchModes: WebSearchMode[] = [
  "cached",
  "indexed",
  "live",
  "disabled",
];
const fileOpeners: FileOpener[] = [
  "vscode",
  "vscode-insiders",
  "cursor",
  "windsurf",
  "none",
];

export function GeneralSettings({
  appUpdate,
  appServerRestart,
  defaultThread,
  globalSettings,
}: {
  appUpdate: AppUpdateController;
  appServerRestart: AppServerRestartController;
  defaultThread: DefaultThreadSettingsController;
  globalSettings: CodexGlobalSettingsController;
}) {
  const { locale, persistenceError, setLocale, t } = useI18n();
  const launchAtLogin = useLaunchAtLogin();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.general.description")}</p>
      </header>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.language.title")}</strong>
            <small>{t("settings.language.detail")}</small>
          </span>
          <select
            value={locale}
            aria-label={t("settings.language.title")}
            onChange={(event) =>
              setLocale(event.target.value === "en" ? "en" : "fr")
            }
          >
            <option value="fr">{t("settings.language.french")}</option>
            <option value="en">{t("settings.language.english")}</option>
          </select>
        </label>
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.fileOpener.title")}</strong>
            <small>{t("settings.fileOpener.detail")}</small>
          </span>
          <select
            aria-label={t("settings.fileOpener.title")}
            disabled={globalSettings.loading}
            value={globalSettings.fileOpener}
            onChange={(event) =>
              void globalSettings.setFileOpener(
                event.target.value as FileOpener,
              )
            }
          >
            {fileOpeners.map((opener) => (
              <option key={opener} value={opener}>
                {t(`settings.fileOpener.${opener}`)}
              </option>
            ))}
          </select>
        </label>
        <DefaultThreadSettingsField controller={defaultThread} />
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.startup.title")}</strong>
            <small>{t("settings.startup.detail")}</small>
          </span>
          <span className="startup-toggle">
            <input
              type="checkbox"
              checked={launchAtLogin.enabled}
              disabled={!launchAtLogin.available || launchAtLogin.loading}
              aria-label={t("settings.startup.title")}
              onChange={(event) =>
                void launchAtLogin.setEnabled(event.target.checked)
              }
            />
            {launchAtLogin.available
              ? t(
                  launchAtLogin.enabled
                    ? "settings.startup.enabled"
                    : "settings.startup.disabled",
                )
              : t("settings.startup.nativeOnly")}
          </span>
        </label>
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.appServerRestart.title")}</strong>
            <small>{t("settings.appServerRestart.detail")}</small>
          </span>
          <div className="settings-browser-status">
            <button
              className="app-server-restart-button secondary-button"
              disabled={
                !appServerRestart.available || appServerRestart.restarting
              }
              onClick={() => void appServerRestart.restart()}
            >
              <RefreshCw
                className={appServerRestart.restarting ? "spin" : ""}
              />
              {t(
                appServerRestart.restarting
                  ? "settings.appServerRestart.running"
                  : "settings.appServerRestart.action",
              )}
            </button>
          </div>
        </div>
      </div>
      <AppUpdateSettings controller={appUpdate} />
      {persistenceError && (
        <div className="inventory-message error" role="alert">
          {t("settings.persistence.error")} {persistenceError}
        </div>
      )}
      {defaultThread.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.defaultThread.error", {
            detail: defaultThread.error,
          })}
        </div>
      )}
      {appServerRestart.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.appServerRestart.error")} {appServerRestart.error}
        </div>
      )}
      {launchAtLogin.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.startup.error")} {launchAtLogin.error}
        </div>
      )}
    </section>
  );
}

export function BrowserSettings({
  integrations,
  globalSettings,
}: {
  integrations: IntegrationsController;
  globalSettings: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const chromium = useChromium();
  const [confirmInstall, setConfirmInstall] = useState(false);

  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.browser.description")}</p>
      </header>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("webSearch.title")}</strong>
            <small>{t("webSearch.globalDetail")}</small>
          </span>
          <select
            aria-label={t("webSearch.title")}
            disabled={
              globalSettings.loading || Boolean(globalSettings.updating)
            }
            value={globalSettings.mode}
            onChange={(event) =>
              void globalSettings.setMode(event.target.value as WebSearchMode)
            }
          >
            {webSearchModes.map((mode) => (
              <option
                disabled={
                  globalSettings.allowed !== undefined &&
                  !globalSettings.allowed.includes(mode)
                }
                key={mode}
                value={mode}
              >
                {t(`webSearch.${mode}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.browser.enabledTitle")}</strong>
            <small>{t("settings.browser.enabledDetail")}</small>
          </span>
          <span className="startup-toggle">
            <input
              type="checkbox"
              checked={chromium.status?.enabled === true}
              disabled={
                !chromium.native ||
                chromium.loading ||
                chromium.status?.installing === true
              }
              aria-label={t("settings.browser.enabledTitle")}
              onChange={(event) => {
                if (event.target.checked) setConfirmInstall(true);
                else void chromium.disable(integrations.reloadMcp);
              }}
            />
            {t(
              chromium.status?.enabled
                ? "settings.browser.enabled"
                : "settings.browser.disabled",
            )}
          </span>
        </label>
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.chromium.title")}</strong>
            <small>{t("settings.chromium.detail")}</small>
          </span>
          <div className="settings-browser-status">
            {!chromium.native ? (
              <small>{t("settings.chromium.nativeOnly")}</small>
            ) : chromium.status?.enabled &&
              chromium.status.available &&
              chromium.status.running ? (
              <>
                <strong>{t("settings.chromium.ready")}</strong>
                <small>
                  {[
                    chromium.status.version,
                    chromium.status.mcpVersion
                      ? `MCP ${chromium.status.mcpVersion}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <button
                  className="secondary-button"
                  disabled={chromium.loading}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                >
                  {t("settings.chromium.repair")}
                </button>
              </>
            ) : chromium.status?.enabled && chromium.status.available ? (
              <>
                <strong>{t("settings.chromium.needsRepair")}</strong>
                <button
                  className="secondary-button"
                  disabled={chromium.loading}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                >
                  {t("settings.chromium.repair")}
                </button>
              </>
            ) : chromium.status?.installing ? (
              <button onClick={() => void chromium.cancelInstall()}>
                {t("settings.chromium.cancel")}
              </button>
            ) : confirmInstall ? (
              <div className="settings-browser-confirm" role="group">
                <small>{t("settings.chromium.confirm")}</small>
                <span>
                  <button
                    className="secondary-button"
                    onClick={() => setConfirmInstall(false)}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    disabled={!chromium.status?.installSupported}
                    onClick={() => {
                      setConfirmInstall(false);
                      void chromium.install(integrations.reloadMcp);
                    }}
                  >
                    {t("common.confirm")}
                  </button>
                </span>
              </div>
            ) : (
              <small>
                {chromium.status?.available
                  ? t("settings.browser.installedInactive")
                  : t("settings.browser.downloadOnEnable")}
              </small>
            )}
          </div>
        </div>
      </div>
      <div className="settings-card">
        <div className="settings-explanation">
          <span>
            <strong>{t("settings.browser.routingTitle")}</strong>
            <small>{t("settings.browser.routingDetail")}</small>
          </span>
        </div>
      </div>
      {chromium.native &&
        !chromium.loading &&
        !chromium.status?.available &&
        !chromium.status?.installSupported && (
          <div className="inventory-message" role="status">
            {t("settings.chromium.unsupported")}
          </div>
        )}
      {chromium.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.chromium.error")} {chromium.error}
        </div>
      )}
      {globalSettings.error && (
        <div className="inventory-message error" role="alert">
          {t("webSearch.error")} {globalSettings.error}
        </div>
      )}
    </section>
  );
}
