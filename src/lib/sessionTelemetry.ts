export type ContextUsage = {
  usedTokens: number;
  windowTokens: number;
  percentUsed: number;
  totalTokens: number;
  lastOutputTokens: number;
};

export type ModelReroute = {
  fromModel: string;
  toModel: string;
  reason: string;
};

export type ThreadTelemetry = {
  context?: ContextUsage;
  reroute?: ModelReroute;
};

export function contextUsageFromValue(
  value: unknown,
): ContextUsage | undefined {
  const usage = record(value);
  const total = record(usage?.total);
  const last = record(usage?.last);
  const windowTokens = nonNegativeNumber(usage?.modelContextWindow);
  const usedTokens = nonNegativeNumber(last?.totalTokens);
  const totalTokens = nonNegativeNumber(total?.totalTokens);
  if (!windowTokens || usedTokens === undefined || totalTokens === undefined)
    return undefined;
  return {
    usedTokens,
    windowTokens,
    percentUsed: Math.min(100, Math.round((usedTokens / windowTokens) * 100)),
    totalTokens,
    lastOutputTokens: nonNegativeNumber(last?.outputTokens) ?? 0,
  };
}

export function modelRerouteFromValue(
  value: unknown,
): ModelReroute | undefined {
  const params = record(value);
  const fromModel = stringValue(params?.fromModel);
  const toModel = stringValue(params?.toModel);
  const reason = stringValue(params?.reason);
  return fromModel && toModel && reason
    ? { fromModel, toModel, reason }
    : undefined;
}

export function compactTokenCount(tokens: number) {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 1_000_000)
    return `${Math.round(tokens / 100) / 10}`.replace(".", ",") + " k";
  return `${Math.round(tokens / 100_000) / 10}`.replace(".", ",") + " M";
}

export function rerouteReason(reason: string, t: Translate = defaultTranslate) {
  return reason === "highRiskCyberActivity"
    ? t("telemetry.security")
    : t("telemetry.serviceDecision");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function nonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
import { defaultTranslate, type Translate } from "../i18n/translate";
