// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../src/i18n/I18nProvider";

const save = vi.hoisted(() => vi.fn());
const clear = vi.hoisted(() => vi.fn());
const setPaused = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/useThreadGoal", () => ({
  useThreadGoal: () => ({
    clear,
    error: undefined,
    goal: {
      threadId: "thread-1",
      objective: "Livrer une interface stable",
      status: "active",
      tokenBudget: 50_000,
      tokensUsed: 12_500,
      timeUsedSeconds: 3_600,
      createdAt: 1,
      updatedAt: 2,
    },
    loading: false,
    refresh: vi.fn(),
    save,
    saving: false,
    setPaused,
  }),
}));

import { ThreadGoalButton } from "../../src/components/ThreadGoalButton";

beforeEach(() => {
  localStorage.setItem("codex-desktop.locale", "fr");
  save.mockReset().mockResolvedValue(true);
  clear.mockReset().mockResolvedValue(true);
  setPaused.mockReset().mockResolvedValue(true);
});
afterEach(cleanup);

describe("objectif autonome", () => {
  it("présente la progression et permet édition, pause et suppression gardée", () => {
    render(
      <I18nProvider>
        <ThreadGoalButton connected threadId="thread-1" />
      </I18nProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir l’objectif autonome" }),
    );
    expect(screen.getByDisplayValue("Livrer une interface stable")).toBeVisible();
    expect(screen.getByText(/12.?500 tokens utilisés/)).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveValue(25);

    fireEvent.change(screen.getByLabelText("Objectif"), {
      target: { value: "Livrer puis documenter" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save).toHaveBeenCalledWith("Livrer puis documenter", 50_000);
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    expect(setPaused).toHaveBeenCalledWith(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer l’objectif" }),
    );
    expect(screen.getByText(/Supprimer cet objectif/)).toBeVisible();
    expect(clear).not.toHaveBeenCalled();
  });
});
