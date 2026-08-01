import {
  Link2,
  RadioTower,
  RefreshCw,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { IconCard } from "./IconCard";
import { CardStack } from "./CardStack";
import { RoundIconButton } from "./RoundIcon";
import { IconSubheader } from "./IconSubheader";
import { Note } from "./Note";
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
      <SettingsPageHeader
        badge={t("settings.remoteControl.experimental")}
        badgeTone="experimental"
        description={t("settings.remoteControl.description")}
      />
      <Note
        title={t("settings.remoteControl.securityTitle")}
      >
        {t("settings.remoteControl.securityDetail")}
      </Note>
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
      <CardStack>
        <IconCard
          className={`remote-control-local ${status}`}
          icon={<RadioTower />}
          subtitle={t(`settings.remoteControl.status.${status}`)}
          title={
            controller.status?.serverName ||
            t("settings.remoteControl.thisDevice")
          }
          trailing={<>
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
          </>}
        />
      </CardStack>
      {status === "errored" && (
        <RoundIconButton
          className="remote-control-refresh"
          disabled={controller.loading}
          icon={RefreshCw}
          label={t("settings.remoteControl.retry")}
          onClick={() => void controller.refresh()}
          variant="secondary"
        />
      )}
      {status === "connected" && controller.status?.environmentId && (
        <>
          <section className="remote-control-section">
            <header>
              <IconSubheader
                className="remote-control-section-subheader"
                icon={<Link2 />}
                title={t("settings.remoteControl.pairingTitle")}
                subtitle={t("settings.remoteControl.pairingDetail")}
              />
              {!controller.pairing && (
                <RoundIconButton
                  disabled={controller.pairingLoading}
                  icon={Link2}
                  label={controller.pairingLoading
                    ? t("settings.remoteControl.pairingStarting")
                    : t("settings.remoteControl.pairingAction")}
                  onClick={() => void controller.startPairing()}
                  variant="secondary"
                />
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
              <IconSubheader
                className="remote-control-section-subheader"
                icon={<Smartphone />}
                title={t("settings.remoteControl.devicesTitle")}
                subtitle={t("settings.remoteControl.devicesDetail")}
              />
              <RoundIconButton
                disabled={controller.clientsLoading}
                icon={RefreshCw}
                label={t("settings.remoteControl.refresh")}
                onClick={() => void controller.refresh()}
                variant="secondary"
              />
            </header>
            <CardStack className="remote-control-devices">
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
            </CardStack>
            {controller.nextCursor && (
              <RoundIconButton
                className="remote-control-load-more"
                disabled={controller.clientsLoading}
                label={t("settings.remoteControl.loadMore")}
                onClick={() => void controller.loadMoreClients()}
                variant="secondary"
              />
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
    <IconCard
      className="remote-control-device"
      icon={<Smartphone />}
      title={client.displayName ||
        client.deviceType ||
        t("settings.remoteControl.unknownDevice")}
      subtitle={detail || undefined}
      trailing={confirming ? (
        <span className="remote-control-revoke-confirm">
          <small>{t("settings.remoteControl.revokeConfirm")}</small>
          <RoundIconButton label={t("common.cancel")} onClick={onCancel} variant="secondary" />
          <RoundIconButton
            className="danger"
            disabled={revoking}
            label={t("settings.remoteControl.revoke")}
            onClick={() => void onRevoke()}
            variant="secondary"
          />
        </span>
      ) : (
        <RoundIconButton
          aria-label={t("settings.remoteControl.revokeNamed", {
            name:
              client.displayName ??
              client.deviceType ??
              t("settings.remoteControl.unknownDevice"),
          })}
          icon={Unplug}
          label={t("settings.remoteControl.revoke")}
          onClick={() => void onRevoke()}
          variant="secondary"
        />
      )}
    >
      {client.lastSeenAt != null && (
        <small>
          {t("settings.remoteControl.lastSeen", {
            time: formatTimestamp(client.lastSeenAt),
          })}
        </small>
      )}
    </IconCard>
  );
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value * 1_000));
}
