// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalAgentImportSettings } from "../../src/components/ExternalAgentImportSettings";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { ExternalAgentImportController } from "../../src/lib/useExternalAgentImport";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function controller(
  overrides: Partial<ExternalAgentImportController> = {},
): ExternalAgentImportController {
  return {
    items: [],
    histories: [],
    detecting: false,
    historyLoading: false,
    importing: false,
    completed: false,
    results: [],
    detect: vi.fn(),
    importItems: vi.fn(),
    refreshHistory: vi.fn(),
    clearResult: vi.fn(),
    ...overrides,
  };
}

describe("import d’agents externes", () => {
  it("exige sélection et confirmation avant l’import", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    const value = controller({
      items: [
        {
          itemType: "SKILLS",
          description: "Deux skills Claude Code",
          cwd: "/project",
          details: { skills: [{ name: "review" }, { name: "release" }] },
        },
      ],
    });
    render(
      <I18nProvider>
        <ExternalAgentImportSettings controller={value} />
      </I18nProvider>,
    );

    const prepare = screen.getByRole("button", { name: "Préparer l’import" });
    expect(prepare).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("review · release")).toBeVisible();
    fireEvent.click(prepare);
    expect(screen.getByText("Confirmer les modifications")).toBeVisible();
    expect(value.importItems).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    expect(value.importItems).toHaveBeenCalledWith(value.items);
  });

  it("transmet explicitement la source choisie à la détection", () => {
    const value = controller();
    render(
      <I18nProvider>
        <ExternalAgentImportSettings controller={value} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), {
      target: { value: "cursor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Detect" }));
    expect(value.detect).toHaveBeenCalledWith("cursor");
  });

  it("affiche les échecs détaillés et l’historique", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    render(
      <I18nProvider>
        <ExternalAgentImportSettings
          controller={controller({
            completed: true,
            results: [
              {
                itemType: "SESSIONS",
                successes: [],
                failures: [
                  {
                    itemType: "SESSIONS",
                    failureStage: "write",
                    message: "Permission refusée",
                  },
                ],
              },
            ],
            histories: [
              {
                importId: "import-1",
                completedAtMs: 1_750_000_000_000,
                successes: [{ itemType: "CONFIG" }],
                failures: [],
              },
            ],
          })}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("Permission refusée")).toBeVisible();
    expect(screen.getByText("1 réussite(s), 0 échec(s)")).toBeVisible();
  });
});
