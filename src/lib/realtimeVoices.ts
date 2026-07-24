import {
  realtimeVoices,
  type RealtimeVoice,
  type RealtimeVoicesList,
} from "./appServerTypes";

const knownVoices = new Set<string>(realtimeVoices);

export const fallbackRealtimeVoices: RealtimeVoicesList = {
  v1: [
    "juniper",
    "maple",
    "spruce",
    "ember",
    "vale",
    "breeze",
    "arbor",
    "sol",
    "cove",
  ],
  v2: [
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "marin",
    "sage",
    "shimmer",
    "verse",
  ],
  defaultV1: "juniper",
  defaultV2: "marin",
};

export function normalizeRealtimeVoices(value: unknown): RealtimeVoicesList {
  const record = asRecord(value);
  const v1 = voiceArray(record?.v1);
  const v2 = voiceArray(record?.v2);
  return {
    v1: v1.length ? v1 : fallbackRealtimeVoices.v1,
    v2: v2.length ? v2 : fallbackRealtimeVoices.v2,
    defaultV1: voice(record?.defaultV1) ?? fallbackRealtimeVoices.defaultV1,
    defaultV2: voice(record?.defaultV2) ?? fallbackRealtimeVoices.defaultV2,
  };
}

export function isRealtimeVoice(value: unknown): value is RealtimeVoice {
  return typeof value === "string" && knownVoices.has(value);
}

export function realtimeVoiceLabel(value: RealtimeVoice) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function voiceArray(value: unknown): RealtimeVoice[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 32).flatMap((item) => {
    const normalized = voice(item);
    return normalized ? [normalized] : [];
  }))];
}

function voice(value: unknown): RealtimeVoice | undefined {
  return isRealtimeVoice(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
