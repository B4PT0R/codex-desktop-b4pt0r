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
  const data = appServerString(audio?.data);
  const sampleRate = audio?.sampleRate;
  const numChannels = audio?.numChannels;
  return {
    data: data && data.length <= 2_800_000 ? data : "",
    sampleRate:
      typeof sampleRate === "number" &&
      Number.isInteger(sampleRate) &&
      sampleRate >= 8_000 &&
      sampleRate <= 96_000
        ? sampleRate
        : 24_000,
    numChannels: numChannels === 2 ? 2 : 1,
  };
}
