import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";

export const SETTINGS_VERSION = 1;
const updateQueues = new Map();

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
  const document = {
    ...(await readSettings(file)),
    ...patch,
    version: SETTINGS_VERSION,
  };
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
  if (patch.locale && !["fr", "en"].includes(patch.locale)) {
    throw new Error("Unsupported desktop locale");
  }
  if (patch.lastWorkspace && patch.lastWorkspace.length > 32_768) {
    throw new Error("Desktop workspace path is too long");
  }
  if (patch.theme && !["system", "dark", "light"].includes(patch.theme)) {
    throw new Error("Unsupported desktop theme");
  }
  if (
    patch.fontSize &&
    !["small", "default", "large"].includes(patch.fontSize)
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
  if (
    patch.sidebarWidth !== undefined &&
    (!Number.isInteger(patch.sidebarWidth) ||
      patch.sidebarWidth < 220 ||
      patch.sidebarWidth > 420)
  ) {
    throw new Error("Unsupported sidebar width");
  }
  if (
    patch.sharedBrowserEnabled !== undefined &&
    typeof patch.sharedBrowserEnabled !== "boolean"
  ) {
    throw new Error("Unsupported shared browser setting");
  }
}
