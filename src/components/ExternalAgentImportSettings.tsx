import {
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import type {
  ExternalAgentMigrationItem,
  ExternalAgentMigrationItemType,
  ExternalAgentMigrationSource,
} from "../lib/appServerTypes";
import { RoundIconButton } from "./RoundIcon";
import {
  externalAgentDetailNames,
  externalAgentItemKey,
  externalAgentResultTotals,
} from "../lib/externalAgentImport";
import type { ExternalAgentImportController } from "../lib/useExternalAgentImport";

export function ExternalAgentImportSettings({
  controller,
}: {
  controller: ExternalAgentImportController;
}) {
  const { locale, t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [source, setSource] =
    useState<ExternalAgentMigrationSource>("claude-code");
  const keyedItems = useMemo(
    () =>
      controller.items.map((item, index) => ({
        item,
        key: externalAgentItemKey(item, index),
      })),
    [controller.items],
  );
  const selectedItems = keyedItems.flatMap(({ item, key }) =>
    selected.has(key) ? [item] : [],
  );
  const totals = externalAgentResultTotals(controller.results);

  useEffect(() => {
    setSelected(new Set());
    setConfirming(false);
  }, [controller.items]);

  return (
    <section className="external-import-settings" aria-labelledby="external-import-title">
      <header className="external-import-heading">
        <span>
          <h2 id="external-import-title">{t("externalImport.title")}</h2>
          <p>{t("externalImport.description")}</p>
        </span>
        <span className="external-import-detection">
          <label>
            <span>{t("externalImport.source")}</span>
            <select
              value={source}
              disabled={controller.detecting || controller.importing}
              onChange={(event) =>
                setSource(event.target.value as ExternalAgentMigrationSource)
              }
            >
              <option value="claude-code">
                {t("externalImport.source.claude")}
              </option>
              <option value="cursor">{t("externalImport.source.cursor")}</option>
            </select>
          </label>
          <button
            className="secondary-button"
            disabled={controller.detecting || controller.importing}
            onClick={() => void controller.detect(source)}
          >
            {controller.detecting ? (
              <RefreshCw className="spinning" />
            ) : (
              <Search />
            )}
            {t(
              controller.detecting
                ? "externalImport.detecting"
                : "externalImport.detect",
            )}
          </button>
        </span>
      </header>

      {controller.error && (
        <div className="inventory-message error" role="alert">
          {t("externalImport.error", { detail: controller.error })}
        </div>
      )}

      {!controller.detecting && controller.items.length === 0 && (
        <div className="external-import-empty">
          <Download />
          <span>
            <strong>{t("externalImport.emptyTitle")}</strong>
            <small>{t("externalImport.emptyDetail")}</small>
          </span>
        </div>
      )}

      {keyedItems.length > 0 && (
        <>
          <div className="external-import-list">
            {keyedItems.map(({ item, key }) => (
              <MigrationItem
                key={key}
                item={item}
                checked={selected.has(key)}
                disabled={controller.importing}
                onChange={(checked) => {
                  setConfirming(false);
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(key);
                    else next.delete(key);
                    return next;
                  });
                }}
              />
            ))}
          </div>
          <div className="external-import-actions">
            <small>
              {t("externalImport.selected", {
                count: selectedItems.length,
              })}
            </small>
            {!confirming ? (
              <RoundIconButton
                disabled={selectedItems.length === 0 || controller.importing}
                icon={Download}
                label={t("externalImport.prepare")}
                onClick={() => setConfirming(true)}
                variant="secondary"
              />
            ) : (
              <div className="external-import-confirm" role="group">
                <span>
                  <strong>{t("externalImport.confirmTitle")}</strong>
                  <small>
                    {t("externalImport.confirmDetail", {
                      count: selectedItems.length,
                    })}
                  </small>
                </span>
                <button
                  className="secondary-button"
                  disabled={controller.importing}
                  onClick={() => setConfirming(false)}
                >
                  {t("externalImport.cancel")}
                </button>
                <button
                  disabled={controller.importing}
                  onClick={() => {
                    setConfirming(false);
                    void controller.importItems(selectedItems);
                  }}
                >
                  <Download />
                  {t("externalImport.confirm")}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {(controller.importing || controller.completed) && (
        <div
          className={`external-import-result${controller.completed ? " complete" : ""}`}
          role={controller.importing ? "status" : undefined}
          aria-live="polite"
        >
          {controller.importing ? (
            <RefreshCw className="spinning" />
          ) : totals.failures > 0 ? (
            <AlertTriangle />
          ) : (
            <CheckCircle2 />
          )}
          <span>
            <strong>
              {t(
                controller.importing
                  ? "externalImport.importing"
                  : "externalImport.completed",
              )}
            </strong>
            <small>
              {t("externalImport.resultSummary", {
                successes: totals.successes,
                failures: totals.failures,
              })}
            </small>
          </span>
          {controller.completed && (
            <button
              className="secondary-button"
              onClick={controller.clearResult}
            >
              {t("externalImport.dismiss")}
            </button>
          )}
          {controller.results.flatMap((result) =>
            result.failures.map((failure, index) => (
              <p role="alert" key={`${result.itemType}-${index}`}>
                <strong>{itemTypeLabel(failure.itemType, t)}</strong>
                {failure.message}
              </p>
            )),
          )}
        </div>
      )}

      <section className="external-import-history" aria-labelledby="external-import-history">
        <header>
          <span>
            <History />
            <h3 id="external-import-history">{t("externalImport.history")}</h3>
          </span>
          <RoundIconButton
            className="icon-button"
            aria-label={t("externalImport.refreshHistory")}
            disabled={controller.historyLoading}
            icon={RefreshCw}
            iconClassName={controller.historyLoading ? "spinning" : ""}
            onClick={() => void controller.refreshHistory()}
            variant="tertiary"
          />
        </header>
        {controller.histories.length === 0 ? (
          <small>{t("externalImport.noHistory")}</small>
        ) : (
          <ul>
            {controller.histories.slice(0, 10).map((history) => (
              <li key={history.importId}>
                <span>
                  <strong>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(history.completedAtMs))}
                  </strong>
                  <small>
                    {t("externalImport.resultSummary", {
                      successes: history.successes.length,
                      failures: history.failures.length,
                    })}
                  </small>
                </span>
                {history.failures.length > 0 ? (
                  <AlertTriangle />
                ) : (
                  <CheckCircle2 />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function MigrationItem({
  item,
  checked,
  disabled,
  onChange,
}: {
  item: ExternalAgentMigrationItem;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const details = externalAgentDetailNames(item.details);
  return (
    <label className="external-import-item">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{itemTypeLabel(item.itemType, t)}</strong>
        <small>{item.description}</small>
        <em>
          {item.cwd
            ? t("externalImport.workspaceScope", { cwd: item.cwd })
            : t("externalImport.homeScope")}
        </em>
        {details.length > 0 && <code>{details.join(" · ")}</code>}
      </span>
    </label>
  );
}

function itemTypeLabel(
  type: ExternalAgentMigrationItemType,
  t: (key: MessageKey) => string,
) {
  const keys: Record<ExternalAgentMigrationItemType, MessageKey> = {
    AGENTS_MD: "externalImport.type.agents",
    CONFIG: "externalImport.type.config",
    SKILLS: "externalImport.type.skills",
    PLUGINS: "externalImport.type.plugins",
    MCP_SERVER_CONFIG: "externalImport.type.mcp",
    SUBAGENTS: "externalImport.type.subagents",
    HOOKS: "externalImport.type.hooks",
    COMMANDS: "externalImport.type.commands",
    MEMORY: "externalImport.type.memory",
    SESSIONS: "externalImport.type.sessions",
  };
  return t(keys[type]);
}
