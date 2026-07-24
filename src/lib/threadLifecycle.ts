import type { ThreadStatus } from "../types";

export function threadStatusFromValue(
  value: unknown,
): ThreadStatus | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const type = (value as Record<string, unknown>).type;
  return type === "notLoaded" ||
    type === "idle" ||
    type === "active" ||
    type === "systemError"
    ? type
    : undefined;
}
