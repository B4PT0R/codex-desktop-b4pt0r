// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import {
  millisecondsUntilQuotaRefresh,
  nudgeCreditType,
  useRateLimits,
} from "../../src/lib/useRateLimits";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
});

afterEach(() => vi.useRealTimers());

describe("limites d’utilisation", () => {
  it("n’autorise l’alerte propriétaire que pour un blocage de l’espace", () => {
    expect(nudgeCreditType("workspace_member_credits_depleted")).toBe(
      "credits",
    );
    expect(nudgeCreditType("workspace_owner_usage_limit_reached")).toBe(
      "usage_limit",
    );
    expect(nudgeCreditType("rate_limit_reached")).toBeUndefined();
  });
  it("attend la connexion App Server avant la première lecture", async () => {
    const { rerender } = renderHook(({ enabled }) => useRateLimits(enabled), {
      initialProps: { enabled: false },
    });
    expect(requestMock).not.toHaveBeenCalled();
    requestMock.mockResolvedValue({
      rateLimits: {},
      rateLimitResetCredits: null,
    });
    rerender({ enabled: true });
    await act(async () => Promise.resolve());
    expect(requestMock).toHaveBeenCalledWith("account/rateLimits/read");
  });

  it("programme une relecture une seconde après le prochain reset", () => {
    expect(
      millisecondsUntilQuotaRefresh(
        [
          { used: 20, durationMinutes: 300, resetsAt: 15 },
          { used: 30, durationMinutes: 10_080, resetsAt: 30 },
        ],
        10_000,
      ),
    ).toBe(6_000);
    expect(
      millisecondsUntilQuotaRefresh(
        [{ used: 20, durationMinutes: 300, resetsAt: 5 }],
        10_000,
      ),
    ).toBeUndefined();
  });

  it("fusionne les notifications et relit les limites après leur reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    requestMock.mockResolvedValue({
      rateLimits: {
        primary: {
          usedPercent: 20,
          windowDurationMins: 300,
          resetsAt: 15,
        },
      },
    });
    const { result } = renderHook(() => useRateLimits(true));
    await act(async () => Promise.resolve());
    expect(result.current.quotas[0]).toMatchObject({ used: 20, resetsAt: 15 });

    await act(async () => {
      vi.advanceTimersByTime(6_000);
      await Promise.resolve();
    });
    expect(requestMock).toHaveBeenCalledTimes(2);

    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "account/rateLimits/updated",
        params: {
          rateLimits: {
            primary: {
              usedPercent: 4,
              windowDurationMins: 300,
              resetsAt: 40,
            },
          },
        },
      }),
    );
    expect(result.current.quotas[0]).toMatchObject({ used: 4, resetsAt: 40 });
  });

  it("ne laisse pas une lecture obsolète écraser une notification récente", async () => {
    const read = deferred<{
      rateLimits: { primary: { usedPercent: number } };
      rateLimitResetCredits: null;
    }>();
    requestMock.mockReturnValueOnce(read.promise);
    const { result } = renderHook(() => useRateLimits(true));
    await act(async () => Promise.resolve());

    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "account/rateLimits/updated",
        params: { rateLimits: { primary: { usedPercent: 4 } } },
      }),
    );
    read.resolve({
      rateLimits: { primary: { usedPercent: 80 } },
      rateLimitResetCredits: null,
    });
    await act(async () => read.promise);

    expect(result.current.quotas[0]).toMatchObject({ used: 4 });
  });

  it("réutilise la clé idempotente après un échec puis rafraîchit", async () => {
    let attempts = 0;
    requestMock.mockImplementation((method: string) => {
      if (method === "account/rateLimits/read") {
        return Promise.resolve({ rateLimits: {}, rateLimitResetCredits: null });
      }
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("Réseau indisponible"))
        : Promise.resolve({ outcome: "reset" });
    });
    const { result } = renderHook(() => useRateLimits(true));
    await act(async () => Promise.resolve());

    await act(async () => result.current.consumeReset("credit-1"));
    expect(result.current.error).toBe("Réseau indisponible");
    const firstParams = requestMock.mock.calls.find(
      ([method]) => method === "account/rateLimitResetCredit/consume",
    )?.[1];

    await act(async () => result.current.consumeReset("credit-1"));
    const consumeCalls = requestMock.mock.calls.filter(
      ([method]) => method === "account/rateLimitResetCredit/consume",
    );
    expect(consumeCalls[1][1]).toEqual(firstParams);
    expect(result.current.resetMessage).toMatch(/ont été réinitialisés/);
    expect(requestMock.mock.calls.at(-1)?.[0]).toBe("account/rateLimits/read");
  });

  it("prévient le propriétaire avec le type imposé par le backend", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "account/rateLimits/read"
          ? {
              rateLimits: {
                rateLimitReachedType: "workspace_member_usage_limit_reached",
              },
              rateLimitResetCredits: null,
            }
          : { status: "sent" },
      ),
    );
    const { result } = renderHook(() => useRateLimits(true));
    await act(async () => Promise.resolve());
    await act(async () => result.current.sendOwnerNudge());
    expect(requestMock).toHaveBeenCalledWith(
      "account/sendAddCreditsNudgeEmail",
      { creditType: "usage_limit" },
    );
    expect(result.current.nudgeMessage).toMatch(/prévenu par e-mail/);
  });
});
