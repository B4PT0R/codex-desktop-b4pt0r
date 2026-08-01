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
  plugins: Sparkles,
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
        {sections.map((item) => (
          <RoundIconButton
            key={item.id}
            aria-current={activeSection === item.id ? "page" : undefined}
            gap="large"
            icon={icons[item.id]}
            label={
              <>
                <span>{item.label}</span>
                {!item.available && <small>{t("settings.planned")}</small>}
              </>
            }
            onClick={() => onSelectSection(item.id)}
            size="large"
            variant="tertiary"
          />
        ))}
        {sections.length === 0 && <p>{t("settings.noResults")}</p>}
      </nav>
    </aside>
  );
}
