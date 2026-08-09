import adultModePrompt from "../assets/adult-mode.md?raw";
import { codexDesktopDeveloperInstructions, type ClientVersions } from "./clientContext";
import { readDesktopSettingsSnapshot } from "./desktopSettings";

export async function configuredDeveloperInstructions(
  existing: string | null | undefined,
  versions?: ClientVersions,
) {
  const settings = await readDesktopSettingsSnapshot();
  return codexDesktopDeveloperInstructions(
    existing,
    versions,
    settings.adultModeEnabled ? adultModePrompt : undefined,
  );
}
