import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { SettingsPageHeader } from "./SettingsPageHeader";
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
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIconButton } from "./RoundIcon";
import { IconToggle } from "./IconToggle";
import { IconSubheader } from "./IconSubheader";
import { Note } from "./Note";
import { Alert } from "./Alert";

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
      <SettingsPageHeader description={t("settings.general.description")} />
      <IconSubheader
        title={t("settings.general.applicationTitle")}
        subtitle={t("settings.general.applicationDetail")}
      />
      <CardStack className="settings-fields">
        <IconCard
          as="label"
          title={t("settings.language.title")}
          subtitle={t("settings.language.detail")}
          trailing={<select
            value={locale}
            aria-label={t("settings.language.title")}
            onChange={(event) =>
              setLocale(event.target.value === "en" ? "en" : "fr")
            }
          >
            <option value="fr">{t("settings.language.french")}</option>
            <option value="en">{t("settings.language.english")}</option>
          </select>}
        />
        <IconCard
          as="label"
          title={t("settings.fileOpener.title")}
          subtitle={t("settings.fileOpener.detail")}
          trailing={<select
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
          </select>}
        />
        <DefaultThreadSettingsField controller={defaultThread} />
        <IconCard
          title={t("settings.startup.title")}
          subtitle={t("settings.startup.detail")}
          trailing={<IconToggle
              checked={launchAtLogin.enabled}
              disabled={!launchAtLogin.available || launchAtLogin.loading}
              label={t("settings.startup.title")}
              onCheckedChange={(checked) =>
                void launchAtLogin.setEnabled(checked)
              }
              text={launchAtLogin.available
              ? t(
                  launchAtLogin.enabled
                    ? "settings.startup.enabled"
                    : "settings.startup.disabled",
                )
              : t("settings.startup.nativeOnly")}
            />}
        />
        <IconCard
          title={t("settings.appServerRestart.title")}
          subtitle={t("settings.appServerRestart.detail")}
          trailing={<div className="settings-browser-status">
            <RoundIconButton
              disabled={
                !appServerRestart.available || appServerRestart.restarting
              }
              icon={RefreshCw}
              iconClassName={appServerRestart.restarting ? "spin" : ""}
              label={t(
                appServerRestart.restarting
                  ? "settings.appServerRestart.running"
                  : "settings.appServerRestart.action",
              )}
              onClick={() => void appServerRestart.restart()}
              size="medium"
              variant="tertiary"
            />
          </div>}
        />
      </CardStack>
      <IconSubheader
        title={t("settings.general.maintenanceTitle")}
        subtitle={t("settings.general.maintenanceDetail")}
      />
      <AppUpdateSettings controller={appUpdate} />
      {persistenceError && (
        <Alert tone="error">
          {t("settings.persistence.error")} {persistenceError}
        </Alert>
      )}
      {defaultThread.error && (
        <Alert tone="error">
          {t("settings.defaultThread.error", {
            detail: defaultThread.error,
          })}
        </Alert>
      )}
      {appServerRestart.error && (
        <Alert tone="error">
          {t("settings.appServerRestart.error")} {appServerRestart.error}
        </Alert>
      )}
      {launchAtLogin.error && (
        <Alert tone="error">
          {t("settings.startup.error")} {launchAtLogin.error}
        </Alert>
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
      <SettingsPageHeader description={t("settings.browser.description")} />
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
        <div className="settings-toggle-row">
          <span className="settings-field-description">
            <strong>{t("settings.browser.enabledTitle")}</strong>
            <small>{t("settings.browser.enabledDetail")}</small>
          </span>
          <IconToggle
              checked={chromium.status?.enabled === true}
              disabled={
                !chromium.native ||
                chromium.loading ||
                chromium.status?.installing === true
              }
              label={t("settings.browser.enabledTitle")}
              onCheckedChange={(checked) => {
                if (checked) setConfirmInstall(true);
                else void chromium.disable(integrations.reloadMcp);
              }}
              text={t(
              chromium.status?.enabled
                ? "settings.browser.enabled"
                : "settings.browser.disabled",
              )}
            />
        </div>
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
                <RoundIconButton
                  disabled={chromium.loading}
                  icon={RefreshCw}
                  label={t("settings.chromium.repair")}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                  variant="secondary"
                />
              </>
            ) : chromium.status?.enabled && chromium.status.available ? (
              <>
                <strong>{t("settings.chromium.needsRepair")}</strong>
                <RoundIconButton
                  disabled={chromium.loading}
                  icon={RefreshCw}
                  label={t("settings.chromium.repair")}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                  variant="secondary"
                />
              </>
            ) : chromium.status?.installing ? (
              <RoundIconButton label={t("settings.chromium.cancel")} onClick={() => void chromium.cancelInstall()} variant="secondary" />
            ) : confirmInstall ? (
              <div className="settings-browser-confirm" role="group">
                <small>{t("settings.chromium.confirm")}</small>
                <span>
                  <RoundIconButton
                    label={t("common.cancel")}
                    onClick={() => setConfirmInstall(false)}
                    variant="secondary"
                  />
                  <RoundIconButton
                    disabled={!chromium.status?.installSupported}
                    label={t("common.confirm")}
                    onClick={() => {
                      setConfirmInstall(false);
                      void chromium.install(integrations.reloadMcp);
                    }}
                    variant="primary"
                  />
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
      <Note
        title={t("settings.browser.routingTitle")}
      >
        {t("settings.browser.routingDetail")}
      </Note>
      {chromium.native &&
        !chromium.loading &&
        !chromium.status?.available &&
        !chromium.status?.installSupported && (
          <Alert>
            {t("settings.chromium.unsupported")}
          </Alert>
        )}
      {chromium.error && (
        <Alert tone="error">
          {t("settings.chromium.error")} {chromium.error}
        </Alert>
      )}
      {globalSettings.error && (
        <Alert tone="error">
          {t("webSearch.error")} {globalSettings.error}
        </Alert>
      )}
    </section>
  );
}
