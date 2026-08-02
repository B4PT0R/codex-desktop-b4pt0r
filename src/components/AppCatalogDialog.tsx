import { ArrowLeft, Check, Compass, ExternalLink, Search, Settings2, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppInfo } from "../lib/appServerTypes";
import type { AppConfigurationEditorData, AppsController } from "../lib/useApps";
import { useDialogFocus } from "../lib/useDialogFocus";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

type CatalogFilter = "all" | "connected" | "available";

export function AppCatalogDialog({
  apps,
  onCancel,
  onConfigure,
}: {
  apps: AppsController;
  onCancel: () => void;
  onConfigure: (app: AppInfo) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [initial, setInitial] = useState("all");
  const [selected, setSelected] = useState<AppInfo>();
  const [details, setDetails] = useState<AppConfigurationEditorData>();
  const [openedInstall, setOpenedInstall] = useState<string>();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: onCancel,
  });
  const categories = useMemo(() => Array.from(new Set(
    apps.catalogApps.flatMap(appCategories),
  )).sort((left, right) => left.localeCompare(right)), [apps.catalogApps]);
  const matchingApps = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return apps.catalogApps.filter((app) => {
      if (filter === "connected" && !app.isAccessible) return false;
      if (filter === "available" && app.isAccessible) return false;
      if (!normalized) return true;
      return [app.name, app.description, app.branding?.developer, ...appCategories(app)]
        .some((value) => value?.toLocaleLowerCase().includes(normalized));
    });
  }, [apps.catalogApps, filter, query]);
  const categoryApps = useMemo(() => matchingApps.filter((app) =>
    category === "all" || appCategories(app).includes(category)
  ), [category, matchingApps]);
  const initials = useMemo(() => Array.from(new Set(categoryApps.map(appInitial))).sort(), [categoryApps]);
  const effectiveInitial = initial === "all" || initials.includes(initial) ? initial : "all";
  const visibleApps = useMemo(() => categoryApps
    .filter((app) => effectiveInitial === "all" || appInitial(app) === effectiveInitial)
    .sort((left, right) => left.name.localeCompare(right.name)), [categoryApps, effectiveInitial]);
  const groups = useMemo(() => groupAppsByInitial(visibleApps), [visibleApps]);

  const openDetails = (app: AppInfo) => {
    setSelected(app);
    setDetails(undefined);
    void apps.readConfiguration(app).then((value) => {
      if (value) setDetails(value);
    });
  };

  return <div className="overlay">
    <div
      aria-labelledby="app-catalog-title"
      aria-modal="true"
      className="modal settings-form-dialog app-catalog-dialog"
      onKeyDown={onDialogKeyDown}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="settings-form-dialog-heading">
        <RoundIcon icon={Compass} size="large" variant="primary" />
        <div>
          <h2 id="app-catalog-title">{t("integrations.apps.catalogTitle")}</h2>
          <small>{t("integrations.apps.catalogDetail")}</small>
        </div>
      </div>
      <div className="settings-form-dialog-body app-catalog-body">
        {selected ? <AppDetails
          app={selected}
          details={details}
          openedInstall={openedInstall === selected.id}
          onBack={() => { setSelected(undefined); setDetails(undefined); }}
          onConfigure={() => onConfigure(selected)}
          onInstall={async () => {
            if (await apps.openInstall(selected)) setOpenedInstall(selected.id);
          }}
          onRefresh={async () => {
            await apps.refresh();
            setSelected(undefined);
            setDetails(undefined);
          }}
        /> : <>
          <div className="app-catalog-toolbar">
            <div className="app-catalog-search">
              <Search aria-hidden="true" />
              <input
                aria-label={t("integrations.apps.search")}
                data-dialog-initial-focus
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("integrations.apps.searchPlaceholder")}
                type="search"
                value={query}
              />
            </div>
            <select
              aria-label={t("integrations.apps.categories")}
              onChange={(event) => { setCategory(event.target.value); setInitial("all"); }}
              value={category}
            >
              <option value="all">{t("integrations.apps.categoryAll")}</option>
              {categories.map((value) => <option key={value} value={value}>{formatCategory(value)}</option>)}
            </select>
            <select
              aria-label={t("integrations.apps.alphabeticalIndex")}
              className="app-catalog-initial-picker"
              onChange={(event) => setInitial(event.target.value)}
              value={effectiveInitial}
            >
              <option value="all">{t("integrations.apps.alphabetLabel")}</option>
              {initials.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="app-catalog-filter-row">
            <div aria-label={t("integrations.apps.catalogFilter")} className="settings-dialog-tabs" role="tablist">
              {(["all", "connected", "available"] as const).map((value) => <button
                aria-selected={filter === value}
                className={filter === value ? "active" : undefined}
                key={value}
                onClick={() => setFilter(value)}
                role="tab"
                type="button"
              >{t(`integrations.apps.filter.${value}`)}</button>)}
            </div>
            <div className="app-catalog-results-summary">
              {t(visibleApps.length === 1 ? "integrations.apps.resultOne" : "integrations.apps.resultMany", { count: visibleApps.length })}
            </div>
          </div>
          <div className="app-catalog-list">
            {visibleApps.length === 0 ? <div className="inventory-empty">{t("integrations.apps.catalogEmpty")}</div> : groups.map(([letter, groupedApps]) => <section className="app-catalog-letter-group" key={letter}>
              <h3><span>{letter}</span><small>{groupedApps.length}</small></h3>
              <CardStack>
                {groupedApps.map((app) => <IconCard
                  density="compact"
                  icon={<Sparkles />}
                  key={app.id}
                  subtitle={app.description ?? t("integrations.apps.fallback")}
                  title={app.name}
                  trailing={<div className="app-catalog-card-actions">
                    <span className={`app-catalog-status ${app.isAccessible ? "connected" : "available"}`}>
                      {app.isAccessible ? <Check aria-hidden="true" /> : null}
                      {t(app.isAccessible ? "integrations.apps.connected" : "integrations.apps.availableToConnect")}
                    </span>
                    <IconButton label={t("integrations.apps.viewDetails")} onClick={() => openDetails(app)} size="small" variant="secondary" />
                  </div>}
                />)}
              </CardStack>
            </section>)}
          </div>
        </>}
      </div>
      <div className="modal-actions">
        <IconButton label={t("common.close")} onClick={onCancel} variant="secondary" />
      </div>
    </div>
  </div>;
}

