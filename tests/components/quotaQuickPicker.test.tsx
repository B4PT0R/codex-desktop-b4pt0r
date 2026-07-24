// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuotaQuickPicker } from "../../src/components/QuotaQuickPicker";
import { I18nProvider } from "../../src/i18n/I18nProvider";

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("détails rapides des quotas", () => {
  it("affiche les réinitialisations et confirme la consommation d'un ticket", () => {
    const consumeReset = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <QuotaQuickPicker
          consuming={false}
          onConsumeReset={consumeReset}
          quotas={[
            { durationMinutes: 300, used: 34, resetsAt: 1_800_000_000 },
            { durationMinutes: 10_080, used: 14, resetsAt: 1_800_100_000 },
          ]}
          resetCredits={{
            availableCount: 1,
            credits: [
              {
                id: "credit-1",
                resetType: "codexRateLimits",
                status: "available",
                grantedAt: 1_700_000_000,
                expiresAt: 1_900_000_000,
                title: null,
                description: null,
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /5 h.*66 %/ }));
    expect(
      screen.getByRole("dialog", { name: "Quotas d’utilisation" }),
    ).toBeVisible();
    expect(screen.getAllByText(/Réinitialisation le/)).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser les quotas" }),
    );
    expect(consumeReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(consumeReset).toHaveBeenCalledWith("credit-1");
  });
});
