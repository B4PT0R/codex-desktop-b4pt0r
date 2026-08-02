import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  settingsSectionLabel,
  type SettingsSectionId,
} from "../lib/settingsSections";
import type { AccountController } from "../lib/useAccount";
import type { AppUpdateController } from "../lib/useAppUpdate";
import type { AppsController } from "../lib/useApps";
import type { AutomationsController } from "../lib/automations";
import type { CapabilityCatalog } from "../lib/useCapabilityCatalog";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { ChatPresentationSettingsController } from "../lib/useChatPresentationSettings";
import type { ConfigRequirements } from "../lib/useConfigRequirements";
import type { ExternalAgentImportController } from "../lib/useExternalAgentImport";
import type { DefaultThreadSettingsController } from "../lib/useDefaultThreadSettings";
import type { IntegrationsController } from "../lib/useIntegrations";
import type { MemorySettingsController } from "../lib/useMemorySettings";
import type { RateLimitsController } from "../lib/useRateLimits";
import type { RealtimeSettingsController } from "../lib/useRealtimeSettings";
import type { RemoteControlController } from "../lib/useRemoteControl";
import type { Model } from "../types";
import { AccountSettings } from "./AccountSettings";
import { AgentSettings, PermissionSettings } from "./AgentSettingsSections";
import { AppearanceSettings } from "./AppearanceSettings";
import { AutomationSettings } from "./AutomationSettings";
import { CodexConfigSettings } from "./CodexConfigSettings";
import { ExternalAgentImportSettings } from "./ExternalAgentImportSettings";
import {
  BrowserSettings,
  GeneralSettings,
  type AppServerRestartController,
} from "./GeneralSettingsSections";
import { HooksSettings } from "./HooksSettings";
import {
  AppsSettings,
  McpSettings,
  PluginsSettings,
  SkillsSettings,
} from "./IntegrationSettings";
import { MemorySettings } from "./MemorySettings";
import { RemoteControlSettings } from "./RemoteControlSettings";
import { SettingsNavigation } from "./SettingsNavigation";
import { VoiceSettings } from "./VoiceSettings";

export type SettingsViewProps = {
  account: AccountController;
  appUpdate: AppUpdateController;
  apps: AppsController;
  capabilities: CapabilityCatalog;
  chatPresentation: ChatPresentationSettingsController;
  configRequirements?: ConfigRequirements & {
    error?: string;
    loading?: boolean;
  };
  defaultThread: DefaultThreadSettingsController;
  externalAgentImport: ExternalAgentImportController;
  integrations: IntegrationsController;
  models: Model[];
  rateLimits: RateLimitsController;
  realtime: RealtimeSettingsController;
  memory: MemorySettingsController;
  remoteControl: RemoteControlController;
  automations: AutomationsController;
  currentThreadId?: string;
  currentWorkspace?: string;
  webSearch: CodexGlobalSettingsController;
  appServerRestart: AppServerRestartController;
  section: SettingsSectionId;
  onClose: () => void;
  onSelectSection: (section: SettingsSectionId) => void;
};

export function SettingsView(props: SettingsViewProps) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLElement>(null);

  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [props.section]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [props.onClose]);

  return (
    <div className="settings-view">
      <SettingsNavigation
        activeSection={props.section}
        onClose={props.onClose}
        onSelectSection={props.onSelectSection}
      />
      <main ref={content} className="settings-content">
        <h1 ref={heading} tabIndex={-1}>
          {settingsSectionLabel(props.section, t)}
        </h1>
        <SettingsSection {...props} />
      </main>
    </div>
  );
}

function SettingsSection(props: SettingsViewProps) {
  switch (props.section) {
    case "general":
      return (
        <GeneralSettings
          appUpdate={props.appUpdate}
          appServerRestart={props.appServerRestart}
          defaultThread={props.defaultThread}
          globalSettings={props.webSearch}
        />
      );
    case "browser":
      return (
        <BrowserSettings
          integrations={props.integrations}
          globalSettings={props.webSearch}
        />
      );
    case "memory":
      return <MemorySettings controller={props.memory} />;
    case "remoteControl":
      return <RemoteControlSettings controller={props.remoteControl} />;
    case "automations":
      return (
        <AutomationSettings
          controller={props.automations}
          currentThreadId={props.currentThreadId}
          currentWorkspace={props.currentWorkspace}
        />
      );
    case "agent":
      return (
        <AgentSettings
          globalSettings={props.webSearch}
          models={props.models}
        />
      );
    case "appearance":
      return (
        <AppearanceSettings
          globalSettings={props.webSearch}
          presentation={props.chatPresentation}
        />
      );
    case "voice":
      return <VoiceSettings controller={props.realtime} />;
    case "permissions":
      return (
        <PermissionSettings
          capabilities={props.capabilities}
          configRequirements={props.configRequirements}
          globalSettings={props.webSearch}
        />
      );
    case "config":
      return <CodexConfigSettings globalSettings={props.webSearch} />;
    case "apps":
      return <AppsSettings apps={props.apps} />;
    case "skills":
      return <SkillsSettings integrations={props.integrations} />;
    case "plugins":
      return <PluginsSettings integrations={props.integrations} />;
    case "mcp":
      return <McpSettings integrations={props.integrations} />;
    case "hooks":
      return (
        <HooksSettings
          integrations={props.integrations}
          managedOnly={props.configRequirements?.managedHooksOnly}
        />
      );
    case "account":
      return (
        <AccountSettings
          controller={props.account}
          rateLimits={props.rateLimits}
        />
      );
    case "advanced":
      return (
        <ExternalAgentImportSettings controller={props.externalAgentImport} />
      );
  }

  const unhandledSection: never = props.section;
  return unhandledSection;
}
