import {
  CalendarCheck2,
  CalendarClock,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type {
  Automation,
  AutomationDraft,
  AutomationsController,
} from "../lib/automations";
import { RoundIconButton } from "./RoundIcon";

type Frequency = "once" | "interval" | "daily" | "weekdays" | "weekly";
type Target = "thread" | "newThread" | "ephemeralThread";

export function AutomationSettings({
  controller,
  currentThreadId,
  currentWorkspace,
}: {
  controller: AutomationsController;
  currentThreadId?: string;
  currentWorkspace?: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Automation | "new">();
  const [confirmingDelete, setConfirmingDelete] = useState<string>();
  return (
    <section className="settings-page automations-settings">
      <header>
        <p>{t("automations.description")}</p>
        <RoundIconButton
          icon={Plus}
          label={t("automations.create")}
          onClick={() => setEditing("new")}
          variant="secondary"
        />
      </header>
      {controller.error && (
        <p className="inventory-message error" role="alert">
          {controller.error}
        </p>
      )}
      {editing && (
        <AutomationEditor
          automation={editing === "new" ? undefined : editing}
          currentThreadId={currentThreadId}
          currentWorkspace={currentWorkspace}
          onCancel={() => setEditing(undefined)}
          onSave={async (draft) => {
            if (await controller.save(draft)) setEditing(undefined);
          }}
        />
      )}
      <div className="settings-card automation-list">
        {controller.loading && controller.automations.length === 0 ? (
          <p className="inventory-empty">{t("automations.loading")}</p>
        ) : controller.automations.length === 0 ? (
          <p className="inventory-empty">
            <CalendarClock />
            {t("automations.empty")}
          </p>
        ) : (
          controller.automations.map((automation) => (
            <AutomationRow
              automation={automation}
              confirmingDelete={confirmingDelete === automation.id}
              key={automation.id}
              onCancelDelete={() => setConfirmingDelete(undefined)}
              onConfirmDelete={() =>
                void controller
                  .deleteAutomation(automation.id)
                  .then(() => setConfirmingDelete(undefined))
              }
              onDelete={() => setConfirmingDelete(automation.id)}
              onEdit={() => setEditing(automation)}
              onRun={() => void controller.runNow(automation.id)}
              onToggle={() =>
                void controller.save({
                  ...draftFromAutomation(automation),
                  enabled: !automation.enabled,
                })
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

function AutomationRow({
  automation,
  confirmingDelete,
  onCancelDelete,
  onConfirmDelete,
  onDelete,
  onEdit,
  onRun,
  onToggle,
}: {
  automation: Automation;
  confirmingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRun: () => void;
  onToggle: () => void;
}) {
  const { locale, t } = useI18n();
  const completedOnce =
    automation.schedule.type === "once" &&
    Boolean(automation.lastRunAt) &&
    !automation.activeRunId;
  const nextRun = automation.nextRunAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(automation.nextRunAt)
    : completedOnce
      ? t("automations.completed")
      : t("automations.paused");
  return (
    <article className="automation-row">
      <span className={`automation-state ${automation.lastStatus ?? "idle"}`}>
        {automation.lastStatus === "running" ? (
          <span className="settings-loader-spinner" />
        ) : automation.lastStatus === "succeeded" ? (
          <CalendarCheck2 />
        ) : automation.enabled ? (
          <CalendarClock />
        ) : (
          <Pause />
        )}
      </span>
      <button
        className="automation-main"
        disabled={automation.lastStatus === "running"}
        onClick={onEdit}
      >
        <strong>{automation.name}</strong>
        <small>
          {scheduleLabel(automation, locale, t)}
          <span aria-hidden="true"> · </span>
          {targetLabel(automation, t)}
          {automation.unattendedAccess && (
            <>
              <span aria-hidden="true"> · </span>
              {t("automations.unattendedShort")}
            </>
          )}
        </small>
        <small>{t("automations.next", { date: nextRun })}</small>
        {automation.lastError && (
          <em>
            {automation.lastError === "automation-interrupted"
              ? t("automations.interrupted")
              : automation.lastError}
          </em>
        )}
      </button>
      <div className="automation-actions">
        {confirmingDelete ? (
          <div className="automation-delete-confirm" role="group">
            <span>{t("automations.confirmDelete")}</span>
            <RoundIconButton
              label={t("common.cancel")}
              onClick={onCancelDelete}
              size="small"
              variant="secondary"
            />
            <RoundIconButton
              className="danger"
              label={t("automations.delete")}
              onClick={onConfirmDelete}
              size="small"
              variant="secondary"
            />
          </div>
        ) : (
          <>
            <RoundIconButton
              disabled={automation.lastStatus === "running"}
              icon={Play}
              aria-label={t("automations.runNow")}
              onClick={onRun}
              variant="tertiary"
            />
            {!completedOnce && (
              <RoundIconButton
                disabled={automation.lastStatus === "running"}
                icon={automation.enabled ? Pause : Play}
                aria-label={t(
                  automation.enabled
                    ? "automations.pause"
                    : "automations.resume",
                )}
                onClick={onToggle}
                variant="tertiary"
              />
            )}
            <RoundIconButton
              disabled={automation.lastStatus === "running"}
              icon={Trash2}
              aria-label={t("automations.delete")}
              onClick={onDelete}
              variant="tertiary"
            />
          </>
        )}
      </div>
    </article>
  );
}

function AutomationEditor({
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
  const initial = useMemo(
    () => editorState(automation, currentThreadId, currentWorkspace),
    [automation, currentThreadId, currentWorkspace],
  );
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const onceAt = new Date(state.onceAt).getTime();
  const canSave =
    state.name.trim() &&
    state.prompt.trim() &&
    (state.frequency !== "once" ||
      (Number.isFinite(onceAt) && onceAt > Date.now()));
  const submit = async (event: React.FormEvent) => {
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
        target:
          state.target === "thread"
            ? {
                type: "thread",
                threadId:
                  automation?.target.type === "thread"
                    ? automation.target.threadId
                    : currentThreadId!,
              }
            : state.target === "ephemeralThread"
              ? { type: "ephemeralThread" }
              : { type: "newThread" },
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
  currentThreadId?: string,
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

function draftFromAutomation(automation: Automation): AutomationDraft {
  return {
    id: automation.id,
    name: automation.name,
    prompt: automation.prompt,
    cwd: automation.cwd,
    enabled: automation.enabled,
    unattendedAccess: automation.unattendedAccess,
    schedule: automation.schedule,
    target: automation.target,
  };
}

function scheduleLabel(
  automation: Automation,
  locale: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (automation.schedule.type === "once") {
    return t("automations.onceAt", {
      date: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(automation.schedule.at),
    });
  }
  if (automation.schedule.type === "interval")
    return t("automations.everyMinutes", {
      count: automation.schedule.intervalMinutes,
    });
  return t("automations.atTime", { time: automation.schedule.time });
}

function localDateTimeValue(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

function targetLabel(
  automation: Automation,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (automation.target.type === "thread") {
    return t("automations.existingThread");
  }
  return t(
    automation.target.type === "ephemeralThread"
      ? "automations.ephemeralThread"
      : "automations.newThread",
  );
}
