import { Brain, Check, ChevronDown, ListTodo, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { CollaborationMode, Model } from "../types";
import { RoundIconButton } from "./RoundIcon";

type ModelQuickPickerProps = {
  effort: string;
  collaborationMode: CollaborationMode;
  model: string;
  models: Model[];
  onChangeEffort: (effort: string) => void;
  onChangeCollaborationMode: (mode: CollaborationMode) => Promise<boolean>;
  onChangeModel: (model: string) => void;
};

export function ModelQuickPicker({
  effort,
  collaborationMode,
  model,
  models,
  onChangeEffort,
  onChangeCollaborationMode,
  onChangeModel,
}: ModelQuickPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = models.find((candidate) => candidate.id === model);
  const efforts = selected?.supportedReasoningEfforts?.length
    ? selected.supportedReasoningEfforts
    : [{ reasoningEffort: effort, description: "" }];

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
        className="model-select"
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
                <RoundIconButton
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
