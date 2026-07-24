import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Server,
  Sparkles,
} from "lucide-react";
import type { McpAuthStatus } from "../lib/appServerTypes";
import type { IntegrationsController } from "../lib/useIntegrations";
import type { AppsController } from "../lib/useApps";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";

export function SkillsSettings({
  apps,
  integrations,
}: {
  apps: AppsController;
  integrations: IntegrationsController;
}) {
  const { t } = useI18n();
  const { skills } = integrations;
  return (
    <section className="settings-page integrations-page">
      <header>
        <p>{t("integrations.skills.description")}</p>
        <InventoryActions
          count={skills.data.length}
          loading={skills.loading}
          onRefresh={integrations.refreshSkills}
        />
      </header>
      {skills.error && <InventoryError message={skills.error} />}
      {apps.error && <InventoryError message={apps.error} />}
      <div className="settings-card integration-list">
        <div className="integration-section-heading">
          <strong>{t("integrations.apps.title")}</strong>
          <button disabled={apps.loading} onClick={() => void apps.refresh()}>
            {t("integrations.refresh")}
          </button>
        </div>
        {apps.loading && apps.apps.length === 0 ? (
          <InventoryLoading label={t("integrations.apps.loading")} />
        ) : apps.apps.length === 0 ? (
          <InventoryEmpty label={t("integrations.apps.empty")} />
        ) : (
          apps.apps.map((app) => (
            <div className="integration-row" key={app.id}>
              <Sparkles />
              <span>
                <strong>{app.name}</strong>
                <small>
                  {app.description ?? t("integrations.apps.fallback")}
                </small>
                <code>{app.id}</code>
              </span>
              <span className="auth-status">{t("integrations.available")}</span>
            </div>
          ))
        )}
      </div>
      <h2 className="integration-subtitle">{t("integrations.skills.title")}</h2>
      <div className="settings-card integration-list">
        {skills.loading && skills.data.length === 0 ? (
          <InventoryLoading label={t("integrations.skills.loading")} />
        ) : skills.data.length === 0 ? (
          <InventoryEmpty label={t("integrations.skills.empty")} />
        ) : (
          skills.data.map((skill) => (
            <div className="integration-row" key={skill.path}>
              <Sparkles />
              <span>
                <strong>{skill.name}</strong>
                <small>{skill.description || skill.path}</small>
                <code title={skill.path}>{skill.scope}</code>
              </span>
              <label className="integration-toggle">
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
              </label>
            </div>
          ))
        )}
      </div>
      <div className="settings-card planned-settings integration-planned">
        <div>
          <span>
            <strong>{t("integrations.plugins.title")}</strong>
            <small>{t("integrations.plugins.detail")}</small>
          </span>
          <em>{t("integrations.planned")}</em>
        </div>
      </div>
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
  return (
    <section className="settings-page integrations-page">
      <header>
        <p>{t("integrations.mcp.description")}</p>
        <InventoryActions
          count={mcpServers.data.length}
          loading={mcpServers.loading}
          onRefresh={integrations.refreshMcp}
        />
      </header>
      {mcpServers.error && <InventoryError message={mcpServers.error} />}
      {integrations.mcpAuthNotice && (
        <div className="inventory-message neutral" role="status">
          <CheckCircle2 /> {integrations.mcpAuthNotice}
        </div>
      )}
      <div className="settings-card integration-list">
        {mcpServers.loading && mcpServers.data.length === 0 ? (
          <InventoryLoading label={t("integrations.mcp.loading")} />
        ) : mcpServers.data.length === 0 ? (
          <InventoryEmpty label={t("integrations.mcp.empty")} />
        ) : (
          mcpServers.data.map((server) => (
            <div className="integration-row" key={server.name}>
              <Server />
              <span>
                <strong>{server.serverInfo?.title ?? server.name}</strong>
                <small>
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
                </small>
                <code>{server.name}</code>
              </span>
              <div className="mcp-auth-actions">
                <span className={`auth-status ${server.authStatus}`}>
                  {authLabel(server.authStatus, t)}
                </span>
                {server.authStatus === "notLoggedIn" && (
                  <button
                    disabled={integrations.authenticatingMcp.includes(
                      server.name,
                    )}
                    onClick={() => void integrations.authenticateMcp(server)}
                  >
                    {integrations.authenticatingMcp.includes(server.name)
                      ? t("integrations.auth.waiting")
                      : t("integrations.auth.signIn")}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InventoryActions({
  count,
  loading,
  onRefresh,
}: {
  count: number;
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <div className="inventory-actions">
      <span>
        {t(count === 1 ? "integrations.countOne" : "integrations.countMany", {
          count,
        })}
      </span>
      <button disabled={loading} onClick={() => void onRefresh()}>
        <RefreshCw className={loading ? "spin" : undefined} />
        {t("integrations.refresh")}
      </button>
    </div>
  );
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
