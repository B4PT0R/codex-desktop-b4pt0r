// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitResetCard } from "../../src/components/RateLimitResetCard";
import { WorkspaceMessages } from "../../src/components/WorkspaceMessages";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { RateLimitsController } from "../../src/lib/useRateLimits";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("surfaces de limites d’utilisation", () => {
  it("localise les tickets et messages d’espace en anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    const controller: RateLimitsController = {
      consumeReset: vi.fn(),
      consuming: false,
      loading: false,
      nudging: false,
      quotas: [],
      reachedType: "workspace_member_credits_depleted",
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
            title: "Reset",
            description: null,
          },
        ],
      },
      sendOwnerNudge: vi.fn(),
    };

    render(
      <I18nProvider>
        <RateLimitResetCard controller={controller} />
        <WorkspaceMessages messages={null} rateLimits={controller} />
      </I18nProvider>,
    );

    expect(screen.getByText("Reset credits")).toBeVisible();
    expect(screen.getByText(/2 credits available/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset limits" })).toBeVisible();
    expect(screen.getByText("Workspace credits depleted")).toBeVisible();
    expect(screen.getByRole("button", { name: "Notify owner" })).toBeVisible();
  });
});