function appCategories(app: AppInfo) {
  return Array.from(new Set([
    ...(app.appMetadata?.categories ?? []),
    ...(app.branding?.category ? [app.branding.category] : []),
  ].map((value) => value.trim()).filter(Boolean)));
}

function appInitial(app: AppInfo) {
  const normalized = app.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase();
  return normalized.match(/[A-Z0-9]/)?.[0] ?? "#";
}

function groupAppsByInitial(apps: AppInfo[]): Array<[string, AppInfo[]]> {
  const groups = new Map<string, AppInfo[]>();
  for (const app of apps) {
    const key = appInitial(app);
    groups.set(key, [...(groups.get(key) ?? []), app]);
  }
  return Array.from(groups.entries());
}

function formatCategory(value: string) {
  const label = value.replace(/[-_]+/g, " ");
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

function AppDetails({ app, details, openedInstall, onBack, onConfigure, onInstall, onRefresh }: {
  app: AppInfo;
  details?: AppConfigurationEditorData;
  openedInstall: boolean;
  onBack: () => void;
  onConfigure: () => void;
  onInstall: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const developer = app.appMetadata?.developer ?? app.branding?.developer;
  return <div className="app-catalog-details">
    <button className="app-catalog-back" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" />{t("integrations.apps.backToCatalog")}</button>
    <div className="app-catalog-details-heading">
      <RoundIcon icon={Sparkles} size="large" variant="secondary" />
      <div><h3>{app.name}</h3><p>{app.description ?? t("integrations.apps.fallback")}</p></div>
    </div>
    {(developer || app.appMetadata?.version || app.branding?.category) && <div className="app-catalog-facts">
      {developer && <span>{t("integrations.apps.developer", { name: developer })}</span>}
      {app.appMetadata?.version && <span>{t("integrations.apps.version", { version: app.appMetadata.version })}</span>}
      {app.branding?.category && <span>{app.branding.category}</span>}
    </div>}
    <div className="app-catalog-primary-action">
      {app.isAccessible
        ? <IconButton icon={Settings2} label={t("integrations.apps.configure")} onClick={onConfigure} variant="primary" />
        : openedInstall
          ? <IconButton label={t("integrations.apps.refreshConnection")} onClick={() => void onRefresh()} variant="primary" />
          : app.installUrl
            ? <IconButton icon={ExternalLink} label={t("integrations.apps.connect")} onClick={() => void onInstall()} variant="primary" />
            : <span className="app-catalog-unavailable">{t("integrations.apps.installUnavailable")}</span>}
    </div>
    <h4><Wrench aria-hidden="true" />{t("integrations.apps.exposedTools")}</h4>
    {!details ? <div className="inventory-loading">{t("integrations.apps.detailsLoading")}</div> : details.tools.length === 0
      ? <div className="inventory-empty">{t("integrations.apps.toolsEmpty")}</div>
      : <CardStack className="app-catalog-tools">{details.tools.map((tool) => <IconCard
          icon={<Wrench />}
          key={tool.name}
          subtitle={tool.description}
          title={tool.title ?? tool.name}
          trailing={tool.isReadOnly ? <small>{t("integrations.apps.readOnly")}</small> : undefined}
        />)}</CardStack>}
  </div>;
}
