import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useCodexConfig } from "../lib/useCodexConfig";
import type {
  CodexGlobalSettingsController,
  CredentialStore,
} from "../lib/useCodexGlobalSettings";
import { ConfigDocumentEditor } from "./ConfigDocumentEditor";
import { GlobalAgentsSettings } from "./GlobalAgentsSettings";
import { RoundIconButton } from "./RoundIcon";

const compactLimits = [32_000, 64_000, 128_000];
const toolOutputLimits = [4_000, 8_000, 12_000, 24_000];
const projectDocLimits = [16_384, 32_768, 65_536, 131_072];
const credentialStores: CredentialStore[] = ["auto", "file", "keyring"];

export function CodexConfigSettings({
  globalSettings,
}: {
  globalSettings: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const config = useCodexConfig();
  const advanced = globalSettings.advanced;
  const [fallbackDraft, setFallbackDraft] = useState("");

  useEffect(() => {
    setFallbackDraft(advanced.projectDocFallbackFilenames.join(", "));
  }, [advanced.projectDocFallbackFilenames]);

  return (
    <section className="settings-page config-settings">
      <section className="config-guided-section">
        <header>
          <h2>{t("settings.config.guided.title")}</h2>
          <p>{t("settings.config.guided.description")}</p>
        </header>

        <div className="settings-subsection-heading">
          <strong>{t("settings.config.context.title")}</strong>
          <small>{t("settings.config.context.description")}</small>
        </div>
        <div className="settings-card settings-fields">
          <GuidedSelect
            label={t("settings.config.compactLimit.title")}
            detail={t("settings.config.compactLimit.detail")}
            value={advanced.modelAutoCompactTokenLimit}
            values={compactLimits}
            disabled={globalSettings.loading}
            automatic
            onChange={(value) =>
              globalSettings.setAdvanced(
                "model_auto_compact_token_limit",
                value,
              )
            }
          />
          <GuidedSelect
            label={t("settings.config.toolOutputLimit.title")}
            detail={t("settings.config.toolOutputLimit.detail")}
            value={advanced.toolOutputTokenLimit}
            values={toolOutputLimits}
            disabled={globalSettings.loading}
            automatic
            onChange={(value) =>
              globalSettings.setAdvanced("tool_output_token_limit", value)
            }
          />
        </div>

        <div className="settings-subsection-heading">
          <strong>{t("settings.config.projectDocs.title")}</strong>
          <small>{t("settings.config.projectDocs.description")}</small>
        </div>
        <div className="settings-card settings-fields">
          <GuidedSelect
            label={t("settings.config.projectDocLimit.title")}
            detail={t("settings.config.projectDocLimit.detail")}
            value={advanced.projectDocMaxBytes}
            values={projectDocLimits}
            disabled={globalSettings.loading}
            formatValue={(value) => `${value / 1024} KiB`}
            onChange={(value) =>
              globalSettings.setAdvanced("project_doc_max_bytes", value)
            }
          />
          <form
            className="config-guided-text-row"
            onSubmit={(event) => {
              event.preventDefault();
              void globalSettings.setAdvanced(
                "project_doc_fallback_filenames",
                fallbackDraft
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              );
            }}
          >
            <span className="settings-field-description">
              <strong>{t("settings.config.fallbackFiles.title")}</strong>
              <small>{t("settings.config.fallbackFiles.detail")}</small>
            </span>
            <span className="config-guided-text-control">
              <input
                aria-label={t("settings.config.fallbackFiles.title")}
                value={fallbackDraft}
                disabled={globalSettings.loading}
                placeholder="CLAUDE.md, CONTRIBUTING.md"
                onChange={(event) => setFallbackDraft(event.target.value)}
              />
              <RoundIconButton
                aria-label={t("settings.config.fallbackFiles.save")}
                disabled={globalSettings.loading}
                icon={Save}
                type="submit"
                variant="secondary"
              />
            </span>
          </form>
        </div>

        <div className="settings-subsection-heading">
          <strong>{t("settings.config.runtime.title")}</strong>
          <small>{t("settings.config.runtime.description")}</small>
        </div>
        <div className="settings-card settings-fields">
          <label>
            <span className="settings-field-description">
              <strong>{t("settings.config.loginShell.title")}</strong>
              <small>{t("settings.config.loginShell.detail")}</small>
            </span>
            <input
              aria-label={t("settings.config.loginShell.title")}
              type="checkbox"
              checked={advanced.allowLoginShell}
              disabled={globalSettings.loading}
              onChange={(event) =>
                void globalSettings.setAdvanced(
                  "allow_login_shell",
                  event.target.checked,
                )
              }
            />
          </label>
          <CredentialStoreSelect
            label={t("settings.config.cliCredentials.title")}
            detail={t("settings.config.cliCredentials.detail")}
            value={advanced.cliAuthCredentialsStore}
            disabled={globalSettings.loading}
            onChange={(value) =>
              globalSettings.setAdvanced("cli_auth_credentials_store", value)
            }
          />
          <CredentialStoreSelect
            label={t("settings.config.mcpCredentials.title")}
            detail={t("settings.config.mcpCredentials.detail")}
            value={advanced.mcpOauthCredentialsStore}
            disabled={globalSettings.loading}
            onChange={(value) =>
              globalSettings.setAdvanced("mcp_oauth_credentials_store", value)
            }
          />
        </div>

        {globalSettings.error && (
          <div className="inventory-message error" role="alert">
            {t("settings.config.guided.error")} {globalSettings.error}
          </div>
        )}
      </section>

      <div className="settings-subsection-heading config-advanced-heading">
        <strong>{t("settings.config.advanced.title")}</strong>
        <small>{t("settings.config.advanced.description")}</small>
      </div>
      <ConfigDocumentEditor
        title={t("settings.config.file")}
        description={t("settings.config.description")}
        fileName={t("settings.config.file")}
        filePath={config.document?.filePath ?? "~/.codex/config.toml"}
        editorLabel={t("settings.config.editor")}
        draft={config.draft}
        dirty={config.dirty}
        error={config.error}
        errorTitle={t("settings.config.error")}
        loading={config.loading}
        native={config.native}
        onChange={config.setDraft}
        onReload={config.load}
        onSave={async () => {
          if (await config.save()) await globalSettings.refresh();
        }}
        restartNote={t("settings.config.restart")}
        saved={config.saved}
        savedMessage={t("settings.config.saved")}
        saving={config.saving}
      />
      <GlobalAgentsSettings />
    </section>
  );
}

function GuidedSelect({
  automatic = false,
  detail,
  disabled,
  formatValue = (value) => String(value),
  label,
  onChange,
  value,
  values,
}: {
  automatic?: boolean;
  detail: string;
  disabled: boolean;
  formatValue?: (value: number) => string;
  label: string;
  onChange: (value: number | null) => Promise<boolean>;
  value: number | null;
  values: number[];
}) {
  const { t } = useI18n();
  const options = value !== null && !values.includes(value)
    ? [value, ...values]
    : values;
  return (
    <label>
      <span className="settings-field-description">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value ?? ""}
        onChange={(event) =>
          void onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      >
        {automatic && (
          <option value="">{t("settings.config.value.automatic")}</option>
        )}
        {options.map((option) => (
          <option value={option} key={option}>
            {formatValue(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CredentialStoreSelect({
  detail,
  disabled,
  label,
  onChange,
  value,
}: {
  detail: string;
  disabled: boolean;
  label: string;
  onChange: (value: CredentialStore) => Promise<boolean>;
  value: CredentialStore;
}) {
  const { t } = useI18n();
  return (
    <label>
      <span className="settings-field-description">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) =>
          void onChange(event.target.value as CredentialStore)
        }
      >
        {credentialStores.map((store) => (
          <option value={store} key={store}>
            {t(`settings.config.credentials.${store}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
