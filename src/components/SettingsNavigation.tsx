import {
  ArrowLeft,
  Bot,
  Brain,
  CalendarClock,
  Boxes,
  Download,
  FileCog,
  Globe2,
  Mic,
  Palette,
  Plug,
  Puzzle,
  RadioTower,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Webhook,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  filteredSettingsSections,
  type SettingsSectionGroupId,
  type SettingsSectionId,
} from "../lib/settingsSections";
import { RoundIconButton } from "./RoundIcon";

const icons: Record<SettingsSectionId, ComponentType> = {
  general: Settings,
  browser: Globe2,
  memory: Brain,
  remoteControl: RadioTower,
  automations: CalendarClock,
  agent: Bot,
  appearance: Palette,
  voice: Mic,
  account: UserRound,
  apps: Boxes,
  skills: Sparkles,
  plugins: Puzzle,
  mcp: Plug,
  permissions: ShieldCheck,
  config: FileCog,
  hooks: Webhook,
  advanced: Download,
};

export function SettingsNavigation({
  activeSection,
  onClose,
  onSelectSection,
}: {
  activeSection: SettingsSectionId;
  onClose: () => void;
  onSelectSection: (section: SettingsSectionId) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const sections = filteredSettingsSections(query, t);
  const groups: Array<{ id: SettingsSectionGroupId; label: string }> = [
    { id: "application", label: t("settings.group.application") },
    { id: "agents", label: t("settings.group.agents") },
    { id: "extensions", label: t("settings.group.extensions") },
    { id: "advanced", label: t("settings.group.advanced") },
  ];

  return (
    <aside
      className="settings-navigation"
      aria-label={t("settings.navigation")}
    >
      <RoundIconButton
        className="settings-back"
        icon={ArrowLeft}
        label={t("settings.back")}
        onClick={onClose}
        variant="tertiary"
      />
      <label className="settings-search">
        <Search />
        <input
          value={query}
          placeholder={t("settings.search")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <nav>
        {groups.map((group) => {
          const items = sections.filter((item) => item.group === group.id);
          if (items.length === 0) return null;
          return <section className="settings-navigation-group" key={group.id} aria-labelledby={`settings-group-${group.id}`}>
            <h2 id={`settings-group-${group.id}`}>{group.label}</h2>
            {items.map((item) => (
              <RoundIconButton
                key={item.id}
                aria-current={activeSection === item.id ? "page" : undefined}
                gap="large"
                icon={icons[item.id]}
                label={<><span>{item.label}</span>{!item.available && <small>{t("settings.planned")}</small>}</>}
                onClick={() => onSelectSection(item.id)}
                size="medium"
                variant="tertiary"
              />
            ))}
          </section>;
        })}
        {sections.length === 0 && <p>{t("settings.noResults")}</p>}
      </nav>
    </aside>
  );
}
