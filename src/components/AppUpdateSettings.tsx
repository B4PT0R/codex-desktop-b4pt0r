import { Check, Download, ExternalLink, RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppUpdateController } from "../lib/useAppUpdate";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { IconButton } from "./IconButton";
import { Alert } from "./Alert";

export function AppUpdateSettings({
  controller,
}: {
  controller: AppUpdateController;
}) {
  const { t } = useI18n();
  const status = controller.status;
  const canInstall =
    status?.updateAvailable === true &&
    status.assetAvailable &&
    status.installMode === "automatic";
  const canOpenRelease =
    status?.updateAvailable === true && status.installMode === "manual";

  return (
    <>
      <CardStack className="settings-fields app-update-card">
        <IconCard
          title={t("settings.updates.client")}
          subtitle={updateMessage(controller, t)}
          trailing={<div className="settings-browser-status">
            <code className="app-version-value">
              {controller.versions
                ? `v${controller.versions.clientVersion}`
                : t("settings.updates.loading")}
            </code>
            {controller.updateInstalled ? (
              <IconButton
                disabled
                icon={Check}
                label={t("settings.updates.installed")}
                size="medium"
                variant="tertiary"
              />
            ) : canInstall ? (
              <IconButton
                disabled={controller.installing}
                icon={Download}
                label={t(controller.installing
                  ? "settings.updates.installing"
                  : "settings.updates.install")}
                onClick={() => void controller.install()}
                size="medium"
                variant="tertiary"
              />
            ) : canOpenRelease ? (
              <IconButton
                icon={ExternalLink}
                label={t("settings.updates.openRelease")}
                onClick={() => void controller.openRelease()}
                size="medium"
                variant="tertiary"
              />
            ) : (
              <IconButton
                disabled={!controller.native || controller.checking || controller.loadingVersions}
                icon={RefreshCw}
                iconClassName={controller.checking ? "spin" : ""}
                label={t(controller.checking
                  ? "settings.updates.checking"
                  : "settings.updates.check")}
                onClick={() => void controller.check()}
                size="medium"
                variant="tertiary"
              />
            )}
          </div>}
        />
        <IconCard
          title={t("settings.updates.codex")}
          subtitle={t("settings.updates.codexDetail", {
            version: controller.versions?.minimumCodexVersion ?? "0.146.0",
          })}
          trailing={<div className="settings-browser-status">
            <code className="app-version-value">
              {controller.versions?.codexVersion ??
                (controller.loadingVersions
                  ? t("settings.updates.loading")
                  : t("settings.updates.unavailable"))}
            </code>
            {(controller.status?.codexUpdate.updateAvailable ||
              controller.versions?.codexCompatible === false) && (
              <IconButton
                disabled={controller.codexUpdating}
                icon={controller.codexUpdateInstalled ? Check : Download}
                label={t(controller.codexUpdateInstalled
                  ? "settings.updates.codexInstalled"
                  : controller.codexUpdating
                    ? "settings.updates.codexUpdating"
                    : "settings.updates.install")}
                onClick={() => void controller.updateCodex()}
                size="medium"
                variant="tertiary"
              />
            )}
          </div>}
        />
      </CardStack>
      {controller.updateInstalled && (
        <Alert
          className="app-update-restart-message"
          tone="neutral"
          aria-live="polite"
        >
          <Check />
          {t("settings.updates.restartRequired")}
        </Alert>
      )}
      {controller.codexUpdateInstalled && (
        <Alert
          className="app-update-restart-message"
          tone="neutral"
          aria-live="polite"
        >
          <Check />
          {t("settings.updates.codexRestartRequired")}
        </Alert>
      )}
      {controller.versions?.codexCompatible === false &&
        !controller.codexUpdateInstalled && (
          <Alert tone="warning">
            {t("settings.updates.codexIncompatible", {
              version: controller.versions.minimumCodexVersion,
            })}
          </Alert>
        )}
      {controller.error && (
        <Alert tone="error">
          {t("settings.updates.error")} {controller.error}
        </Alert>
      )}
      {controller.versions?.codexError && (
        <Alert>
          {t("settings.updates.codexError")}{" "}
          {controller.versions.codexError}
        </Alert>
      )}
      {controller.status?.codexUpdate.error && (
        <Alert>
          {t("settings.updates.codexCheckError")} {controller.status.codexUpdate.error}
        </Alert>
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
  if (controller.status.installMode === "manual") {
    return t("settings.updates.manual", {
      version: controller.status.latestVersion,
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
