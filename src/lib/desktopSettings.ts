import { invoke } from "@tauri-apps/api/core";

export type DesktopSettings = {
  version: number;
  locale?: "fr" | "en";
  lastWorkspace?: string;
  theme?: "system" | "dark" | "light";
  fontSize?: "small" | "default" | "large";
};

export type DesktopSettingsPatch = Partial<
  Pick<DesktopSettings, "locale" | "lastWorkspace" | "theme" | "fontSize">
>;

const legacyLocaleKey = "codex-desktop.locale";
const legacyWorkspaceKey = "codex-desktop.cwd";
const browserAppearanceKey = "codex-desktop.appearance";
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
  return {
    version: 1,
    ...(locale === "fr" || locale === "en" ? { locale } : {}),
    ...(lastWorkspace ? { lastWorkspace } : {}),
    ...appearance,
  };
}

function writeBrowserSettings(settings: DesktopSettings) {
  if (settings.locale) localStorage.setItem(legacyLocaleKey, settings.locale);
  if (settings.lastWorkspace) {
    localStorage.setItem(legacyWorkspaceKey, settings.lastWorkspace);
  }
  localStorage.setItem(
    browserAppearanceKey,
    JSON.stringify({ theme: settings.theme, fontSize: settings.fontSize }),
  );
}

function validatePatch(patch: DesktopSettingsPatch) {
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
}

function parseBrowserAppearance(
  value: string | null,
): Pick<DesktopSettings, "theme" | "fontSize"> {
  if (!value) return {};
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    const theme = candidate.theme;
    const fontSize = candidate.fontSize;
    return {
      ...(theme === "system" || theme === "dark" || theme === "light"
        ? { theme }
        : {}),
      ...(fontSize === "small" ||
      fontSize === "default" ||
      fontSize === "large"
        ? { fontSize }
        : {}),
    };
  } catch {
    return {};
  }
}

function isNative() {
  return "__TAURI_INTERNALS__" in window;
}
