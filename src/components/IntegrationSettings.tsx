import {
  AlertCircle,
  CheckCircle2,
  LogIn,
  Plus,
  Puzzle,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { McpAuthStatus } from "../lib/appServerTypes";
import type { IntegrationsController } from "../lib/useIntegrations";
import type { AppsController } from "../lib/useApps";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIconButton } from "./RoundIcon";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { McpServerAddDialog } from "./McpServerAddDialog";
import { McpServerRemoveDialog } from "./McpServerRemoveDialog";
import { useState } from "react";
import {
  SettingsControlsBar,
  SettingsControlsBarButton,
} from "./SettingsControlsBar";

export function AppsSettings({ apps }: { apps: AppsController }) {
  const { t } = useI18n();
  return (
    <section className="settings-page integrations-page">
      <SettingsPageHeader description={t("integrations.apps.globalHint")} />
      {apps.error && <InventoryError message={apps.error} />}
      <CardStack
        className="integration-list"
        controlBar={<SettingsControlsBar
          actions={
          <InventoryRefresh
            loading={apps.loading}
            onRefresh={apps.refresh}
          />
          }
          status={inventoryCount(apps.configurableApps.length, t)}
        />}
      >
        {apps.loading && apps.configurableApps.length === 0 ? (
          <InventoryLoading label={t("integrations.apps.loading")} />
        ) : apps.configurableApps.length === 0 ? (
          <InventoryEmpty label={t("integrations.apps.empty")} />
        ) : (
          apps.configurableApps.map((app) => (
            <IconCard
              icon={<Sparkles />}
              key={app.id}
              subtitle={app.description ?? t("integrations.apps.fallback")}
              title={app.name}
              trailing={<label className="integration-toggle">
                <input
                  type="checkbox"
                  checked={app.isEnabled}
                  disabled={apps.updatingApps.includes(app.id)}
                  onChange={(event) =>
                    void apps.setEnabled(app, event.target.checked)
                  }
                />
                <span>
                  {app.isEnabled
                    ? t("integrations.enabled")
                    : t("integrations.disabled")}
                </span>
              </label>}
            >
              <code>{app.id}</code>
            </IconCard>
          ))
        )}
      </CardStack>
    </section>
  );
}

export function SkillsSettings({
  integrations,
}: {
  integrations: IntegrationsController;
}) {
  const { t } = useI18n();
  const { skills } = integrations;
  return (
    <section className="settings-page integrations-page">
      <SettingsPageHeader description={t("integrations.skills.description")} />
      {skills.error && <InventoryError message={skills.error} />}
      <CardStack
        className="integration-list"
        controlBar={<SettingsControlsBar
          actions={
          <InventoryRefresh
            loading={skills.loading}
            onRefresh={integrations.refreshSkills}
          />
          }
          label={t("integrations.skills.title")}
          status={inventoryCount(skills.data.length, t)}
        />}
      >
        {skills.loading && skills.data.length === 0 ? (
          <InventoryLoading label={t("integrations.skills.loading")} />
        ) : skills.data.length === 0 ? (
          <InventoryEmpty label={t("integrations.skills.empty")} />
        ) : (
          skills.data.map((skill) => (
            <IconCard
              icon={<Sparkles />}
              key={skill.path}
              subtitle={skill.description || skill.path}
              title={skill.name}
              trailing={<label className="integration-toggle">
                <input
                  type="checkbox"
                  checked={skill.enabled}
                  disabled={integrations.updatingSkills.includes(skill.path)}
                  onChange={(event) =>
                    void integrations.setSkillEnabled(
                      skill,
                      event.target.checked,
                    )
                  }
                />
                <span>
                  {skill.enabled
                    ? t("integrations.enabled")
                    : t("integrations.disabled")}
                </span>
              </label>}
            >
              <code title={skill.path}>{skill.scope}</code>
            </IconCard>
          ))
        )}
      </CardStack>
      <CardStack className="planned-settings integration-planned">
        <IconCard
          icon={<Puzzle />}
          subtitle={t("integrations.plugins.detail")}
          title={t("integrations.plugins.title")}
          trailing={<em>{t("integrations.planned")}</em>}
        />
      </CardStack>
    </section>
  );
}

