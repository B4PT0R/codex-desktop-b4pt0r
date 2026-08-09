import { invoke, isDesktopApp } from "./nativeBridge";
import { isRealtimeVoice } from "./realtimeVoices";

export type DesktopSettings = {
  version: number;
  locale?: "fr" | "en";
  lastWorkspace?: string;
  theme?: "system" | "dark" | "light";
  fontSize?: "small" | "default" | "large";
  interfaceScale?: number;
  keepActionGroupsCollapsed?: boolean;
  maxVisibleActionsPerGroup?: number;
  showReasoningItems?: boolean;
  defaultThreadId?: string;
  realtimeVoice?: string;
  realtimeVoiceInstructions?: string;
  realtimeParentThreadIds?: string[];
  sidebarWidth?: number;
  adultModeEnabled?: boolean;
  adultModeCredential?: import("./adultModeCredential").AdultModeCredential;
};

export type DesktopSettingsPatch = Partial<
  Pick<
    DesktopSettings,
    | "locale"
    | "lastWorkspace"
    | "theme"
    | "fontSize"
    | "interfaceScale"
    | "keepActionGroupsCollapsed"
    | "maxVisibleActionsPerGroup"
    | "showReasoningItems"
    | "defaultThreadId"
    | "realtimeVoice"
    | "realtimeVoiceInstructions"
    | "realtimeParentThreadIds"
    | "sidebarWidth"
    | "adultModeEnabled"
    | "adultModeCredential"
  >
>;

const legacyLocaleKey = "codex-desktop.locale";
const legacyWorkspaceKey = "codex-desktop.cwd";
const browserAppearanceKey = "codex-desktop.appearance";
const browserVoiceKey = "codex-desktop.realtimeVoice";
const browserVoiceInstructionsKey = "codex-desktop.realtimeVoiceInstructions";
const browserDefaultThreadKey = "codex-desktop.defaultThreadId";
const browserSidebarWidthKey = "codex-desktop.sidebarWidth";
const browserMaxVisibleActionsKey = "codex-desktop.maxVisibleActionsPerGroup";
const browserShowReasoningKey = "codex-desktop.showReasoningItems";
const browserKeepActionsCollapsedKey =
  "codex-desktop.keepActionGroupsCollapsed";
const browserAdultModeKey = "codex-desktop.adultModeEnabled";
const browserAdultModeCredentialKey = "codex-desktop.adultModeCredential";
let loadPromise: Promise<DesktopSettings> | undefined;
let writeQueue: Promise<DesktopSettings> = Promise.resolve({ version: 1 });

export function loadDesktopSettings(): Promise<DesktopSettings> {
  loadPromise ??= loadDesktopSettingsOnce();
  return loadPromise;
}

export function updateDesktopSettings(
  patch: DesktopSettingsPatch,
): Promise<DesktopSettings> {
  validatePatch(patch);
  if (!isNative()) {
    const settings = { ...browserSettings(), ...patch };
    writeBrowserSettings(settings);
    return Promise.resolve(settings);
  }
  writeQueue = writeQueue
    .catch(() => ({ version: 1 }))
    .then(() => loadDesktopSettings())
    .then(() => invoke<DesktopSettings>("update_desktop_settings", { patch }));
  return writeQueue;
}

/** Reads current persisted values without replacing the one-time UI hydration. */
export function readDesktopSettingsSnapshot(): Promise<DesktopSettings> {
  return isNative()
    ? invoke<DesktopSettings>("read_desktop_settings")
    : Promise.resolve(browserSettings());
}

async function loadDesktopSettingsOnce(): Promise<DesktopSettings> {
  if (!isNative()) return browserSettings();
  const settings = await invoke<DesktopSettings>("read_desktop_settings");
  const legacy = browserSettings();
  const patch: DesktopSettingsPatch = {};
  if (!settings.locale && legacy.locale) patch.locale = legacy.locale;
  if (!settings.lastWorkspace && legacy.lastWorkspace) {
    patch.lastWorkspace = legacy.lastWorkspace;
  }
  if (Object.keys(patch).length === 0) return settings;
  const migrated = await invoke<DesktopSettings>("update_desktop_settings", {
    patch,
  });
  localStorage.removeItem(legacyLocaleKey);
  localStorage.removeItem(legacyWorkspaceKey);
  return migrated;
}

