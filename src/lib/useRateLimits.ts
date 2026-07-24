import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AccountRateLimitsResponse,
  ConsumeRateLimitResetCreditResponse,
  RateLimitSnapshot,
  RateLimitResetCreditsSummary,
  SendCreditsNudgeResponse,
} from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import { quotasFromRateLimits } from "./protocol";
import { consumeRateLimitResetCreditParams } from "./protocol";
import { creditsNudgeParams } from "./protocol";
import type { Quota } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";

export type RateLimitsController = {
  consumeReset: (creditId?: string) => Promise<void>;
  consuming: boolean;
  error?: string;
  loading: boolean;
  nudgeMessage?: string;
  nudging: boolean;
  quotas: Quota[];
  reachedType: RateLimitSnapshot["rateLimitReachedType"];
  resetCredits: RateLimitResetCreditsSummary | null;
  resetMessage?: string;
  refresh: () => Promise<void>;
  sendOwnerNudge: () => Promise<void>;
};

export function useRateLimits(enabled: boolean): RateLimitsController {
  const { t } = useI18n();
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [resetCredits, setResetCredits] =
    useState<RateLimitResetCreditsSummary | null>(null);
  const [consuming, setConsuming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string>();
  const [reachedType, setReachedType] =
    useState<RateLimitSnapshot["rateLimitReachedType"]>();
  const [error, setError] = useState<string>();
  const [resetMessage, setResetMessage] = useState<string>();
  const refreshVersion = useRef(0);
  const consumeInFlight = useRef(false);
  const nudgeInFlight = useRef(false);
  const pendingAttempt = useRef<
    | {
        creditId?: string;
        idempotencyKey: string;
      }
    | undefined
  >(undefined);

  const apply = useCallback((snapshot: RateLimitSnapshot | undefined) => {
    setQuotas(quotasFromRateLimits(snapshot));
    setReachedType(snapshot?.rateLimitReachedType);
  }, []);

  const refresh = useCallback(async () => {
    if (!isDesktopApp()) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const response = await request<AccountRateLimitsResponse>(
        "account/rateLimits/read",
      );
      if (refreshVersion.current === version) {
        apply(response.rateLimits);
        setResetCredits(response.rateLimitResetCredits ?? null);
        setError(undefined);
      }
    } catch (cause) {
      if (refreshVersion.current === version)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (refreshVersion.current === version) setLoading(false);
    }
  }, [apply]);

  const consumeReset = useCallback(
    async (creditId?: string) => {
      if (consumeInFlight.current) return;
      consumeInFlight.current = true;
      const previousAttempt = pendingAttempt.current;
      const attempt =
        previousAttempt && previousAttempt.creditId === creditId
          ? previousAttempt
          : { creditId, idempotencyKey: crypto.randomUUID() };
      pendingAttempt.current = attempt;
      setConsuming(true);
      setError(undefined);
      setResetMessage(undefined);
      try {
        const response = await request<ConsumeRateLimitResetCreditResponse>(
          "account/rateLimitResetCredit/consume",
          consumeRateLimitResetCreditParams(attempt.idempotencyKey, creditId),
        );
        pendingAttempt.current = undefined;
        setResetMessage(resetOutcomeLabel(response.outcome, t));
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        consumeInFlight.current = false;
        setConsuming(false);
      }
    },
    [refresh, t],
  );

  const sendOwnerNudge = useCallback(async () => {
    const creditType = nudgeCreditType(reachedType);
    if (!creditType || nudgeInFlight.current) return;
    nudgeInFlight.current = true;
    setNudging(true);
    setError(undefined);
    try {
      const response = await request<SendCreditsNudgeResponse>(
        "account/sendAddCreditsNudgeEmail",
        creditsNudgeParams(creditType),
      );
      setNudgeMessage(
        response.status === "sent"
          ? t("workspaceMessages.sent")
          : t("workspaceMessages.cooldown"),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      nudgeInFlight.current = false;
      setNudging(false);
    }
  }, [reachedType, t]);

  useEffect(() => {
    if (enabled) {
      void refresh();
      return;
    }
    refreshVersion.current += 1;
    setLoading(false);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeAppServerMessages((message) => {
      if (message.method !== "account/rateLimits/updated") return;
      refreshVersion.current += 1;
      setLoading(false);
      const params = record(message.params);
      const snapshot = record(params?.rateLimits) as
        RateLimitSnapshot | undefined;
      apply(snapshot);
    });
  }, [apply, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const delay = millisecondsUntilQuotaRefresh(quotas, Date.now());
    if (delay === undefined) return;
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [enabled, quotas, refresh]);

  return {
    consumeReset,
    consuming,
    error,
    loading,
    nudgeMessage,
    nudging,
    quotas,
    reachedType,
    refresh,
    resetCredits,
    resetMessage,
    sendOwnerNudge,
  };
}

export function nudgeCreditType(
  reachedType: RateLimitSnapshot["rateLimitReachedType"],
): "credits" | "usage_limit" | undefined {
  if (reachedType?.endsWith("credits_depleted")) return "credits";
  if (reachedType?.endsWith("usage_limit_reached")) return "usage_limit";
  return undefined;
}

export function millisecondsUntilQuotaRefresh(
  quotas: Quota[],
  now: number,
): number | undefined {
  const futureResets = quotas
    .flatMap((quota) => (quota.resetsAt ? [quota.resetsAt * 1000] : []))
    .filter((reset) => reset > now);
  if (futureResets.length === 0) return undefined;
  return Math.min(...futureResets) - now + 1_000;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function resetOutcomeLabel(
  outcome: ConsumeRateLimitResetCreditResponse["outcome"],
  t: Translate,
) {
  if (outcome === "reset" || outcome === "alreadyRedeemed") {
    return t("reset.outcome.reset");
  }
  if (outcome === "nothingToReset") {
    return t("reset.outcome.nothing");
  }
  return t("reset.outcome.unavailable");
}
