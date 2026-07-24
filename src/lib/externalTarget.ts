import { openUrl } from "./nativeBridge";
import { openInChromium } from "./useChromium";

export type ExternalOpenMode = "chromium" | "system";

/** Opens a bounded web target in managed Chromium, falling back to the OS browser. */
export async function openExternalTarget(
  target: string,
): Promise<ExternalOpenMode> {
  const url = safeExternalHttpUrl(target);
  if (!url) throw new Error("Invalid external URL");
  try {
    await openInChromium(url);
    return "chromium";
  } catch {
    await openUrl(url);
    return "system";
  }
}

export function safeExternalHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 32_768) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
