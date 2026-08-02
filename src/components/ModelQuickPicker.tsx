import {
  Brain,
  Check,
  ChevronDown,
  Gauge,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { CollaborationMode, Model } from "../types";
import { IconButton } from "./IconButton";

type ModelQuickPickerProps = {
  effort: string;
  collaborationMode: CollaborationMode;
  model: string;
  models: Model[];
  serviceTier: string | null;
  onChangeEffort: (effort: string) => void;
  onChangeCollaborationMode: (mode: CollaborationMode) => Promise<boolean>;
  onChangeModel: (model: string) => void;
  onChangeServiceTier: (tier: string | null) => Promise<boolean>;
};

export function ModelQuickPicker({
  effort,
  collaborationMode,
  model,
  models,
  serviceTier,
  onChangeEffort,
  onChangeCollaborationMode,
  onChangeModel,
  onChangeServiceTier,
}: ModelQuickPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = models.find((candidate) => candidate.id === model);
  const efforts = selected?.supportedReasoningEfforts?.length
    ? selected.supportedReasoningEfforts
    : [{ reasoningEffort: effort, description: "" }];
  const serviceTiers = selected?.serviceTiers ?? [];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function closePicker() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      className="model-quick-picker-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closePicker();
        }
      }}
      ref={shell}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="footer-expander-trigger model-select"
        onClick={() => setOpen((current) => !current)}
        ref={trigger}
      >
        {selected?.label ?? model}
        <ChevronDown />
      </button>
      {open && (
        <div
          aria-label={t("modelPicker.title")}
          aria-modal="false"
          className="model-quick-picker"
          role="dialog"
        >
          <div className="model-quick-picker-heading">
            <Sparkles />
            <div>
              <strong>{t("modelPicker.model")}</strong>
              <small>{t("modelPicker.modelDetail")}</small>
            </div>
          </div>
          <div className="model-quick-picker-list" role="listbox">
            {models.map((candidate) => (
              <button
                aria-selected={candidate.id === model}
                className={candidate.id === model ? "selected" : ""}
                key={candidate.id}
                onClick={() => {
                  onChangeModel(candidate.id);
                  const nextEffort =
                    candidate.supportedReasoningEfforts?.find(
                      (option) => option.reasoningEffort === effort,
                    )?.reasoningEffort ??
                    candidate.defaultReasoningEffort ??
                    candidate.supportedReasoningEfforts?.[0]?.reasoningEffort;
                  if (nextEffort && nextEffort !== effort)
                    onChangeEffort(nextEffort);
                  if (
                    serviceTier &&
                    !candidate.serviceTiers?.some(
                      (tier) => tier.id === serviceTier,
                    )
                  )
                    void onChangeServiceTier(null);
                }}
                role="option"
                type="button"
              >
                <span>
                  <strong>{candidate.label}</strong>
                  <small>{candidate.id}</small>
                </span>
                {candidate.id === model && <Check />}
              </button>
            ))}
          </div>
          <div className="model-quick-picker-effort">
            <div className="model-quick-picker-heading">
              <Brain />
              <div>
                <strong>{t("modelPicker.effort")}</strong>
                <small>{t("modelPicker.effortDetail")}</small>
              </div>
            </div>
            <div aria-label={t("modelPicker.effort")} role="radiogroup">
              {efforts.map((option) => (
                <IconButton
                  aria-checked={option.reasoningEffort === effort}
                  className={
                    option.reasoningEffort === effort ? "selected" : ""
                  }
                  key={option.reasoningEffort}
                  label={reasoningEffortLabel(option.reasoningEffort, t)}
                  onClick={() => {
                    onChangeEffort(option.reasoningEffort);
                    closePicker();
                  }}
                  role="radio"
                  size="medium"
                  title={option.description || undefined}
                  variant={
                    option.reasoningEffort === effort ? "primary" : "secondary"
                  }
                />
              ))}
            </div>
          </div>
          {serviceTiers.length > 0 && (
            <div className="model-quick-picker-tier">
              <div className="model-quick-picker-heading">
                <Gauge />
                <div>
                  <strong>{t("modelPicker.serviceTier")}</strong>
                  <small>{t("modelPicker.serviceTierDetail")}</small>
                </div>
              </div>
              <div
                aria-label={t("modelPicker.serviceTier")}
                role="radiogroup"
              >
                <IconButton
                  aria-checked={serviceTier === null}
                  className={serviceTier === null ? "selected" : ""}
                  label={t("settings.global.automatic")}
                  onClick={() => {
                    void onChangeServiceTier(null);
                    closePicker();
                  }}
                  role="radio"
                  size="medium"
                  variant={serviceTier === null ? "primary" : "secondary"}
                />
                {serviceTiers.map((tier) => (
                  <IconButton
                    aria-checked={tier.id === serviceTier}
                    className={tier.id === serviceTier ? "selected" : ""}
                    key={tier.id}
                    label={tier.name}
                    onClick={() => {
                      void onChangeServiceTier(tier.id);
                      closePicker();
                    }}
                    role="radio"
                    size="medium"
                    title={tier.description}
                    variant={
                      tier.id === serviceTier ? "primary" : "secondary"
                    }
                  />
                ))}
              </div>
            </div>
          )}
          <div className="model-quick-picker-mode">
            <div className="model-quick-picker-heading">
              <ListTodo />
              <div>
                <strong>{t("modelPicker.planMode")}</strong>
                <small>{t("modelPicker.planModeDetail")}</small>
              </div>
            </div>
            <label>
              <input
                aria-label={t("modelPicker.planMode")}
                checked={collaborationMode === "plan"}
                onChange={() =>
                  void onChangeCollaborationMode(
                    collaborationMode === "plan" ? "default" : "plan",
                  )
                }
                type="checkbox"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
