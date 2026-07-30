import {
  CalendarCheck2,
  CalendarClock,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  DEFAULT_THREAD_UNAVAILABLE_ERROR,
  type Automation,
  type AutomationDraft,
  type AutomationsController,
} from "../lib/automations";
import { AutomationEditor } from "./AutomationEditor";
import { RoundIconButton } from "./RoundIcon";

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
          key={editing === "new" ? "new" : editing.id}
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
              : automation.lastError === DEFAULT_THREAD_UNAVAILABLE_ERROR
                ? t("automations.defaultThreadUnavailable")
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

function targetLabel(
  automation: Automation,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (automation.target.type === "thread") {
    return t("automations.existingThread");
  }
  if (automation.target.type === "defaultThread") {
    return t("automations.defaultThread");
  }
  return t(
    automation.target.type === "ephemeralThread"
      ? "automations.ephemeralThread"
      : "automations.newThread",
  );
}
