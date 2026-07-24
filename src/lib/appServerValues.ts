export function appServerRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function appServerString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function realtimeAudioFromValue(value: unknown): {
  data: string;
  sampleRate: number;
  numChannels: number;
} {
  const audio = appServerRecord(value);
  return {
    data: appServerString(audio?.data) ?? "",
    sampleRate:
      typeof audio?.sampleRate === "number" ? audio.sampleRate : 24_000,
    numChannels: typeof audio?.numChannels === "number" ? audio.numChannels : 1,
  };
}