function browserSettings(): DesktopSettings {
  const locale = localStorage.getItem(legacyLocaleKey);
  const lastWorkspace = localStorage.getItem(legacyWorkspaceKey) ?? undefined;
  const appearance = parseBrowserAppearance(
    localStorage.getItem(browserAppearanceKey),
  );
  const credential = localStorage.getItem(browserAdultModeCredentialKey);
  return {
    version: 1,
    ...(locale === "fr" || locale === "en" ? { locale } : {}),
    ...(lastWorkspace ? { lastWorkspace } : {}),
    ...appearance,
    ...(localStorage.getItem(browserVoiceKey)
      ? { realtimeVoice: localStorage.getItem(browserVoiceKey) ?? undefined }
      : {}),
    ...(localStorage.getItem(browserVoiceInstructionsKey) !== null
      ? { realtimeVoiceInstructions:
          localStorage.getItem(browserVoiceInstructionsKey) ?? "" }
      : {}),
    ...(localStorage.getItem(browserDefaultThreadKey)
      ? {
          defaultThreadId:
            localStorage.getItem(browserDefaultThreadKey) ?? undefined,
        }
      : {}),
    ...parseBrowserSidebarWidth(localStorage.getItem(browserSidebarWidthKey)),
    ...parseBrowserMaxVisibleActions(
      localStorage.getItem(browserMaxVisibleActionsKey),
    ),
    ...parseBrowserBoolean(
      "showReasoningItems",
      localStorage.getItem(browserShowReasoningKey),
    ),
    ...(credential ? { adultModeCredential: JSON.parse(credential) as DesktopSettings["adultModeCredential"] } : {}),
    ...parseBrowserBoolean(
      "keepActionGroupsCollapsed",
      localStorage.getItem(browserKeepActionsCollapsedKey),
    ),
    ...parseBrowserBoolean(
      "adultModeEnabled",
      localStorage.getItem(browserAdultModeKey),
    ),
  };
}

function writeBrowserSettings(settings: DesktopSettings) {
  if (settings.locale) localStorage.setItem(legacyLocaleKey, settings.locale);
  if (settings.lastWorkspace) {
    localStorage.setItem(legacyWorkspaceKey, settings.lastWorkspace);
  }
  localStorage.setItem(
    browserAppearanceKey,
    JSON.stringify({
      theme: settings.theme,
      fontSize: settings.fontSize,
      interfaceScale: settings.interfaceScale,
    }),
  );
  if (settings.realtimeVoice) {
    localStorage.setItem(browserVoiceKey, settings.realtimeVoice);
  }
  if (settings.realtimeVoiceInstructions !== undefined) {
    localStorage.setItem(
      browserVoiceInstructionsKey,
      settings.realtimeVoiceInstructions,
    );
  }
  if (settings.defaultThreadId) {
    localStorage.setItem(browserDefaultThreadKey, settings.defaultThreadId);
  } else {
    localStorage.removeItem(browserDefaultThreadKey);
  }
  if (settings.sidebarWidth) {
    localStorage.setItem(
      browserSidebarWidthKey,
      String(settings.sidebarWidth),
    );
  }
  if (settings.maxVisibleActionsPerGroup) {
    localStorage.setItem(
      browserMaxVisibleActionsKey,
      String(settings.maxVisibleActionsPerGroup),
    );
  }
  if (settings.showReasoningItems !== undefined) {
    localStorage.setItem(
      browserShowReasoningKey,
      String(settings.showReasoningItems),
    );
  }
  if (settings.keepActionGroupsCollapsed !== undefined) {
    localStorage.setItem(
      browserKeepActionsCollapsedKey,
      String(settings.keepActionGroupsCollapsed),
    );
  }
  if (settings.adultModeEnabled !== undefined) {
    localStorage.setItem(browserAdultModeKey, String(settings.adultModeEnabled));
  }
  if (settings.adultModeCredential) {
    localStorage.setItem(browserAdultModeCredentialKey, JSON.stringify(settings.adultModeCredential));
  }
}

