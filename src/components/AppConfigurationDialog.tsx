import { Settings2, SlidersHorizontal, Wrench } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppToolApprovalMode } from "../lib/appServerTypes";
import type { AppConfigurationEditorData } from "../lib/useApps";
import type { AppConfigurationDraft } from "../lib/protocol";
import { useDialogFocus } from "../lib/useDialogFocus";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";
import { IconToggle } from "./IconToggle";

type Tab = "essential" | "tools";
type BooleanChoice = "inherit" | "true" | "false";
type ApprovalChoice = "inherit" | AppToolApprovalMode;
type ReviewerChoice = "inherit" | "user" | "auto_review";

export function AppConfigurationLoadingDialog({ name, onCancel }: { name?: string; onCancel: () => void }) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({ onEscape: onCancel });
  return <div className="overlay"><div ref={dialogRef} className="modal settings-form-dialog app-configuration-dialog" role="dialog" aria-modal="true" aria-labelledby="app-configuration-loading-title" onKeyDown={onDialogKeyDown} tabIndex={-1}>
    <div className="settings-form-dialog-heading"><RoundIcon icon={Settings2} size="large" variant="primary" /><h2 id="app-configuration-loading-title">{name ? t("integrations.apps.configureTitle", { name }) : t("integrations.apps.defaultsTitle")}</h2></div>
    <div className="inventory-loading">{t("integrations.apps.configurationLoading")}</div>
    <div className="modal-actions"><IconButton label={t("common.cancel")} onClick={onCancel} variant="secondary" /></div>
  </div></div>;
}

export function AppConfigurationDialog({
  data,
  saving,
  onCancel,
  onSave,
}: {
  data: AppConfigurationEditorData;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: AppConfigurationDraft) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const isDefaults = !data.app;
  const [tab, setTab] = useState<Tab>("essential");
  const [enabled, setEnabled] = useState(data.config.enabled);
  const [defaultToolsEnabled, setDefaultToolsEnabled] = useState<BooleanChoice>(
    booleanChoice(data.config.default_tools_enabled),
  );
  const [destructiveEnabled, setDestructiveEnabled] = useState<BooleanChoice>(
    booleanChoice(data.config.destructive_enabled, isDefaults),
  );
  const [openWorldEnabled, setOpenWorldEnabled] = useState<BooleanChoice>(
    booleanChoice(data.config.open_world_enabled, isDefaults),
  );
  const [approvalMode, setApprovalMode] = useState<ApprovalChoice>(
    data.config.default_tools_approval_mode ?? "inherit",
  );
  const [reviewer, setReviewer] = useState<ReviewerChoice>(
    data.config.approvals_reviewer ?? "inherit",
  );
  const initialTools = Object.fromEntries(data.tools.map((tool) => {
    const config = data.config.tools?.[tool.name];
    return [tool.name, {
      enabled: booleanChoice(config?.enabled),
      approvalMode: (config?.approval_mode ?? "inherit") as ApprovalChoice,
    }];
  }));
  const [tools, setTools] = useState(initialTools);
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: saving ? undefined : onCancel,
  });

  const submit = async () => {
    const changedTools = Object.fromEntries(Object.entries(tools).flatMap(([name, tool]) => {
      const initial = initialTools[name];
      if (initial?.enabled === tool.enabled && initial?.approvalMode === tool.approvalMode) return [];
      return [[name, {
        enabled: nullableBoolean(tool.enabled),
        approvalMode: tool.approvalMode === "inherit" ? null : tool.approvalMode,
      }]];
    }));
    const saved = await onSave({
      ...(data.app ? { appId: data.app.id } : {}),
      enabled,
      approvalsReviewer: reviewer === "inherit" ? null : reviewer,
      destructiveEnabled: nullableBoolean(destructiveEnabled),
      openWorldEnabled: nullableBoolean(openWorldEnabled),
      defaultToolsApprovalMode: approvalMode === "inherit" ? null : approvalMode,
      ...(data.app ? { defaultToolsEnabled: nullableBoolean(defaultToolsEnabled) } : {}),
      ...(Object.keys(changedTools).length ? { tools: changedTools } : {}),
    });
    if (saved) onCancel();
  };

  return (
    <div className="overlay">
      <form
        ref={dialogRef}
        className="modal settings-form-dialog app-configuration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-configuration-title"
        onKeyDown={onDialogKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="settings-form-dialog-heading">
          <RoundIcon icon={Settings2} size="large" variant="primary" />
          <div>
            <h2 id="app-configuration-title">
              {isDefaults
                ? t("integrations.apps.defaultsTitle")
                : t("integrations.apps.configureTitle", { name: data.app?.name ?? "" })}
            </h2>
            <small>{isDefaults
              ? t("integrations.apps.defaultsDetail")
              : t("integrations.apps.configureDetail")}</small>
          </div>
        </div>
        <div className="settings-form-dialog-body">
          {!isDefaults && (
            <div className="settings-dialog-tabs" role="tablist" aria-label={t("integrations.apps.configurationLevel")}>
              <DialogTab active={tab === "essential"} icon={SlidersHorizontal} label={t("integrations.apps.essential")} onClick={() => setTab("essential")} value="essential" />
              <DialogTab active={tab === "tools"} icon={Wrench} label={t("integrations.apps.tools")} onClick={() => setTab("tools")} value="tools" />
            </div>
          )}
          <div className="settings-form-fields" role={isDefaults ? undefined : "tabpanel"} aria-label={isDefaults ? undefined : t(`integrations.apps.${tab}`)}>
            {tab === "essential" || isDefaults ? (
              <EssentialConfiguration
                approvalMode={approvalMode}
                defaultToolsEnabled={defaultToolsEnabled}
                destructiveEnabled={destructiveEnabled}
                enabled={enabled}
                isDefaults={isDefaults}
                openWorldEnabled={openWorldEnabled}
                reviewer={reviewer}
                saving={saving}
                setApprovalMode={setApprovalMode}
                setDefaultToolsEnabled={setDefaultToolsEnabled}
                setDestructiveEnabled={setDestructiveEnabled}
                setEnabled={setEnabled}
                setOpenWorldEnabled={setOpenWorldEnabled}
                setReviewer={setReviewer}
              />
            ) : (
              <ToolsConfiguration
                saving={saving}
                summaries={data.tools}
                tools={tools}
                setTools={setTools}
              />
            )}
          </div>
        </div>
        <div className="modal-actions">
          <IconButton data-dialog-initial-focus disabled={saving} label={t("common.cancel")} onClick={onCancel} variant="secondary" />
          <IconButton disabled={saving} label={saving ? t("common.saving") : t("common.save")} type="submit" variant="primary" />
        </div>
      </form>
    </div>
  );
}

