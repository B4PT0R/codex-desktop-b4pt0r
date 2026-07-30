import { useI18n } from "../i18n/I18nProvider";
import type { DefaultThreadSettingsController } from "../lib/useDefaultThreadSettings";

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
            {t("settings.defaultThread.configured")}
          </option>
        )}
        {controller.threadOptions.map((thread) => (
          <option key={thread.id} value={thread.id}>
            {threadOptionLabel(thread)}
          </option>
        ))}
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
