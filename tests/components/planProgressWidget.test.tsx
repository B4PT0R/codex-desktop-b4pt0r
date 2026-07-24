// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanProgressWidget } from "../../src/components/PlanProgressWidget";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { AgentSignal } from "../../src/types";

const runningPlan: AgentSignal = {
  id: "plan-turn-1",
  kind: "plan",
  title: "Plan",
  status: "running",
  steps: [
    { step: "Inspecter", status: "completed" },
    { step: "Implémenter", status: "inProgress" },
  ],
};

beforeEach(() => {
  localStorage.setItem("codex-desktop.locale", "fr");
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("plan persistant", () => {
  it("se met à jour puis disparaît après la fin", () => {
    const { rerender } = render(
      <I18nProvider>
        <PlanProgressWidget plan={runningPlan} />
      </I18nProvider>,
    );
    expect(
      screen.getByRole("complementary", { name: "Progression du plan" }),
    ).toBeVisible();
    expect(screen.getByText("1 sur 2 étapes terminées")).toBeVisible();

    const completePlan: AgentSignal = {
      ...runningPlan,
      status: "done",
      steps: runningPlan.steps?.map((step) => ({
        ...step,
        status: "completed",
      })),
    };
    rerender(
      <I18nProvider>
        <PlanProgressWidget plan={completePlan} />
      </I18nProvider>,
    );
    expect(screen.getByText("Plan terminé")).toBeVisible();
    expect(screen.getByRole("complementary")).toHaveClass("plan-done");

    act(() => vi.advanceTimersByTime(1_400));
    expect(screen.getByRole("complementary")).toHaveClass(
      "exiting",
      "plan-done",
    );
    expect(screen.queryByText("Inspecter")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(450));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("n’affiche pas un ancien plan déjà terminé au chargement", () => {
    render(
      <I18nProvider>
        <PlanProgressWidget plan={{ ...runningPlan, status: "done" }} />
      </I18nProvider>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
