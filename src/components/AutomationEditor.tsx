import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type {
  Automation,
  AutomationDraft,
  AutomationTarget,
} from "../lib/automations";
import { RoundIconButton } from "./RoundIcon";

type Frequency = "once" | "interval" | "daily" | "weekdays" | "weekly";
type Target =
  | "thread"
  | "defaultThread"
  | "newThread"
  | "ephemeralThread";

export function AutomationEditor({
  automation,
  currentThreadId,
  currentWorkspace,
  onCancel,
  onSave,
}: {
  automation?: Automation;
  currentThreadId?: string;
  currentWorkspace?: string;
  onCancel: () => void;
  onSave: (draft: AutomationDraft) => Promise<void>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState(() =>
    editorState(automation, currentWorkspace),
  );
  const [saving, setSaving] = useState(false);
  const onceAt = new Date(state.onceAt).getTime();
  const canSave =
    state.name.trim() &&
    state.prompt.trim() &&
    (state.frequency !== "once" ||
      (Number.isFinite(onceAt) && onceAt > Date.now()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...(automation ? { id: automation.id } : {}),
        name: state.name,
        prompt: state.prompt,
        cwd: state.cwd,
        enabled: state.enabled,
        unattendedAccess: state.unattendedAccess,
        schedule:
          state.frequency === "once"
            ? { type: "once", at: onceAt }
            : state.frequency === "interval"
              ? {
                  type: "interval",
                  intervalMinutes: Math.max(5, Number(state.intervalMinutes)),
                }
              : {
                  type: "weekly",
                  time: state.time,
                  days:
                    state.frequency === "daily"
                      ? [0, 1, 2, 3, 4, 5, 6]
                      : state.frequency === "weekdays"
                        ? [1, 2, 3, 4, 5]
                        : [Number(state.weekday)],
                },
        target: targetFromEditor(
          state.target,
          automation,
          currentThreadId,
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-card automation-editor" onSubmit={submit}>
      <label>
        <span>{t("automations.name")}</span>
        <input
          autoFocus
          value={state.name}
          onChange={(event) => setState({ ...state, name: event.target.value })}
        />
      </label>
      <label>
        <span>{t("automations.prompt")}</span>
        <textarea
          rows={4}
          value={state.prompt}
          onChange={(event) =>
            setState({ ...state, prompt: event.target.value })
          }
        />
      </label>
      <label>
        <span>{t("automations.workspace")}</span>
        <input
          value={state.cwd}
          placeholder={currentWorkspace}
          onChange={(event) => setState({ ...state, cwd: event.target.value })}
        />
      </label>
      <div className="automation-editor-grid">
        <label>
          <span>{t("automations.frequency")}</span>
          <select
            value={state.frequency}
            onChange={(event) =>
              setState({
                ...state,
                frequency: event.target.value as Frequency,
              })
            }
          >
            <option value="once">{t("automations.once")}</option>
            <option value="interval">{t("automations.interval")}</option>
            <option value="daily">{t("automations.daily")}</option>
            <option value="weekdays">{t("automations.weekdays")}</option>
            <option value="weekly">{t("automations.weekly")}</option>
          </select>
        </label>
        {state.frequency === "once" ? (
          <label>
            <span>{t("automations.date")}</span>
            <input
              min={localDateTimeValue(Date.now())}
              type="datetime-local"
              value={state.onceAt}
              onChange={(event) =>
                setState({ ...state, onceAt: event.target.value })
              }
            />
          </label>
        ) : state.frequency === "interval" ? (
          <label>
            <span>{t("automations.intervalMinutes")}</span>
            <input
              min={5}
              max={10080}
              type="number"
              value={state.intervalMinutes}
              onChange={(event) =>
                setState({ ...state, intervalMinutes: event.target.value })
              }
            />
          </label>
        ) : (
          <label>
            <span>{t("automations.time")}</span>
            <input
              type="time"
              value={state.time}
              onChange={(event) =>
                setState({ ...state, time: event.target.value })
              }
            />
          </label>
        )}
        {state.frequency === "weekly" && (
          <label>
            <span>{t("automations.weekday")}</span>
            <select
              value={state.weekday}
              onChange={(event) =>
                setState({ ...state, weekday: event.target.value })
              }
            >
              {(
                [
                  [1, "automations.day.1"],
                  [2, "automations.day.2"],
                  [3, "automations.day.3"],
                  [4, "automations.day.4"],
                  [5, "automations.day.5"],
                  [6, "automations.day.6"],
                  [0, "automations.day.0"],
                ] as const
              ).map(([day, key]) => (
                <option key={day} value={day}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>{t("automations.target")}</span>
          <select
            value={state.target}
            onChange={(event) =>
              setState({
                ...state,
                target: event.target.value as Target,
              })
            }
          >
            <option
              value="thread"
              disabled={
                !currentThreadId && automation?.target.type !== "thread"
              }
            >
              {t("automations.existingThread")}
            </option>
            <option value="defaultThread">
              {t("automations.defaultThread")}
            </option>
            <option value="newThread">{t("automations.newThread")}</option>
            <option value="ephemeralThread">
              {t("automations.ephemeralThread")}
            </option>
          </select>
        </label>
      </div>
      <label className="automation-unattended">
        <input
          type="checkbox"
          checked={state.unattendedAccess}
          onChange={(event) =>
            setState({ ...state, unattendedAccess: event.target.checked })
          }
        />
        <span>
          <strong>{t("automations.unattended")}</strong>
          <small>{t("automations.unattendedDetail")}</small>
        </span>
      </label>
      <footer>
        <RoundIconButton
          label={t("common.cancel")}
          onClick={onCancel}
          size="small"
          type="button"
          variant="secondary"
        />
        <RoundIconButton
          disabled={!canSave || saving}
          label={saving ? t("automations.saving") : t("automations.save")}
          size="small"
          type="submit"
          variant="primary"
        />
      </footer>
    </form>
  );
}

function editorState(
  automation?: Automation,
  currentWorkspace?: string,
) {
  const frequency: Frequency =
    automation?.schedule.type === "once"
      ? "once"
      : automation?.schedule.type === "interval"
        ? "interval"
        : automation?.schedule.days.length === 7
          ? "daily"
          : automation?.schedule.days.join(",") === "1,2,3,4,5"
            ? "weekdays"
            : "weekly";
  return {
    name: automation?.name ?? "",
    prompt: automation?.prompt ?? "",
    cwd: automation?.cwd ?? currentWorkspace ?? "",
    enabled: automation?.enabled ?? true,
    unattendedAccess: automation?.unattendedAccess ?? false,
    frequency,
    intervalMinutes:
      automation?.schedule.type === "interval"
        ? String(automation.schedule.intervalMinutes)
        : "60",
    onceAt:
      automation?.schedule.type === "once"
        ? localDateTimeValue(automation.schedule.at)
        : localDateTimeValue(Date.now() + 60 * 60_000),
    time:
      automation?.schedule.type === "weekly"
        ? automation.schedule.time
        : "09:00",
    weekday:
      automation?.schedule.type === "weekly"
        ? String(automation.schedule.days[0] ?? 1)
        : "1",
    target: (automation?.target.type ?? "newThread") as Target,
  };
}

function targetFromEditor(
  target: Target,
  automation?: Automation,
  currentThreadId?: string,
): AutomationTarget {
  if (target === "defaultThread") return { type: "defaultThread" };
  if (target === "newThread") return { type: "newThread" };
  if (target === "ephemeralThread") return { type: "ephemeralThread" };
  const threadId =
    automation?.target.type === "thread"
      ? automation.target.threadId
      : currentThreadId;
  if (!threadId) throw new Error("A conversation is required.");
  return { type: "thread", threadId };
}

function localDateTimeValue(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}
