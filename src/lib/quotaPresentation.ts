export function quotaWindowLabel(
  durationMinutes: number | null,
  fallbackIndex: number,
): string {
  if (durationMinutes == null) return fallbackIndex === 0 ? "5 h" : "7 j";
  if (durationMinutes >= 24 * 60) {
    return `${Math.round(durationMinutes / (24 * 60))} j`;
  }
  return `${Math.round(durationMinutes / 60)} h`;
}
