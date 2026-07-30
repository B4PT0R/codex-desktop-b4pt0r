import { useI18n } from "../i18n/I18nProvider";
import type { DefaultThreadSettingsController } from "../lib/useDefaultThreadSettings";

const maxThreadTitleLength = 42;
const maxWorkspacePathLength = 36;

export function DefaultThreadSettingsField({
  controller,
}: {
  controller: DefaultThreadSettingsController;
}) {
  const { t } = useI18n();
  const configuredThreadIsListed =
    !controller.defaultThreadId ||
    controller.threadOptions.some(
      (thread) => thread.id === controller.defaultThreadId,
    );

  return (
    <label>
      <span className="settings-field-description">
        <strong>{t("settings.defaultThread.title")}</strong>
        <small>{t("settings.defaultThread.detail")}</small>
      </span>
      <select
        className="default-thread-select"
        aria-label={t("settings.defaultThread.title")}
        value={controller.defaultThreadId ?? ""}
        disabled={controller.saving}
        onChange={(event) =>
          void controller.setDefaultThreadId(event.target.value || undefined)
        }
      >
        <option value="">{t("settings.defaultThread.automatic")}</option>
        {!configuredThreadIsListed && controller.defaultThreadId && (
          <option value={controller.defaultThreadId}>
            {t("settings.defaultThread.pending")}
          </option>
        )}
        {controller.threadOptions.map((thread) => {
          const fullLabel = threadOptionLabel(thread);
          return (
            <option
              aria-label={fullLabel}
              key={thread.id}
              title={fullLabel}
              value={thread.id}
            >
              {compactThreadOptionLabel(thread)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function threadOptionLabel(
  thread: DefaultThreadSettingsController["threadOptions"][number],
) {
  const name = thread.name || thread.preview || thread.id.slice(0, 12);
  return thread.cwd ? `${name} — ${thread.cwd}` : name;
}

function compactThreadOptionLabel(
  thread: DefaultThreadSettingsController["threadOptions"][number],
) {
  const name = truncateEnd(
    thread.name || thread.preview || thread.id.slice(0, 12),
    maxThreadTitleLength,
  );
  const cwd = thread.cwd
    ? truncateStart(thread.cwd, maxWorkspacePathLength)
    : undefined;
  return cwd ? `${name} — ${cwd}` : name;
}

function truncateEnd(value: string, maximum: number) {
  return value.length > maximum
    ? `${value.slice(0, maximum - 1)}…`
    : value;
}

function truncateStart(value: string, maximum: number) {
  return value.length > maximum
    ? `…${value.slice(-(maximum - 1))}`
    : value;
}
