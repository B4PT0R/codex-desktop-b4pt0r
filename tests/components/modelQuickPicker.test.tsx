// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQuickPicker } from "../../src/components/ModelQuickPicker";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { Model } from "../../src/types";

const models: Model[] = [
  {
    id: "model-a",
    label: "Model A",
    supportedReasoningEfforts: [
      { reasoningEffort: "low", description: "" },
      { reasoningEffort: "high", description: "" },
    ],
    serviceTiers: [
      { id: "fast", name: "Rapide", description: "Prioritaire" },
    ],
  },
  {
    id: "model-b",
    label: "Model B",
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: [
      { reasoningEffort: "high", description: "" },
    ],
  },
];

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("sélecteur rapide de modèle", () => {
  it("change modèle et cadence sans quitter la conversation", () => {
    const onChangeEffort = vi.fn();
    const onChangeModel = vi.fn();
    render(
      <I18nProvider>
        <ModelQuickPicker
          collaborationMode="default"
          effort="low"
          model="model-a"
          models={models}
          serviceTier={null}
          onChangeEffort={onChangeEffort}
          onChangeCollaborationMode={vi.fn().mockResolvedValue(true)}
          onChangeModel={onChangeModel}
          onChangeServiceTier={vi.fn().mockResolvedValue(true)}
        />
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: /Model A/ });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", {
        name: "Choisir le modèle et le raisonnement",
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("option", { name: /Model B/ }));
    expect(onChangeModel).toHaveBeenCalledWith("model-b");
    expect(onChangeEffort).toHaveBeenCalledWith("high");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("regroupe le mode Plan avec les réglages du modèle", () => {
    const onChangeCollaborationMode = vi.fn().mockResolvedValue(true);
    render(
      <I18nProvider>
        <ModelQuickPicker
          collaborationMode="default"
          effort="low"
          model="model-a"
          models={models}
          serviceTier={null}
          onChangeCollaborationMode={onChangeCollaborationMode}
          onChangeEffort={vi.fn()}
          onChangeModel={vi.fn()}
          onChangeServiceTier={vi.fn().mockResolvedValue(true)}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Model A/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mode Plan" }));
    expect(onChangeCollaborationMode).toHaveBeenCalledWith("plan");
  });

  it("sélectionne un tier de service annoncé par le modèle", () => {
    const onChangeServiceTier = vi.fn().mockResolvedValue(true);
    render(
      <I18nProvider>
        <ModelQuickPicker
          collaborationMode="default"
          effort="low"
          model="model-a"
          models={models}
          serviceTier={null}
          onChangeCollaborationMode={vi.fn().mockResolvedValue(true)}
          onChangeEffort={vi.fn()}
          onChangeModel={vi.fn()}
          onChangeServiceTier={onChangeServiceTier}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Model A/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Rapide" }));
    expect(onChangeServiceTier).toHaveBeenCalledWith("fast");
  });
});
