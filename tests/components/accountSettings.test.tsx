// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "../../src/components/AccountSettings";

afterEach(cleanup);

describe("réglages du compte", () => {
  it("présente l’identité et les métriques disponibles", () => {
    render(
      <AccountSettings
        controller={{
          account: {
            account: {
              type: "chatgpt",
              email: "dev@example.com",
              planType: "prolite",
            },
            requiresOpenaiAuth: true,
          },
          usage: {
            summary: {
              lifetimeTokens: 12500,
              peakDailyTokens: 4000,
              longestRunningTurnSec: 120,
              currentStreakDays: 3,
              longestStreakDays: 8,
            },
            dailyUsageBuckets: [{ startDate: "2026-07-19", tokens: 4000 }],
          },
          loading: false,
          refresh: vi.fn(),
          workspaceMessages: null,
        }}
        rateLimits={{
          consumeReset: vi.fn(),
          consuming: false,
          loading: false,
          nudging: false,
          quotas: [],
          reachedType: null,
          refresh: vi.fn(),
          resetCredits: null,
          sendOwnerNudge: vi.fn(),
        }}
      />,
    );
    expect(screen.getByText("d•••@example.com")).toBeVisible();
    expect(screen.queryByText("dev@example.com")).toBeNull();
    expect(screen.getByText("Pro")).toBeVisible();
    expect(screen.getByText("12,5 k")).toBeVisible();
    expect(screen.getByLabelText("Utilisation quotidienne")).toBeVisible();
  });

  it("confirme explicitement la consommation d’un ticket", () => {
    const consumeReset = vi.fn();
    render(
      <AccountSettings
        controller={{
          account: null,
          usage: null,
          loading: false,
          refresh: vi.fn(),
          workspaceMessages: null,
        }}
        rateLimits={{
          consumeReset,
          consuming: false,
          loading: false,
          nudging: false,
          quotas: [],
          reachedType: null,
          refresh: vi.fn(),
          resetCredits: {
            availableCount: 2,
            credits: [
              {
                id: "credit-1",
                resetType: "codexRateLimits",
                status: "available",
                grantedAt: 1,
                expiresAt: null,
                title: "Reset complet",
                description: null,
              },
            ],
          },
          sendOwnerNudge: vi.fn(),
        }}
      />,
    );
    expect(screen.getByText(/2 tickets disponibles/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser les quotas" }),
    );
    expect(consumeReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(consumeReset).toHaveBeenCalledWith("credit-1");
  });

  it("affiche les messages globaux et propose l’alerte propriétaire à bon escient", () => {
    const sendOwnerNudge = vi.fn();
    render(
      <AccountSettings
        controller={{
          account: null,
          usage: null,
          workspaceMessages: {
            featureEnabled: true,
            messages: [
              {
                messageId: "notice-1",
                messageType: "headline",
                messageBody: "Maintenance prévue à 17 h.",
                createdAt: null,
                archivedAt: null,
              },
            ],
          },
          loading: false,
          refresh: vi.fn(),
        }}
        rateLimits={{
          consumeReset: vi.fn(),
          consuming: false,
          loading: false,
          nudging: false,
          quotas: [],
          reachedType: "workspace_member_credits_depleted",
          refresh: vi.fn(),
          resetCredits: null,
          sendOwnerNudge,
        }}
      />,
    );
    expect(screen.getByText("Maintenance prévue à 17 h.")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Prévenir le propriétaire" }),
    );
    expect(sendOwnerNudge).toHaveBeenCalledOnce();
  });
});
