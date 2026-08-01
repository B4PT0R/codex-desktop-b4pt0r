import { BookOpenText, Plus, Sparkles, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { SkillDraft } from "../lib/useIntegrations";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon, RoundIconButton } from "./RoundIcon";

type Tab = "essential" | "instructions";

export function SkillCreateDialog({ creating, onCancel, onCreate }: {
  creating: boolean;
  onCancel: () => void;
  onCreate: (draft: SkillDraft) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("essential");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("# Workflow\n\n");
  const [scope, setScope] = useState<"user" | "repo">("user");
  const slug = useMemo(() => normalizeSkillName(name), [name]);
  const valid = Boolean(slug && description.trim() && instructions.replace(/^# Workflow\s*/i, "").trim());
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: creating ? undefined : onCancel,
  });
  const submit = async () => {
    if (!valid) return;
    if (await onCreate({ name: slug, description: description.trim(), instructions: instructions.trim(), scope })) onCancel();
  };
  return <div className="overlay">
    <form ref={dialogRef} className="modal settings-form-dialog skill-create-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-create-title" onKeyDown={onDialogKeyDown} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="settings-form-dialog-heading">
        <RoundIcon icon={Sparkles} size="large" variant="primary" />
        <h2 id="skill-create-title">{t("integrations.skills.createTitle")}</h2>
      </div>
      <div className="settings-form-dialog-body">
        <p>{t("integrations.skills.createDetail")}</p>
        <div className="settings-dialog-tabs" role="tablist" aria-label={t("integrations.skills.createLevel")}>
          {([{ value: "essential", icon: Zap }, { value: "instructions", icon: BookOpenText }] as const).map(({ value, icon: Icon }) => <button aria-controls={`skill-create-${value}`} aria-selected={tab === value} className={tab === value ? "active" : undefined} disabled={creating} id={`skill-create-tab-${value}`} key={value} onClick={() => setTab(value)} role="tab" type="button"><Icon aria-hidden="true" /><span>{t(`integrations.skills.createLevel.${value}`)}</span></button>)}
        </div>
        <div aria-labelledby={`skill-create-tab-${tab}`} className="settings-form-fields" id={`skill-create-${tab}`} role="tabpanel">
          {tab === "essential" ? <>
            <Field label={t("integrations.skills.createName")} detail={t("integrations.skills.createNameDetail")}>
              <input data-dialog-initial-focus disabled={creating} maxLength={64} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("integrations.skills.createNamePlaceholder")} />
            </Field>
            {name && <div className="skill-path-preview"><span>{t("integrations.skills.createFolder")}</span><code>{slug || "…"}</code></div>}
            <Field label={t("integrations.skills.createDescription")} detail={t("integrations.skills.createDescriptionDetail")}>
              <textarea disabled={creating} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("integrations.skills.createDescriptionPlaceholder")} />
            </Field>
            <Field label={t("integrations.skills.createScope")} detail={t("integrations.skills.createScopeDetail")}>
              <select disabled={creating} value={scope} onChange={(event) => setScope(event.target.value as "user" | "repo")}><option value="user">{t("integrations.skills.scope.user")}</option><option value="repo">{t("integrations.skills.scope.repo")}</option></select>
            </Field>
          </> : <Field label={t("integrations.skills.createInstructions")} detail={t("integrations.skills.createInstructionsDetail")}>
            <textarea className="skill-instructions-editor" disabled={creating} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder={t("integrations.skills.createInstructionsPlaceholder")} />
          </Field>}
        </div>
      </div>
      <div className="modal-actions">
        <RoundIconButton icon={Plus} label={t("integrations.skills.createAction")} disabled={!valid || creating} type="submit" variant="primary" />
        <RoundIconButton label={t("common.cancel")} disabled={creating} onClick={onCancel} type="button" variant="secondary" />
      </div>
    </form>
  </div>;
}

function Field({ children, detail, label }: { children: ReactNode; detail: string; label: string }) {
  return <label><span>{label}</span>{children}<small>{detail}</small></label>;
}

export function normalizeSkillName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/g, "");
}
