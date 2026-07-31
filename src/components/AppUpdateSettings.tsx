import { Check, Download, RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppUpdateController } from "../lib/useAppUpdate";

export function AppUpdateSettings({
  controller,
}: {
  controller: AppUpdateController;
}) {
  const { t } = useI18n();
  const status = controller.status;
  const canInstall =
    status?.updateAvailable === true && status.assetAvailable;

  return (
    <>
      <div className="settings-card settings-fields app-update-card">
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.updates.client")}</strong>
            <small>{t("settings.updates.clientDetail")}</small>
          </span>
          <code className="app-version-value">
            {controller.versions
              ? `v${controller.versions.clientVersion}`
              : t("settings.updates.loading")}
          </code>
        </div>
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.updates.codex")}</strong>
            <small>{t("settings.updates.codexDetail")}</small>
          </span>
          <code className="app-version-value">
            {controller.versions?.codexVersion ??
              (controller.loadingVersions
                ? t("settings.updates.loading")
                : t("settings.updates.unavailable"))}
          </code>
        </div>
        <div className="settings-browser-row app-update-action-row">
          <span className="settings-field-description">
            <strong>{t("settings.updates.title")}</strong>
            <small>{updateMessage(controller, t)}</small>
          </span>
          <div className="settings-browser-status">
            {controller.updateInstalled ? (
              <button
                className="app-server-restart-button secondary-button"
                disabled
              >
                <Check />
                {t("settings.updates.installed")}
              </button>
            ) : canInstall ? (
              <button
                className="app-server-restart-button secondary-button"
                disabled={controller.installing}
                onClick={() => void controller.install()}
              >
                <Download />
                {t(
                  controller.installing
                    ? "settings.updates.installing"
                    : "settings.updates.install",
                )}
              </button>
            ) : (
              <button
                className="app-server-restart-button secondary-button"
                disabled={
                  !controller.native ||
                  controller.checking ||
                  controller.loadingVersions
                }
                onClick={() => void controller.check()}
              >
                <RefreshCw className={controller.checking ? "spin" : ""} />
                {t(
                  controller.checking
                    ? "settings.updates.checking"
                    : "settings.updates.check",
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {controller.updateInstalled && (
        <div
          className="inventory-message neutral app-update-restart-message"
          role="status"
          aria-live="polite"
        >
          <Check />
          {t("settings.updates.restartRequired")}
        </div>
      )}
      {controller.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.updates.error")} {controller.error}
        </div>
      )}
      {controller.versions?.codexError && (
        <div className="inventory-message warning">
          {t("settings.updates.codexError")}{" "}
          {controller.versions.codexError}
        </div>
      )}
    </>
  );
}

function updateMessage(
  controller: AppUpdateController,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!controller.native) return t("settings.updates.nativeOnly");
  if (controller.updateInstalled) return t("settings.updates.installComplete");
  if (controller.checking) return t("settings.updates.checkingDetail");
  if (!controller.status) return t("settings.updates.detail");
  if (!controller.status.updateAvailable) {
    return t("settings.updates.current", {
      version: controller.status.currentVersion,
    });
  }
  if (!controller.status.assetAvailable) {
    return t("settings.updates.assetUnavailable", {
      version: controller.status.latestVersion,
    });
  }
  return t("settings.updates.available", {
    version: controller.status.latestVersion,
  });
}