function DialogTab({ active, icon: Icon, label, onClick, value }: {
  active: boolean;
  icon: typeof Wrench;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return <button aria-selected={active} className={active ? "active" : undefined} id={`app-config-tab-${value}`} onClick={onClick} role="tab" type="button"><Icon aria-hidden="true" /><span>{label}</span></button>;
}

function EssentialConfiguration(props: {
  approvalMode: ApprovalChoice;
  defaultToolsEnabled: BooleanChoice;
  destructiveEnabled: BooleanChoice;
  enabled: boolean;
  isDefaults: boolean;
  openWorldEnabled: BooleanChoice;
  reviewer: ReviewerChoice;
  saving: boolean;
  setApprovalMode: (value: ApprovalChoice) => void;
  setDefaultToolsEnabled: (value: BooleanChoice) => void;
  setDestructiveEnabled: (value: BooleanChoice) => void;
  setEnabled: (value: boolean) => void;
  setOpenWorldEnabled: (value: BooleanChoice) => void;
  setReviewer: (value: ReviewerChoice) => void;
}) {
  const { t } = useI18n();
  const p = props;
  return <>
    <div className="app-config-enabled">
      <span>{p.isDefaults ? t("integrations.apps.defaultEnabled") : t("integrations.apps.appEnabled")}</span>
      <IconToggle
        checked={p.enabled}
        disabled={p.saving}
        label={p.isDefaults ? t("integrations.apps.defaultEnabled") : t("integrations.apps.appEnabled")}
        onCheckedChange={p.setEnabled}
      />
      <small>{p.isDefaults ? t("integrations.apps.defaultEnabledDetail") : t("integrations.apps.appEnabledDetail")}</small>
    </div>
    <div className="settings-form-field-grid">
      {!p.isDefaults && <ChoiceField disabled={p.saving} label={t("integrations.apps.defaultToolsEnabled")} value={p.defaultToolsEnabled} onChange={p.setDefaultToolsEnabled} options={booleanOptions(t, true)} />}
      <ChoiceField disabled={p.saving} label={t("integrations.apps.destructiveEnabled")} value={p.destructiveEnabled} onChange={p.setDestructiveEnabled} options={booleanOptions(t, !p.isDefaults)} />
      <ChoiceField disabled={p.saving} label={t("integrations.apps.openWorldEnabled")} value={p.openWorldEnabled} onChange={p.setOpenWorldEnabled} options={booleanOptions(t, !p.isDefaults)} />
      <ChoiceField disabled={p.saving} label={t("integrations.apps.approvalMode")} value={p.approvalMode} onChange={p.setApprovalMode} options={approvalOptions(t, p.isDefaults)} />
      <ChoiceField disabled={p.saving} label={t("integrations.apps.reviewer")} value={p.reviewer} onChange={p.setReviewer} options={reviewerOptions(t, p.isDefaults)} />
    </div>
    <small className="settings-form-note">{t(p.isDefaults ? "integrations.apps.defaultsPolicyDetail" : "integrations.apps.policyDetail")}</small>
  </>;
}

function ToolsConfiguration({ saving, summaries, tools, setTools }: {
  saving: boolean;
  summaries: AppConfigurationEditorData["tools"];
  tools: Record<string, { enabled: BooleanChoice; approvalMode: ApprovalChoice }>;
  setTools: (value: Record<string, { enabled: BooleanChoice; approvalMode: ApprovalChoice }>) => void;
}) {
  const { t } = useI18n();
  if (summaries.length === 0) return <div className="inventory-empty">{t("integrations.apps.toolsEmpty")}</div>;
  return <CardStack className="app-tool-list">
    {summaries.map((tool) => {
      const value = tools[tool.name] ?? { enabled: "inherit", approvalMode: "inherit" };
      return <IconCard
        icon={<Wrench />}
        key={tool.name}
        title={tool.title ?? tool.name}
        subtitle={<>{tool.description}{tool.isReadOnly ? ` · ${t("integrations.apps.readOnly")}` : ""}</>}
        trailing={<div className="app-tool-controls">
          <label><span>{t("integrations.apps.toolState")}</span><select aria-label={t("integrations.apps.toolStateFor", { name: tool.title ?? tool.name })} disabled={saving} value={value.enabled} onChange={(event) => setTools({ ...tools, [tool.name]: { ...value, enabled: event.target.value as BooleanChoice } })}>{booleanOptions(t, true).map(optionElement)}</select></label>
          <label><span>{t("integrations.apps.toolApproval")}</span><select aria-label={t("integrations.apps.toolApprovalFor", { name: tool.title ?? tool.name })} disabled={saving} value={value.approvalMode} onChange={(event) => setTools({ ...tools, [tool.name]: { ...value, approvalMode: event.target.value as ApprovalChoice } })}>{approvalOptions(t).map(optionElement)}</select></label>
        </div>}
      >
        {tool.disabledReason && <small className="app-tool-disabled-reason">{tool.disabledReason}</small>}
      </IconCard>;
    })}
  </CardStack>;
}

function ChoiceField<T extends string>({ disabled, label, onChange, options, value }: { disabled?: boolean; label: string; onChange: (value: T) => void; options: Array<{ label: string; value: T }>; value: T }) {
  return <label><span>{label}</span><select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(optionElement)}</select></label>;
}

