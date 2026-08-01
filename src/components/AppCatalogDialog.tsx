import { ArrowLeft, Check, Compass, ExternalLink, Search, Settings2, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppInfo } from "../lib/appServerTypes";
import type { AppConfigurationEditorData, AppsController } from "../lib/useApps";
import { useDialogFocus } from "../lib/useDialogFocus";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { RoundIcon, RoundIconButton } from "./RoundIcon";

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
  const [selected, setSelected] = useState<AppInfo>();
  const [details, setDetails] = useState<AppConfigurationEditorData>();
  const [openedInstall, setOpenedInstall] = useState<string>();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: onCancel,
  });
  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return apps.catalogApps.filter((app) => {
      if (filter === "connected" && !app.isAccessible) return false;
      if (filter === "available" && app.isAccessible) return false;
      if (!normalized) return true;
      return [app.name, app.description, app.branding?.category, app.branding?.developer]
        .some((value) => value?.toLocaleLowerCase().includes(normalized));
    });
  }, [apps.catalogApps, filter, query]);

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
          <CardStack className="app-catalog-list">
            {visibleApps.length === 0 ? <div className="inventory-empty">{t("integrations.apps.catalogEmpty")}</div> : visibleApps.map((app) => <IconCard
              icon={<Sparkles />}
              key={app.id}
              subtitle={app.description ?? t("integrations.apps.fallback")}
              title={app.name}
              trailing={<div className="app-catalog-card-actions">
                <span className={`app-catalog-status ${app.isAccessible ? "connected" : "available"}`}>
                  {app.isAccessible ? <Check aria-hidden="true" /> : null}
                  {t(app.isAccessible ? "integrations.apps.connected" : "integrations.apps.availableToConnect")}
                </span>
                <RoundIconButton label={t("integrations.apps.viewDetails")} onClick={() => openDetails(app)} size="medium" variant="secondary" />
              </div>}
            >
              {(app.branding?.category || app.branding?.developer) && <small className="app-catalog-meta">{[app.branding?.category, app.branding?.developer].filter(Boolean).join(" · ")}</small>}
            </IconCard>)}
          </CardStack>
        </>}
      </div>
      <div className="modal-actions">
        <RoundIconButton label={t("common.close")} onClick={onCancel} variant="secondary" />
      </div>
    </div>
  </div>;
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
        ? <RoundIconButton icon={Settings2} label={t("integrations.apps.configure")} onClick={onConfigure} variant="primary" />
        : openedInstall
          ? <RoundIconButton label={t("integrations.apps.refreshConnection")} onClick={() => void onRefresh()} variant="primary" />
          : app.installUrl
            ? <RoundIconButton icon={ExternalLink} label={t("integrations.apps.connect")} onClick={() => void onInstall()} variant="primary" />
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
