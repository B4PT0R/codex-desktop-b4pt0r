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
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { SettingsControlsBar } from "./SettingsControlsBar";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { Alert } from "./Alert";
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
    <section className="settings-page external-agent-import-page">
      <SettingsPageHeader description={t("externalImport.description")} />
      <CardStack className="settings-fields external-agent-import-discovery">
        <IconCard
          as="label"
          title={t("externalImport.source")}
          trailing={<select
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
          </select>}
        />
        <IconCard
          title={t("externalImport.detect")}
          subtitle={t("externalImport.description")}
          trailing={<RoundIconButton
            disabled={controller.detecting || controller.importing}
            icon={controller.detecting ? RefreshCw : Search}
            iconClassName={controller.detecting ? "spinning" : undefined}
            label={t(
              controller.detecting
                ? "externalImport.detecting"
                : "externalImport.detect",
            )}
            onClick={() => void controller.detect(source)}
            variant="secondary"
          />}
        />
      </CardStack>

      {controller.error && (
        <Alert tone="error">
          {t("externalImport.error", { detail: controller.error })}
        </Alert>
      )}

      {!controller.detecting && controller.items.length === 0 && (
        <CardStack>
          <IconCard
            icon={<Download />}
            title={t("externalImport.emptyTitle")}
            subtitle={t("externalImport.emptyDetail")}
          />
        </CardStack>
      )}

      {keyedItems.length > 0 && (
        <>
          <CardStack
            className="external-agent-import-list"
            controlBar={<SettingsControlsBar
              label={confirming
                ? t("externalImport.confirmTitle")
                : t("externalImport.selected", {
                    count: selectedItems.length,
                  })}
              actions={!confirming ? (
                <RoundIconButton
                  disabled={selectedItems.length === 0 || controller.importing}
                  icon={Download}
                  label={t("externalImport.prepare")}
                  onClick={() => setConfirming(true)}
                  variant="secondary"
                />
              ) : (
                <span className="external-agent-import-confirm" role="group">
                  <RoundIconButton
                    disabled={controller.importing}
                    label={t("externalImport.cancel")}
                    onClick={() => setConfirming(false)}
                    variant="secondary"
                  />
                  <RoundIconButton
                    disabled={controller.importing}
                    icon={Download}
                    label={t("externalImport.confirm")}
                    onClick={() => {
                      setConfirming(false);
                      void controller.importItems(selectedItems);
                    }}
                    variant="primary"
                  />
                </span>
              )}
              status={confirming
                ? t("externalImport.confirmDetail", {
                    count: selectedItems.length,
                  })
                : undefined}
            />}
          >
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
          </CardStack>
        </>
      )}

      {(controller.importing || controller.completed) && (
        <CardStack className={controller.completed ? "external-agent-import-result-complete" : ""}>
          <IconCard
            className="external-agent-import-result"
            icon={controller.importing ? (
              <RefreshCw className="spinning" />
            ) : totals.failures > 0 ? (
              <AlertTriangle />
            ) : (
              <CheckCircle2 />
            )}
            title={t(
                controller.importing
                  ? "externalImport.importing"
                  : "externalImport.completed",
              )}
            subtitle={t("externalImport.resultSummary", {
                successes: totals.successes,
                failures: totals.failures,
              })}
            trailing={controller.completed ? (
            <RoundIconButton
              label={t("externalImport.dismiss")}
              onClick={controller.clearResult}
              variant="secondary"
            />
            ) : undefined}
          >
          {controller.results.flatMap((result) =>
            result.failures.map((failure, index) => (
              <p role="alert" key={`${result.itemType}-${index}`}>
                <strong>{itemTypeLabel(failure.itemType, t)}</strong>
                {failure.message}
              </p>
            )),
          )}
          </IconCard>
        </CardStack>
      )}

      <CardStack
        className="external-agent-import-history"
        controlBar={<SettingsControlsBar
          label={t("externalImport.history")}
          actions={<RoundIconButton
            className="icon-button"
            aria-label={t("externalImport.refreshHistory")}
            disabled={controller.historyLoading}
            icon={RefreshCw}
            iconClassName={controller.historyLoading ? "spinning" : ""}
            onClick={() => void controller.refreshHistory()}
            variant="tertiary"
          />}
        />}
      >
        {controller.histories.length === 0 ? (
          <IconCard
            icon={<History />}
            title={t("externalImport.noHistory")}
          />
        ) : (
          <>
            {controller.histories.slice(0, 10).map((history) => (
              <IconCard
                icon={history.failures.length > 0 ? <AlertTriangle /> : <CheckCircle2 />}
                key={history.importId}
                title={new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(history.completedAtMs))}
                subtitle={t("externalImport.resultSummary", {
                      successes: history.successes.length,
                      failures: history.failures.length,
                    })}
              />
            ))}
          </>
        )}
      </CardStack>
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
    <IconCard
      as="label"
      className="external-agent-import-item"
      icon={<Download />}
      title={itemTypeLabel(item.itemType, t)}
      subtitle={item.description}
      trailing={<input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />}
    >
      <em>
        {item.cwd
          ? t("externalImport.workspaceScope", { cwd: item.cwd })
          : t("externalImport.homeScope")}
      </em>
      {details.length > 0 && <code>{details.join(" · ")}</code>}
    </IconCard>
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
