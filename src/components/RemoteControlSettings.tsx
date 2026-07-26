import {
  Link2,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { RemoteControlClient } from "../lib/appServerTypes";
import type { RemoteControlController } from "../lib/useRemoteControl";

export function RemoteControlSettings({
  controller,
}: {
  controller: RemoteControlController;
}) {
  const { t } = useI18n();
  const [confirmRevoke, setConfirmRevoke] = useState<string>();
  const status = controller.status?.status ?? "disabled";
  const busy =
    controller.loading || controller.enabling || controller.disabling;
  const enabled = status !== "disabled";

  return (
    <section className="settings-page remote-control-settings">
      <header>
        <p>{t("settings.remoteControl.description")}</p>
        <span className="planned-badge">
          {t("settings.remoteControl.experimental")}
        </span>
      </header>
      <div className="settings-explanation">
        <ShieldCheck />
        <span>
          <strong>{t("settings.remoteControl.securityTitle")}</strong>
          <small>{t("settings.remoteControl.securityDetail")}</small>
        </span>
      </div>
      {!controller.available && (
        <div className="inventory-message warning" role="status">
          <strong>{t("settings.remoteControl.desktopOnlyTitle")}</strong>
          <small>{t("settings.remoteControl.desktopOnlyDetail")}</small>
        </div>
      )}
      {!controller.allowed && (
        <div className="inventory-message warning" role="status">
          <strong>{t("settings.remoteControl.managedTitle")}</strong>
          <small>{t("settings.remoteControl.managedDetail")}</small>
        </div>
      )}
      <div className="settings-card remote-control-status-card">
        <span className={`remote-control-status-icon ${status}`}>
          <RadioTower />
        </span>
        <span>
          <strong>
            {controller.status?.serverName ||
              t("settings.remoteControl.thisDevice")}
          </strong>
          <small>{t(`settings.remoteControl.status.${status}`)}</small>
        </span>
        <span className={`remote-control-status-badge ${status}`}>
          {t(`settings.remoteControl.status.${status}`)}
        </span>
        <input
          aria-label={t("settings.remoteControl.enabled")}
          checked={enabled}
          disabled={
            busy ||
            !controller.available ||
            (!controller.allowed && !enabled)
          }
          type="checkbox"
          onChange={(event) =>
            void (event.target.checked
              ? controller.enable()
              : controller.disable())
          }
        />
      </div>
      {status === "errored" && (
        <button
          className="secondary-button remote-control-refresh"
          disabled={controller.loading}
          onClick={() => void controller.refresh()}
        >
          <RefreshCw />
          {t("settings.remoteControl.retry")}
        </button>
      )}
      {status === "connected" && controller.status?.environmentId && (
        <>
          <section className="remote-control-section">
            <header>
              <span>
                <h2>{t("settings.remoteControl.pairingTitle")}</h2>
                <p>{t("settings.remoteControl.pairingDetail")}</p>
              </span>
              {!controller.pairing && (
                <button
                  disabled={controller.pairingLoading}
                  onClick={() => void controller.startPairing()}
                >
                  <Link2 />
                  {controller.pairingLoading
                    ? t("settings.remoteControl.pairingStarting")
                    : t("settings.remoteControl.pairingAction")}
                </button>
              )}
            </header>
            {controller.pairing && (
              <div className="settings-card remote-control-pairing">
                <span>
                  <strong>{t("settings.remoteControl.pairingCode")}</strong>
                  <small>{t("settings.remoteControl.pairingCodeDetail")}</small>
                </span>
                <code>
                  {controller.pairing.manualPairingCode ??
                    controller.pairing.pairingCode}
                </code>
                <small>
                  {t("settings.remoteControl.pairingExpires", {
                    time: formatTimestamp(controller.pairing.expiresAt),
                  })}
                </small>
              </div>
            )}
            {controller.pairingClaimed && (
              <div className="inventory-message success" role="status">
                {t("settings.remoteControl.pairingClaimed")}
              </div>
            )}
          </section>
          <section className="remote-control-section">
            <header>
              <span>
                <h2>{t("settings.remoteControl.devicesTitle")}</h2>
                <p>{t("settings.remoteControl.devicesDetail")}</p>
              </span>
              <button
                className="secondary-button"
                disabled={controller.clientsLoading}
                onClick={() => void controller.refresh()}
              >
                <RefreshCw />
                {t("settings.remoteControl.refresh")}
              </button>
            </header>
            <div className="settings-card remote-control-devices">
              {controller.clientsLoading && controller.clients.length === 0 ? (
                <div className="remote-control-loading" role="status">
                  <span className="settings-loader-spinner" />
                  {t("settings.remoteControl.devicesLoading")}
                </div>
              ) : controller.clients.length === 0 ? (
                <div className="remote-control-empty">
                  <Smartphone />
                  <span>
                    <strong>{t("settings.remoteControl.devicesEmpty")}</strong>
                    <small>
                      {t("settings.remoteControl.devicesEmptyDetail")}
                    </small>
                  </span>
                </div>
              ) : (
                controller.clients.map((client) => (
                  <RemoteControlDevice
                    key={client.clientId}
                    client={client}
                    confirming={confirmRevoke === client.clientId}
                    revoking={
                      controller.revokingClientId === client.clientId
                    }
                    onCancel={() => setConfirmRevoke(undefined)}
                    onRevoke={async () => {
                      if (confirmRevoke !== client.clientId) {
                        setConfirmRevoke(client.clientId);
                        return;
                      }
                      if (await controller.revokeClient(client.clientId))
                        setConfirmRevoke(undefined);
                    }}
                  />
                ))
              )}
            </div>
            {controller.nextCursor && (
              <button
                className="secondary-button remote-control-load-more"
                disabled={controller.clientsLoading}
                onClick={() => void controller.loadMoreClients()}
              >
                {t("settings.remoteControl.loadMore")}
              </button>
            )}
          </section>
        </>
      )}
      {controller.error && (
        <div className="inventory-message error" role="alert">
          <strong>{t("settings.remoteControl.error")}</strong>
          <small>{controller.error}</small>
        </div>
      )}
    </section>
  );
}

function RemoteControlDevice({
  client,
  confirming,
  onCancel,
  onRevoke,
  revoking,
}: {
  client: RemoteControlClient;
  confirming: boolean;
  onCancel: () => void;
  onRevoke: () => Promise<void>;
  revoking: boolean;
}) {
  const { t } = useI18n();
  const detail = [
    client.deviceModel,
    client.platform,
    client.osVersion,
    client.appVersion
      ? t("settings.remoteControl.appVersion", { version: client.appVersion })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="remote-control-device">
      <Smartphone />
      <span>
        <strong>
          {client.displayName ||
            client.deviceType ||
            t("settings.remoteControl.unknownDevice")}
        </strong>
        {detail && <small>{detail}</small>}
        {client.lastSeenAt != null && (
          <small>
            {t("settings.remoteControl.lastSeen", {
              time: formatTimestamp(client.lastSeenAt),
            })}
          </small>
        )}
      </span>
      {confirming ? (
        <span className="remote-control-revoke-confirm">
          <small>{t("settings.remoteControl.revokeConfirm")}</small>
          <button onClick={onCancel}>{t("common.cancel")}</button>
          <button
            className="danger"
            disabled={revoking}
            onClick={() => void onRevoke()}
          >
            {t("settings.remoteControl.revoke")}
          </button>
        </span>
      ) : (
        <button
          className="secondary-button"
          aria-label={t("settings.remoteControl.revokeNamed", {
            name:
              client.displayName ??
              client.deviceType ??
              t("settings.remoteControl.unknownDevice"),
          })}
          onClick={() => void onRevoke()}
        >
          <Unplug />
          {t("settings.remoteControl.revoke")}
        </button>
      )}
    </div>
  );
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value * 1_000));
}