function validatePatch(patch: DesktopSettingsPatch) {
  if (patch.adultModeCredential !== undefined &&
    (patch.adultModeCredential.algorithm !== "PBKDF2-SHA-256" ||
      patch.adultModeCredential.iterations < 100_000 ||
      !patch.adultModeCredential.hash || !patch.adultModeCredential.salt)) {
    throw new Error("Unsupported Adult Mode credential");
  }
  if (patch.locale && patch.locale !== "fr" && patch.locale !== "en") {
    throw new Error("Unsupported desktop locale");
  }
  if (patch.lastWorkspace && patch.lastWorkspace.length > 32_768) {
    throw new Error("Desktop workspace path is too long");
  }
  if (
    patch.theme &&
    patch.theme !== "system" &&
    patch.theme !== "dark" &&
    patch.theme !== "light"
  ) {
    throw new Error("Unsupported desktop theme");
  }
  if (
    patch.fontSize &&
    patch.fontSize !== "small" &&
    patch.fontSize !== "default" &&
    patch.fontSize !== "large"
  ) {
    throw new Error("Unsupported desktop font size");
  }
  if (
    patch.interfaceScale !== undefined &&
    (!Number.isFinite(patch.interfaceScale) ||
      patch.interfaceScale < 0.8 ||
      patch.interfaceScale > 1.5)
  ) {
    throw new Error("Unsupported interface scale");
  }
  if (patch.realtimeVoice && !isRealtimeVoice(patch.realtimeVoice)) {
    throw new Error("Unsupported realtime voice");
  }
  if (
    patch.realtimeVoiceInstructions !== undefined &&
    (typeof patch.realtimeVoiceInstructions !== "string" ||
      patch.realtimeVoiceInstructions.length > 32_768)
  ) {
    throw new Error("Unsupported realtime voice instructions");
  }
  if (
    patch.defaultThreadId !== undefined &&
    (typeof patch.defaultThreadId !== "string" ||
      patch.defaultThreadId.length === 0 ||
      patch.defaultThreadId.length > 1_024)
  ) {
    throw new Error("Unsupported default thread");
  }
  if (
    patch.realtimeParentThreadIds !== undefined &&
    (!Array.isArray(patch.realtimeParentThreadIds) ||
      patch.realtimeParentThreadIds.length > 100 ||
      patch.realtimeParentThreadIds.some(
        (id) => typeof id !== "string" || id.length === 0 || id.length > 1_024,
      ))
  ) {
    throw new Error("Unsupported realtime parent threads");
  }
  if (
    patch.sidebarWidth !== undefined &&
    (!Number.isInteger(patch.sidebarWidth) ||
      patch.sidebarWidth < 220 ||
      patch.sidebarWidth > 420)
  ) {
    throw new Error("Unsupported sidebar width");
  }
  if (
    patch.maxVisibleActionsPerGroup !== undefined &&
    (!Number.isInteger(patch.maxVisibleActionsPerGroup) ||
      patch.maxVisibleActionsPerGroup < 1 ||
      patch.maxVisibleActionsPerGroup > 6)
  ) {
    throw new Error("Unsupported visible actions limit");
  }
  for (const value of [
    patch.showReasoningItems,
    patch.keepActionGroupsCollapsed,
    patch.adultModeEnabled,
  ]) {
    if (value !== undefined && typeof value !== "boolean") {
      throw new Error("Unsupported boolean desktop preference");
    }
  }
}

function parseBrowserBoolean<K extends keyof DesktopSettings>(
  key: K,
  value: string | null,
): Pick<DesktopSettings, K> | Record<never, never> {
  if (value !== "true" && value !== "false") return {};
  return { [key]: value === "true" } as Pick<DesktopSettings, K>;
}

function parseBrowserMaxVisibleActions(
  value: string | null,
): Pick<DesktopSettings, "maxVisibleActionsPerGroup"> {
  if (!value) return {};
  const maxVisibleActionsPerGroup = Number(value);
  return Number.isInteger(maxVisibleActionsPerGroup) &&
    maxVisibleActionsPerGroup >= 1 &&
    maxVisibleActionsPerGroup <= 6
    ? { maxVisibleActionsPerGroup }
    : {};
}

function parseBrowserSidebarWidth(
  value: string | null,
): Pick<DesktopSettings, "sidebarWidth"> {
  if (!value) return {};
  const sidebarWidth = Number(value);
  return Number.isInteger(sidebarWidth) &&
    sidebarWidth >= 220 &&
    sidebarWidth <= 420
    ? { sidebarWidth }
    : {};
}

function parseBrowserAppearance(
  value: string | null,
): Pick<DesktopSettings, "theme" | "fontSize" | "interfaceScale"> {
  if (!value) return {};
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    const theme = candidate.theme;
    const fontSize = candidate.fontSize;
    const interfaceScale = candidate.interfaceScale;
    return {
      ...(theme === "system" || theme === "dark" || theme === "light"
        ? { theme }
        : {}),
      ...(fontSize === "small" ||
      fontSize === "default" ||
      fontSize === "large"
        ? { fontSize }
        : {}),
      ...(typeof interfaceScale === "number" &&
      Number.isFinite(interfaceScale) &&
      interfaceScale >= 0.8 &&
      interfaceScale <= 1.5
        ? { interfaceScale }
        : {}),
    };
  } catch {
    return {};
  }
}

function isNative() {
  return isDesktopApp();
}