function optionElement(option: { label: string; value: string }) {
  return <option key={option.value} value={option.value}>{option.label}</option>;
}

function booleanOptions(t: ReturnType<typeof useI18n>["t"], inherit: boolean): Array<{ label: string; value: BooleanChoice }> {
  return [
    ...(inherit ? [{ label: t("integrations.apps.inherit"), value: "inherit" as const }] : []),
    { label: t("integrations.apps.allow"), value: "true" },
    { label: t("integrations.apps.block"), value: "false" },
  ];
}

function approvalOptions(t: ReturnType<typeof useI18n>["t"], codexDefault = false): Array<{ label: string; value: ApprovalChoice }> {
  return [
    { label: t(codexDefault ? "integrations.apps.codexDefault" : "integrations.apps.inherit"), value: "inherit" },
    { label: t("integrations.mcp.addApproval.auto"), value: "auto" },
    { label: t("integrations.mcp.addApproval.prompt"), value: "prompt" },
    { label: t("integrations.mcp.addApproval.writes"), value: "writes" },
    { label: t("integrations.mcp.addApproval.approve"), value: "approve" },
  ];
}

function reviewerOptions(t: ReturnType<typeof useI18n>["t"], codexDefault = false): Array<{ label: string; value: ReviewerChoice }> {
  return [
    { label: t(codexDefault ? "integrations.apps.codexDefault" : "integrations.apps.inherit"), value: "inherit" },
    { label: t("integrations.apps.reviewer.user"), value: "user" },
    { label: t("integrations.apps.reviewer.auto"), value: "auto_review" },
  ];
}

function booleanChoice(value: boolean | null | undefined, required = false): BooleanChoice {
  if (value === true) return "true";
  if (value === false) return "false";
  return required ? "true" : "inherit";
}

function nullableBoolean(value: BooleanChoice) {
  return value === "inherit" ? null : value === "true";
}
