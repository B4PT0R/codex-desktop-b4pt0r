// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { ToolGroup } from "../../src/components/ToolGroup";
import { I18nProvider } from "../../src/i18n/I18nProvider";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockReset();
  vi.mocked(openPath).mockReset();
});

describe("activité des outils", () => {
  it("révèle progressivement la sortie, le statut et le diff", () => {
    render(
      <ToolGroup
        tools={[
          {
            id: "command-1",
            kind: "commandExecution",
            title: "Commande",
            detail: "npm test",
            status: "done",
            output: "131 tests réussis",
            exitCode: 0,
            durationMs: 1200,
          },
          {
            id: "patch-1",
            kind: "fileChange",
            title: "Modification de fichiers",
            detail: "src/App.tsx",
            status: "done",
            diff: "+import './tools.css';",
          },
        ]}
      />,
    );

    expect(screen.getByText("2 actions effectuées")).toBeVisible();
    expect(screen.getByText("Terminal 1")).toBeVisible();
    expect(screen.getByText("Fichiers 1")).toBeVisible();
    expect(screen.getByText("npm test")).not.toBeVisible();
    fireEvent.click(screen.getByText("2 actions effectuées"));
    expect(screen.getAllByLabelText("Terminé")).toHaveLength(2);
    expect(screen.getByText("Code 0 · 1.2 s")).toBeVisible();
    fireEvent.click(screen.getByText("npm test"));
    expect(screen.getByText("131 tests réussis")).toBeVisible();
    fireEvent.click(screen.getByText("src/App.tsx"));
    expect(screen.getByText("+import './tools.css';")).toBeVisible();
  });

  it("ouvre automatiquement une activité en cours et affiche sa progression", () => {
    render(
      <ToolGroup
        tools={[
          {
            id: "mcp-1",
            kind: "mcpToolCall",
            title: "Recherche",
            detail: "MCP · github",
            status: "running",
            progress: "Lecture de la page 2",
          },
        ]}
      />,
    );

    expect(screen.queryByText("Travail en cours")).toBeNull();
    expect(screen.getByLabelText("En cours")).toBeVisible();
    expect(screen.getByText("Lecture de la page 2")).toBeVisible();
  });

  it("ouvre un diff persistant depuis ses détails", () => {
    const onReviewDiff = vi.fn();
    const tool = {
      id: "patch-1",
      kind: "fileChange" as const,
      title: "Modification de fichiers",
      detail: "src/App.tsx",
      status: "done" as const,
      diff: "+nouvelle ligne",
    };
    render(<ToolGroup tools={[tool]} onReviewDiff={onReviewDiff} />);
    fireEvent.click(screen.getByText("1 action effectuée"));
    fireEvent.click(screen.getByText("src/App.tsx"));
    fireEvent.click(
      screen.getByRole("button", { name: "Revoir dans le panneau" }),
    );
    expect(onReviewDiff).toHaveBeenCalledWith(tool);
  });

  it("condense uniquement les longues séries terminées", () => {
    render(
      <ToolGroup
        tools={Array.from({ length: 6 }, (_, index) => ({
          id: `command-${index}`,
          kind: "commandExecution" as const,
          title: `Commande ${index + 1}`,
          detail: `commande-${index + 1}`,
          status: "done" as const,
        }))}
      />,
    );
    fireEvent.click(screen.getByText("6 actions effectuées"));
    expect(screen.queryByText("Commande 1")).toBeNull();
    expect(screen.getByText("Commande 4")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher 3 actions précédentes" }),
    );
    expect(screen.getByText("Commande 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Réduire l’activité" }));
    expect(screen.queryByText("Commande 1")).toBeNull();
  });

  it("retire du DOM les anciennes actions quand une longue série se termine", () => {
    const tools = Array.from({ length: 6 }, (_, index) => ({
      id: `command-${index}`,
      kind: "commandExecution" as const,
      title: `Commande ${index + 1}`,
      detail: `commande-${index + 1}`,
      status: "running" as const,
    }));
    const { rerender } = render(<ToolGroup tools={tools} />);
    expect(screen.getByText("Commande 1")).toBeVisible();

    rerender(
      <ToolGroup
        tools={tools.map((tool) => ({ ...tool, status: "done" as const }))}
      />,
    );
    expect(screen.queryByText("Commande 1")).toBeNull();
    fireEvent.click(screen.getByText("6 actions effectuées"));
    expect(screen.getByText("Commande 4")).toBeVisible();
  });

  it("affiche immédiatement une image générée et révèle les résultats web", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(
      <ToolGroup
        tools={[
          {
            id: "image-1",
            kind: "imageGeneration",
            title: "Génération d’image",
            detail: "Un carré bleu",
            status: "done",
            artifacts: [
              {
                type: "generatedImage",
                dataUrl: "data:image/png;base64,iVBORw0KGgo=",
                prompt: "Un carré bleu",
                path: "/tmp/square.png",
              },
            ],
          },
          {
            id: "web-1",
            kind: "webSearch",
            title: "Recherche web",
            detail: "Codex docs",
            status: "done",
            artifacts: [
              {
                type: "webResult",
                title: "Documentation Codex",
                url: "https://developers.openai.com/codex/",
                snippet: "Documentation officielle",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("2 actions effectuées"));
    expect(screen.getByRole("img", { name: "Un carré bleu" })).toBeVisible();
    expect(screen.getByText("/tmp/square.png")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir l’image dans Chromium" }),
    );
    expect(invoke).toHaveBeenCalledWith("open_chromium_target", {
      target: "/tmp/square.png",
    });
    expect(screen.getByText("Documentation Codex")).not.toBeVisible();
    fireEvent.click(screen.getByText("Codex docs"));
    fireEvent.click(
      screen.getByRole("button", { name: /Documentation Codex/ }),
    );
    expect(invoke).toHaveBeenCalledWith("open_chromium_target", {
      target: "https://developers.openai.com/codex/",
    });
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("matérialise une image en mémoire pour Chromium", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(
      <ToolGroup
        tools={[
          {
            id: "image-1",
            kind: "imageGeneration",
            title: "Génération d’image",
            status: "done",
            artifacts: [
              {
                type: "generatedImage",
                dataUrl: "data:image/png;base64,iVBORw0KGgo=",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("1 action effectuée"));
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir l’image dans Chromium" }),
    );
    expect(invoke).toHaveBeenCalledWith("open_chromium_image", {
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
  });

  it("rend l’échec d’ouverture d’un résultat récupérable", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Chromium unavailable"));
    vi.mocked(openUrl).mockResolvedValueOnce(undefined);
    render(
      <ToolGroup
        tools={[
          {
            id: "web-1",
            kind: "webSearch",
            title: "Recherche web",
            detail: "Résultat",
            status: "done",
            artifacts: [
              {
                type: "webResult",
                title: "Résultat officiel",
                url: "https://example.com/",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("1 action effectuée"));
    fireEvent.click(screen.getByText("Résultat"));
    fireEvent.click(screen.getByRole("button", { name: /Résultat officiel/ }));
    expect(
      await screen.findByText("Impossible d’ouvrir ce résultat"),
    ).toHaveAttribute("role", "alert");
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir avec le navigateur système" }),
    );
    expect(openUrl).toHaveBeenCalledWith("https://example.com/");
  });

  it("rend aussi visible l’échec du navigateur système", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Chromium unavailable"));
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("No default browser"));
    render(
      <ToolGroup
        tools={[
          {
            id: "web-1",
            kind: "webSearch",
            title: "Recherche web",
            detail: "Résultat",
            status: "done",
            artifacts: [
              {
                type: "webResult",
                title: "Résultat officiel",
                url: "https://example.com/",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("1 action effectuée"));
    fireEvent.click(screen.getByText("Résultat"));
    fireEvent.click(screen.getByRole("button", { name: /Résultat officiel/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Ouvrir avec le navigateur système",
      }),
    );
    expect(
      await screen.findByText("L’ouverture avec l’application système a échoué"),
    ).toHaveAttribute("role", "alert");
  });

  it("traduit le résumé et les détails en anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <ToolGroup
          tools={[
            {
              id: "command-1",
              kind: "commandExecution",
              title: "Command",
              detail: "npm test",
              status: "done",
              output: "ok",
              exitCode: 0,
            },
          ]}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("1 action completed")).toBeVisible();
    fireEvent.click(screen.getByText("1 action completed"));
    expect(screen.getByLabelText("Completed")).toBeVisible();
    fireEvent.click(screen.getByText("npm test"));
    expect(screen.getByText("Output")).toBeVisible();
    expect(screen.getByText("Exit code 0")).toBeVisible();
  });
});
