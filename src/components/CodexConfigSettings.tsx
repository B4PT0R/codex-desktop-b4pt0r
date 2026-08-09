import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { IconSubheader } from "./IconSubheader";
import { useCodexConfig } from "../lib/useCodexConfig";
import type {
  CodexGlobalSettingsController,
  CredentialStore,
} from "../lib/useCodexGlobalSettings";
import { ConfigDocumentEditor } from "./ConfigDocumentEditor";
import { DeveloperInstructionsSettings } from "./DeveloperInstructionsSettings";
import { IconButton } from "./IconButton";
import { IconToggle } from "./IconToggle";
import { Alert } from "./Alert";
import { CardStack } from "./CardStack";
import type { AdultModeSettingsController } from "../lib/useAdultModeSettings";
import { AdultModeActivationDialog } from "./AdultModeActivationDialog";

const compactLimits = [32_000, 64_000, 128_000];
const toolOutputLimits = [4_000, 8_000, 12_000, 24_000];
const projectDocLimits = [16_384, 32_768, 65_536, 131_072];
const credentialStores: CredentialStore[] = ["auto", "file", "keyring"];

export function CodexConfigSettings({
  adultMode,
  globalSettings,
}: {
  adultMode: AdultModeSettingsController;
  globalSettings: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const config = useCodexConfig();
  const advanced = globalSettings.advanced;
  const [fallbackDraft, setFallbackDraft] = useState("");
  const [adultModeDialogOpen, setAdultModeDialogOpen] = useState(false);

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

        <IconSubheader
          title={t("settings.config.context.title")}
          subtitle={t("settings.config.context.description")}
        />
        <CardStack className="settings-fields">
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
        </CardStack>

        <IconSubheader
          title={t("settings.config.projectDocs.title")}
          subtitle={t("settings.config.projectDocs.description")}
        />
        <CardStack className="settings-fields">
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
                placeholder={t("settings.config.fallbackFiles.placeholder")}
                onChange={(event) => setFallbackDraft(event.target.value)}
              />
              <IconButton
                aria-label={t("settings.config.fallbackFiles.save")}
                disabled={globalSettings.loading}
                icon={Save}
                type="submit"
                variant="secondary"
              />
            </span>
          </form>
        </CardStack>

        <IconSubheader
          title={t("settings.config.runtime.title")}
          subtitle={t("settings.config.runtime.description")}
        />
        <CardStack className="settings-fields">
          <div className="settings-toggle-row">
            <span className="settings-field-description">
              <strong>{t("settings.config.loginShell.title")}</strong>
              <small>{t("settings.config.loginShell.detail")}</small>
            </span>
            <IconToggle
              checked={advanced.allowLoginShell}
              disabled={globalSettings.loading}
              label={t("settings.config.loginShell.title")}
              onCheckedChange={(checked) =>
                void globalSettings.setAdvanced(
                  "allow_login_shell",
                  checked,
                )
              }
            />
          </div>
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
        </CardStack>

        <IconSubheader
          title={t("settings.config.experimental.title")}
          subtitle={t("settings.config.experimental.description")}
        />
        <CardStack className="settings-fields">
          <div className="settings-toggle-row">
            <span className="settings-field-description">
              <strong>{t("settings.config.adultMode.title")}</strong>
              <small>{t("settings.config.adultMode.detail")}</small>
            </span>
            <IconToggle
              checked={adultMode.enabled}
              disabled={adultMode.loading || adultMode.saving}
              label={t("settings.config.adultMode.title")}
              onCheckedChange={(checked) => checked ? setAdultModeDialogOpen(true) : void adultMode.setEnabled(false)}
            />
          </div>
          <div className="settings-toggle-row">
            <span className="settings-field-description">
              <strong>
                {t("settings.config.suppressUnstableWarning.title")}
              </strong>
              <small>
                {t("settings.config.suppressUnstableWarning.detail")}
              </small>
            </span>
            <IconToggle
              checked={advanced.suppressUnstableFeaturesWarning}
              disabled={globalSettings.loading}
              label={t("settings.config.suppressUnstableWarning.title")}
              onCheckedChange={(checked) =>
                void globalSettings.setAdvanced(
                  "suppress_unstable_features_warning",
                  checked,
                )
              }
            />
          </div>
        </CardStack>

        {adultMode.error && <Alert tone="error">{t("settings.config.adultMode.error")} {adultMode.error}</Alert>}
        {adultModeDialogOpen && <AdultModeActivationDialog existingCredential={adultMode.hasCredential} onCancel={() => setAdultModeDialogOpen(false)} onSubmit={async (password) => { const success = await adultMode.activate(password); if (success) setAdultModeDialogOpen(false); return success; }} />}

        {globalSettings.error && (
          <Alert tone="error">
            {t("settings.config.guided.error")} {globalSettings.error}
          </Alert>
        )}
      </section>

      <IconSubheader
        className="config-advanced-heading"
        title={t("settings.config.advanced.title")}
        subtitle={t("settings.config.advanced.description")}
      />
      <div className="config-document-list">
        <DeveloperInstructionsSettings controller={globalSettings} />
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
      </div>
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
