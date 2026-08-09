import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";

export const SETTINGS_VERSION = 1;
const updateQueues = new Map();
const writableSettings = new Set([
  "automations",
  "adultModeEnabled",
  "adultModeCredential",
  "defaultThreadId",
  "fontSize",
  "interfaceScale",
  "keepActionGroupsCollapsed",
  "lastWorkspace",
  "locale",
  "maxVisibleActionsPerGroup",
  "realtimeVoice",
  "showReasoningItems",
  "sharedBrowserEnabled",
  "sidebarWidth",
  "theme",
]);

export function settingsPath(home) {
  return path.join(home, ".codex", "codex-desktop-linux.json");
}

export async function readSettings(file) {
  try {
    const value = JSON.parse(await readFile(file, "utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new Error("desktop settings must contain a JSON object");
    }
    return { ...value, version: value.version || SETTINGS_VERSION };
  } catch (error) {
    if (error.code === "ENOENT") return { version: SETTINGS_VERSION };
    throw error;
  }
}

export async function updateSettings(file, patch) {
  validatePatch(patch);
  const previous = updateQueues.get(file) ?? Promise.resolve();
  const update = previous
    .catch(() => undefined)
    .then(() => updateSettingsNow(file, patch));
  updateQueues.set(file, update);
  return update.finally(() => {
    if (updateQueues.get(file) === update) updateQueues.delete(file);
  });
}

async function updateSettingsNow(file, patch) {
  const current = await readSettings(file);
  const document = {
    ...current,
    ...patch,
    version: SETTINGS_VERSION,
  };
  if (JSON.stringify(document) === JSON.stringify(current)) return current;
  await writeFileAtomically(file, `${JSON.stringify(document, null, 2)}\n`, {
    createDirectory: true,
    mode: 0o600,
  });
  return document;
}

function validatePatch(patch) {
  if (!patch || Array.isArray(patch) || typeof patch !== "object") {
    throw new Error("Invalid desktop settings patch");
  }
  if (Object.keys(patch).some((key) => !writableSettings.has(key))) {
    throw new Error("Unsupported desktop settings key");
  }
  if (
    Object.hasOwn(patch, "locale") &&
    !["fr", "en"].includes(patch.locale)
  ) {
    throw new Error("Unsupported desktop locale");
  }
  if (
    Object.hasOwn(patch, "lastWorkspace") &&
    (typeof patch.lastWorkspace !== "string" ||
      patch.lastWorkspace.length === 0 ||
      patch.lastWorkspace.length > 32_768)
  ) {
    throw new Error("Unsupported desktop workspace path");
  }
  if (
    Object.hasOwn(patch, "theme") &&
    !["system", "dark", "light"].includes(patch.theme)
  ) {
    throw new Error("Unsupported desktop theme");
  }
  if (
    Object.hasOwn(patch, "fontSize") &&
    !["small", "default", "large"].includes(patch.fontSize)
  ) {
    throw new Error("Unsupported desktop font size");
  }
  if (
    Object.hasOwn(patch, "interfaceScale") &&
    (!Number.isFinite(patch.interfaceScale) ||
      patch.interfaceScale < 0.8 ||
      patch.interfaceScale > 1.5)
  ) {
    throw new Error("Unsupported interface scale");
  }
  if (
    Object.hasOwn(patch, "sidebarWidth") &&
    (!Number.isInteger(patch.sidebarWidth) ||
      patch.sidebarWidth < 220 ||
      patch.sidebarWidth > 420)
  ) {
    throw new Error("Unsupported sidebar width");
  }
  if (
    Object.hasOwn(patch, "maxVisibleActionsPerGroup") &&
    (!Number.isInteger(patch.maxVisibleActionsPerGroup) ||
      patch.maxVisibleActionsPerGroup < 1 ||
      patch.maxVisibleActionsPerGroup > 6)
  ) {
    throw new Error("Unsupported visible actions limit");
  }
  for (const key of [
    "showReasoningItems",
    "keepActionGroupsCollapsed",
    "adultModeEnabled",
  ]) {
    if (Object.hasOwn(patch, key) && typeof patch[key] !== "boolean") {
      throw new Error("Unsupported boolean desktop preference");
    }
  }
  if (Object.hasOwn(patch, "adultModeCredential")) {
    const credential = patch.adultModeCredential;
    if (!credential || credential.algorithm !== "PBKDF2-SHA-256" ||
      typeof credential.hash !== "string" || typeof credential.salt !== "string" ||
      !Number.isInteger(credential.iterations) || credential.iterations < 100_000) {
      throw new Error("Unsupported Adult Mode credential");
    }
  }
  if (
    Object.hasOwn(patch, "sharedBrowserEnabled") &&
    typeof patch.sharedBrowserEnabled !== "boolean"
  ) {
    throw new Error("Unsupported shared browser setting");
  }
  if (
    Object.hasOwn(patch, "realtimeVoice") &&
    (typeof patch.realtimeVoice !== "string" ||
      patch.realtimeVoice.length === 0 ||
      patch.realtimeVoice.length > 64)
  ) {
    throw new Error("Unsupported realtime voice");
  }
  if (
    Object.hasOwn(patch, "defaultThreadId") &&
    patch.defaultThreadId !== undefined &&
    (typeof patch.defaultThreadId !== "string" ||
      patch.defaultThreadId.length === 0 ||
      patch.defaultThreadId.length > 1_024)
  ) {
    throw new Error("Unsupported default thread");
  }
  if (
    Object.hasOwn(patch, "automations") &&
    (!Array.isArray(patch.automations) ||
      patch.automations.length > 100 ||
      JSON.stringify(patch.automations).length > 2_000_000)
  ) {
    throw new Error("Unsupported scheduled tasks setting");
  }
}
