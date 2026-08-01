import {
  AlertCircle,
  CheckCircle2,
  LogIn,
  Plus,
  Puzzle,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AppInfo, McpAuthStatus } from "../lib/appServerTypes";
import type { IntegrationsController } from "../lib/useIntegrations";
import type { AppConfigurationEditorData, AppsController } from "../lib/useApps";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIconButton } from "./RoundIcon";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { McpServerAddDialog } from "./McpServerAddDialog";
import { McpServerRemoveDialog } from "./McpServerRemoveDialog";
import { useRef, useState } from "react";
import { AppConfigurationDialog, AppConfigurationLoadingDialog } from "./AppConfigurationDialog";
import { AppCatalogDialog } from "./AppCatalogDialog";
import { AppDefaultsSettings } from "./AppDefaultsSettings";
import { IconSubheader } from "./IconSubheader";
import { SkillCreateDialog } from "./SkillCreateDialog";
import {
  SettingsControlsBar,
  SettingsControlsBarButton,
} from "./SettingsControlsBar";
import { Alert } from "./Alert";

export function AppsSettings({ apps }: { apps: AppsController }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<AppInfo>();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editorData, setEditorData] = useState<AppConfigurationEditorData>();
  const editorRequest = useRef(0);
  const openConfiguration = (target: AppInfo) => {
    const requestId = ++editorRequest.current;
    setEditing(target);
    setEditorData(undefined);
    void apps.readConfiguration(target).then((data) => {
      if (requestId !== editorRequest.current) return;
      if (data) setEditorData(data);
      else setEditing(undefined);
    });
  };
  const closeConfiguration = () => {
    editorRequest.current += 1;
    setEditing(undefined);
    setEditorData(undefined);
  };
  return (
    <section className="settings-page integrations-page">
      <SettingsPageHeader description={t("integrations.apps.globalHint")} />
      {apps.error && <InventoryError message={apps.error} />}
      <div className="app-inventory-section">
        <IconSubheader
          icon={<Sparkles />}
          subtitle={t("integrations.apps.inventoryDetail")}
          title={t("integrations.apps.inventoryTitle")}
        />
        <CardStack
        className="integration-list"
        controlBar={<SettingsControlsBar
          actions={
          <>
            <SettingsControlsBarButton icon={Sparkles} onClick={() => setCatalogOpen(true)}>{t("integrations.apps.browse")}</SettingsControlsBarButton>
            <InventoryRefresh loading={apps.loading} onRefresh={apps.refresh} />
          </>
          }
          status={t(apps.configurableApps.length === 1 ? "integrations.apps.connectedCountOne" : "integrations.apps.connectedCountMany", { count: apps.configurableApps.length })}
        />}
      >
        {apps.loading && apps.configurableApps.length === 0 ? (
          <InventoryLoading label={t("integrations.apps.loading")} />
        ) : apps.configurableApps.length === 0 ? (
          <InventoryEmpty label={t("integrations.apps.empty")} />
        ) : (
          apps.configurableApps.map((app) => {
            const installed = apps.installedApps[app.id];
            return (
            <IconCard
              icon={<Sparkles />}
              key={app.id}
              subtitle={<>
                {app.description ?? t("integrations.apps.fallback")}
                {installed ? ` · ${installed.callable ? t("integrations.apps.callable") : t("integrations.apps.notCallable")}` : ""}
              </>}
              title={app.name}
              trailing={<div className="app-card-actions">
                <RoundIconButton icon={Settings2} label={t("integrations.apps.configure")} onClick={() => openConfiguration(app)} size="medium" variant="secondary" />
                <label className="integration-toggle">
                  <input type="checkbox" checked={app.isEnabled} disabled={apps.updatingApps.includes(app.id)} onChange={(event) => void apps.setEnabled(app, event.target.checked)} />
                  <span>{app.isEnabled ? t("integrations.enabled") : t("integrations.disabled")}</span>
                </label>
              </div>}
            />
            );
          })
        )}
        </CardStack>
      </div>
      <AppDefaultsSettings apps={apps} />
      {catalogOpen && <AppCatalogDialog
        apps={apps}
        onCancel={() => setCatalogOpen(false)}
        onConfigure={(app) => { setCatalogOpen(false); openConfiguration(app); }}
      />}
      {editing && !editorData && <AppConfigurationLoadingDialog name={editing.name} onCancel={closeConfiguration} />}
      {editing && editorData && <AppConfigurationDialog
        key={editing.id}
        data={editorData}
        saving={apps.savingConfigurations.includes(editing.id)}
        onCancel={closeConfiguration}
        onSave={apps.saveConfiguration}
      />}
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
  const [creating, setCreating] = useState(false);
  return (
    <section className="settings-page integrations-page">
      <SettingsPageHeader description={t("integrations.skills.description")} />
      {skills.error && <InventoryError message={skills.error} />}
      <CardStack
        className="integration-list"
        controlBar={<SettingsControlsBar
          actions={
          <><SettingsControlsBarButton icon={Plus} onClick={() => setCreating(true)}>{t("integrations.skills.createAction")}</SettingsControlsBarButton><InventoryRefresh
            loading={skills.loading}
            onRefresh={integrations.refreshSkills}
          /></>
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
      {creating && <SkillCreateDialog creating={integrations.creatingSkill} onCancel={() => setCreating(false)} onCreate={integrations.createSkill} />}
    </section>
  );
}

export function PluginsSettings() {
  const { t } = useI18n();
  return <section className="settings-page integrations-page">
    <SettingsPageHeader description={t("integrations.plugins.description")} />
    <CardStack className="planned-settings integration-planned">
      <IconCard
        icon={<Puzzle />}
        subtitle={t("integrations.plugins.detail")}
        title={t("integrations.plugins.title")}
        trailing={<em>{t("integrations.planned")}</em>}
      />
    </CardStack>
  </section>;
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
        <Alert tone="neutral">
          <CheckCircle2 /> {integrations.mcpAuthNotice}
        </Alert>
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
    <Alert tone="error">
      <AlertCircle /> {message}
    </Alert>
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
