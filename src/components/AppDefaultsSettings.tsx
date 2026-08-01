import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppToolApprovalMode } from "../lib/appServerTypes";
import type { AppsController } from "../lib/useApps";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { IconSubheader } from "./IconSubheader";

type BooleanChoice = "true" | "false";
type ApprovalChoice = "inherit" | AppToolApprovalMode;
type ReviewerChoice = "inherit" | "user" | "auto_review";

export function AppDefaultsSettings({ apps }: { apps: AppsController }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<BooleanChoice>("true");
  const [destructiveEnabled, setDestructiveEnabled] = useState<BooleanChoice>("true");
  const [openWorldEnabled, setOpenWorldEnabled] = useState<BooleanChoice>("true");
  const [approvalMode, setApprovalMode] = useState<ApprovalChoice>("inherit");
  const [reviewer, setReviewer] = useState<ReviewerChoice>("inherit");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    void apps.readConfiguration().then((data) => {
      if (!active || !data) return;
      setEnabled(data.config.enabled ? "true" : "false");
      setDestructiveEnabled(data.config.destructive_enabled === false ? "false" : "true");
      setOpenWorldEnabled(data.config.open_world_enabled === false ? "false" : "true");
      setApprovalMode(data.config.default_tools_approval_mode ?? "inherit");
      setReviewer(data.config.approvals_reviewer ?? "inherit");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [apps.readConfiguration]);

  const saving = apps.savingConfigurations.includes("_default");
  useEffect(() => {
    if (!dirty || loading || saving) return;
    const timeout = window.setTimeout(() => {
      setDirty(false);
      void apps.saveConfiguration({
        enabled: enabled === "true",
        approvalsReviewer: reviewer === "inherit" ? null : reviewer,
        destructiveEnabled: destructiveEnabled === "true",
        openWorldEnabled: openWorldEnabled === "true",
        defaultToolsApprovalMode: approvalMode === "inherit" ? null : approvalMode,
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [approvalMode, apps.saveConfiguration, destructiveEnabled, dirty, enabled, loading, openWorldEnabled, reviewer, saving]);

  const update = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  return <section className="app-defaults-section">
    <IconSubheader
      icon={<SlidersHorizontal />}
      subtitle={t("integrations.apps.defaultsDetail")}
      title={t("integrations.apps.defaultsTitle")}
    />
    {loading ? <div className="inventory-loading">{t("integrations.apps.configurationLoading")}</div> : <div
      className="app-defaults-form"
    >
      <CardStack>
        <ChoiceCard disabled={saving} label={t("integrations.apps.defaultEnabled")} value={enabled} onChange={update(setEnabled)} options={booleanOptions(t)} />
        <ChoiceCard disabled={saving} label={t("integrations.apps.destructiveEnabled")} value={destructiveEnabled} onChange={update(setDestructiveEnabled)} options={booleanOptions(t)} />
        <ChoiceCard disabled={saving} label={t("integrations.apps.openWorldEnabled")} value={openWorldEnabled} onChange={update(setOpenWorldEnabled)} options={booleanOptions(t)} />
        <ChoiceCard disabled={saving} label={t("integrations.apps.approvalMode")} value={approvalMode} onChange={update(setApprovalMode)} options={approvalOptions(t)} />
        <ChoiceCard disabled={saving} label={t("integrations.apps.reviewer")} value={reviewer} onChange={update(setReviewer)} options={reviewerOptions(t)} />
      </CardStack>
      <div className="app-defaults-actions">
        <small>{t("integrations.apps.defaultsPolicyDetail")}</small>
      </div>
    </div>}
  </section>;
}

function ChoiceCard<T extends string>({ disabled, label, onChange, options, value }: {
  disabled: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return <IconCard
    title={label}
    trailing={<select
      aria-label={label}
      className="app-default-control"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      value={value}
    >{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
  />;
}

function booleanOptions(t: ReturnType<typeof useI18n>["t"]): Array<{ label: string; value: BooleanChoice }> {
  return [
    { label: t("integrations.apps.allow"), value: "true" },
    { label: t("integrations.apps.block"), value: "false" },
  ];
}

function approvalOptions(t: ReturnType<typeof useI18n>["t"]): Array<{ label: string; value: ApprovalChoice }> {
  return [
    { label: t("integrations.apps.codexDefault"), value: "inherit" },
    { label: t("integrations.mcp.addApproval.auto"), value: "auto" },
    { label: t("integrations.mcp.addApproval.prompt"), value: "prompt" },
    { label: t("integrations.mcp.addApproval.writes"), value: "writes" },
    { label: t("integrations.mcp.addApproval.approve"), value: "approve" },
  ];
}

function reviewerOptions(t: ReturnType<typeof useI18n>["t"]): Array<{ label: string; value: ReviewerChoice }> {
  return [
    { label: t("integrations.apps.codexDefault"), value: "inherit" },
    { label: t("integrations.apps.reviewer.user"), value: "user" },
    { label: t("integrations.apps.reviewer.auto"), value: "auto_review" },
  ];
}