export function McpSettings({
  integrations,
}: {
  integrations: IntegrationsController;
}) {
  const { t } = useI18n();
  const { mcpServers } = integrations;
  const [adding, setAdding] = useState(false);
  const [removingName, setRemovingName] = useState<string>();
  return (
    <section className="settings-page integrations-page">
      <SettingsPageHeader description={t("integrations.mcp.description")} />
      {mcpServers.error && <InventoryError message={mcpServers.error} />}
      {integrations.mcpAuthNotice && (
        <div className="inventory-message neutral" role="status">
          <CheckCircle2 /> {integrations.mcpAuthNotice}
        </div>
      )}
      <CardStack
        className="integration-list mcp-server-list"
        controlBar={<SettingsControlsBar
          actions={
          <>
          <SettingsControlsBarButton icon={Plus} onClick={() => setAdding(true)}>
            {t("integrations.mcp.addAction")}
          </SettingsControlsBarButton>
          <SettingsControlsBarButton
            disabled={mcpServers.loading}
            icon={RefreshCw}
            iconClassName={mcpServers.loading ? "spin" : undefined}
            onClick={() => void integrations.refreshMcp()}
          >
            {t("integrations.refresh")}
          </SettingsControlsBarButton>
          <SettingsControlsBarButton
            disabled={integrations.reloadingMcp}
            icon={RefreshCw}
            iconClassName={integrations.reloadingMcp ? "spin" : undefined}
            onClick={() => void integrations.reloadMcp()}
          >
            {t("integrations.mcp.reloadConfig")}
          </SettingsControlsBarButton>
          </>
          }
          status={inventoryCount(mcpServers.data.length, t)}
        />}
      >
        {mcpServers.loading && mcpServers.data.length === 0 ? (
          <InventoryLoading label={t("integrations.mcp.loading")} />
        ) : mcpServers.data.length === 0 ? (
          <InventoryEmpty label={t("integrations.mcp.empty")} />
        ) : (
          mcpServers.data.map((server) => {
            const startup = integrations.mcpStartup[server.name];
            const signInRequired =
              server.authStatus === "notLoggedIn" ||
              startup?.failureReason === "reauthenticationRequired";
            const removable = integrations.removableMcpServers.includes(server.name);
            return (
            <IconCard
              className="mcp-server-row"
              icon={<Server />}
              key={server.name}
              subtitle={
                <>
                  {t(
                    Object.keys(server.tools).length === 1
                      ? "integrations.mcp.toolOne"
                      : "integrations.mcp.toolMany",
                    { count: Object.keys(server.tools).length },
                  )}
                  {server.serverInfo?.version
                    ? ` · ${t("integrations.mcp.version", {
                        version: server.serverInfo.version,
                      })}`
                    : ""}
                  {startup ? ` · ${startupLabel(startup.status, t)}` : ""}
                  {` · ${authLabel(server.authStatus, t)}`}
                </>
              }
              title={server.serverInfo?.title ?? server.name}
              trailing={(signInRequired || removable) ? <div className="mcp-server-actions">
                {signInRequired && (
                  <RoundIconButton
                    disabled={integrations.authenticatingMcp.includes(
                      server.name,
                    )}
                    icon={LogIn}
                    label={integrations.authenticatingMcp.includes(server.name)
                      ? t("integrations.auth.waiting")
                      : t("integrations.auth.signIn")}
                    onClick={() => void integrations.authenticateMcp(server)}
                    size="medium"
                    variant="secondary"
                  />
                )}
                {removable && (
                  <RoundIconButton
                    disabled={integrations.removingMcpServers.includes(server.name)}
                    icon={Trash2}
                    label={t("integrations.mcp.remove")}
                    onClick={() => setRemovingName(server.name)}
                    size="medium"
                    variant="secondary"
                  />
                )}
              </div> : undefined}
            >
                {startup?.status === "failed" && startup.error && (
                  <small className="mcp-startup-error" role="alert">
                    <AlertCircle aria-hidden="true" />
                    <span>{startup.error}</span>
                  </small>
                )}
            </IconCard>
            );
          })
        )}
      </CardStack>
      {adding && (
        <McpServerAddDialog
          adding={integrations.addingMcpServer}
          existingNames={mcpServers.data.map((server) => server.name)}
          onAdd={integrations.addMcpServer}
          onCancel={() => setAdding(false)}
        />
      )}
      {removingName && (
        <McpServerRemoveDialog
          name={removingName}
          removing={integrations.removingMcpServers.includes(removingName)}
          onCancel={() => setRemovingName(undefined)}
          onConfirm={() => void integrations.removeMcpServer(removingName)
            .then((removed) => removed && setRemovingName(undefined))}
        />
      )}
    </section>
  );
}

function InventoryRefresh({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  return (
      <SettingsControlsBarButton
        disabled={loading}
        icon={RefreshCw}
        iconClassName={loading ? "spin" : undefined}
        onClick={() => void onRefresh()}
      >
        {t("integrations.refresh")}
      </SettingsControlsBarButton>
  );
}

function inventoryCount(count: number, t: Translate) {
  return t(count === 1 ? "integrations.countOne" : "integrations.countMany", {
    count,
  });
}

function InventoryError({ message }: { message: string }) {
  return (
    <div className="inventory-message error" role="alert">
      <AlertCircle /> {message}
    </div>
  );
}

function InventoryLoading({ label }: { label: string }) {
  return <div className="inventory-empty">{label}</div>;
}

function InventoryEmpty({ label }: { label: string }) {
  return (
    <div className="inventory-empty">
      <CheckCircle2 /> {label}
    </div>
  );
}

function authLabel(status: McpAuthStatus, t: Translate) {
  if (status === "oAuth") return t("integrations.auth.oauth");
  if (status === "bearerToken") return t("integrations.auth.token");
  if (status === "notLoggedIn") return t("integrations.auth.required");
  return t("integrations.auth.none");
}

function startupLabel(
  status: "starting" | "ready" | "failed" | "cancelled",
  t: Translate,
) {
  return t(`integrations.mcp.startup.${status}`);
}
