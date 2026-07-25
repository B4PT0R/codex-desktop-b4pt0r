// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke, openPath, openUrl } from "../../src/lib/nativeBridge";
import {
  TOOL_COLLAPSE_MS,
  TOOL_COMPLETION_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
  TOOL_GROUP_DWELL_MS,
  ToolGroup,
} from "../../src/components/ToolGroup";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import {
  CLOSED_STEP_GROUP_DWELL_MS,
  CLOSED_STEP_TOOL_DWELL_MS,
} from "../../src/lib/toolActivityTiming";

vi.mock("../../src/lib/nativeBridge", () => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
  invoke: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
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
    vi.useFakeTimers();
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
        stepClosed
        tools={tools.map((tool) => ({ ...tool, status: "done" as const }))}
      />,
    );
    for (const _tool of tools) {
      act(() => {
        vi.advanceTimersByTime(
          CLOSED_STEP_TOOL_DWELL_MS + TOOL_COLLAPSE_MS,
        );
      });
    }
    act(() => {
      vi.advanceTimersByTime(
        CLOSED_STEP_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.queryByText("Commande 1")).toBeNull();
    fireEvent.click(screen.getByText("6 actions effectuées"));
    expect(screen.getByText("Commande 4")).toBeVisible();
  });

  it("présente les outils d’un step un par un après leur repli", () => {
    vi.useFakeTimers();
    const tools = [
      {
        id: "command-1",
        kind: "commandExecution" as const,
        title: "Première commande",
        detail: "npm test",
        status: "running" as const,
      },
      {
        id: "command-2",
        kind: "commandExecution" as const,
        title: "Commande suivante",
        detail: "npm run build",
        status: "running" as const,
      },
    ];
    const { rerender } = render(<ToolGroup tools={tools} />);

    expect(screen.getByText("Première commande")).toBeVisible();
    expect(screen.queryByText("Commande suivante")).toBeNull();

    rerender(
      <ToolGroup
        tools={tools.map((tool) => ({ ...tool, status: "done" as const }))}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(TOOL_COMPLETION_DWELL_MS - 1);
    });
    expect(screen.queryByText("Commande suivante")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("Commande suivante")).toBeVisible();
    expect(
      screen.getByText("Première commande").closest(".tool-row"),
    ).toHaveClass("collapsing");

    act(() => {
      vi.advanceTimersByTime(TOOL_COLLAPSE_MS);
    });
    expect(
      screen.getByText("Première commande").closest(".tool-row"),
    ).toHaveClass("compact");

    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS - TOOL_COLLAPSE_MS,
      );
    });
    expect(
      screen.getByText("Commande suivante").closest(".tool-row"),
    ).toHaveClass("collapsing");
    expect(
      screen.getByText("Première commande").closest(".tool-row"),
    ).toHaveClass("compact");
  });

  it("garde un groupe à action unique replié quand le step suivant commence", () => {
    vi.useFakeTimers();
    const runningTool = {
      id: "command-1",
      kind: "commandExecution" as const,
      title: "Commande unique",
      detail: "npm test",
      status: "running" as const,
    };
    const { rerender } = render(<ToolGroup tools={[runningTool]} />);

    rerender(
      <ToolGroup tools={[{ ...runningTool, status: "done" as const }]} />,
    );
    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    act(() => {
      vi.advanceTimersByTime(
        TOOL_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("1 action effectuée")).toBeVisible();

    rerender(
      <ToolGroup
        stepClosed
        tools={[{ ...runningTool, status: "done" as const }]}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(
        CLOSED_STEP_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("1 action effectuée")).toBeVisible();
    expect(screen.getByText("Commande unique")).not.toBeVisible();
  });

  it("replie durablement une action isolée terminée en erreur", () => {
    vi.useFakeTimers();
    const runningTool = {
      id: "command-error",
      kind: "commandExecution" as const,
      title: "Commande en erreur",
      detail: "npm run missing",
      status: "running" as const,
      output: "script missing",
    };
    const { rerender } = render(<ToolGroup tools={[runningTool]} />);

    rerender(
      <ToolGroup
        tools={[{ ...runningTool, status: "error" as const }]}
      />,
    );
    expect(screen.getByText("script missing")).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    act(() => {
      vi.advanceTimersByTime(
        TOOL_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("1 action, dont une en erreur")).toBeVisible();
    expect(screen.getByText("Commande en erreur")).not.toBeVisible();

    rerender(
      <ToolGroup
        stepClosed
        tools={[
          {
            ...runningTool,
            status: "error" as const,
            progress: "Diagnostic final",
          },
        ]}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(
        CLOSED_STEP_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("1 action, dont une en erreur")).toBeVisible();
    expect(screen.getByText("Commande en erreur")).not.toBeVisible();
  });

  it("rattrape un appel réussi ajouté après le repli du précédent", () => {
    vi.useFakeTimers();
    const first = {
      id: "command-first",
      kind: "commandExecution" as const,
      title: "Première action",
      detail: "npm test",
      status: "running" as const,
    };
    const { rerender } = render(<ToolGroup tools={[first]} />);
    rerender(
      <ToolGroup tools={[{ ...first, status: "done" as const }]} />,
    );
    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    expect(
      screen.getByText("Première action").closest(".tool-row"),
    ).toHaveClass("compact");

    const late = {
      id: "command-late",
      kind: "commandExecution" as const,
      title: "Action arrivée tardivement",
      detail: "npm run check",
      status: "done" as const,
    };
    rerender(
      <ToolGroup
        tools={[{ ...first, status: "done" as const }, late]}
      />,
    );
    expect(screen.getByText("Action arrivée tardivement")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    act(() => {
      vi.advanceTimersByTime(
        TOOL_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("2 actions effectuées")).toBeVisible();
    expect(screen.getByText("Première action")).not.toBeVisible();
    expect(screen.getByText("Action arrivée tardivement")).not.toBeVisible();
  });

  it("masque la vague précédente lorsqu’un step silencieux rouvre le groupe", () => {
    vi.useFakeTimers();
    const first = {
      id: "command-first-wave",
      kind: "commandExecution" as const,
      title: "Action du step précédent",
      detail: "npm test",
      status: "running" as const,
    };
    const { rerender } = render(<ToolGroup tools={[first]} />);
    rerender(
      <ToolGroup tools={[{ ...first, status: "done" as const }]} />,
    );
    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    act(() => {
      vi.advanceTimersByTime(
        TOOL_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    expect(screen.getByText("1 action effectuée")).toBeVisible();

    const next = {
      id: "command-next-wave",
      kind: "commandExecution" as const,
      title: "Action du step silencieux",
      detail: "npm run check",
      status: "running" as const,
    };
    rerender(
      <ToolGroup
        tools={[{ ...first, status: "done" as const }, next]}
      />,
    );

    expect(screen.getByText("Action du step silencieux")).toBeVisible();
    expect(screen.queryByText("Action du step précédent")).toBeNull();

    rerender(
      <ToolGroup
        tools={[
          { ...first, status: "done" as const },
          { ...next, status: "done" as const },
        ]}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(
        TOOL_COMPLETION_DWELL_MS + TOOL_COLLAPSE_MS,
      );
    });
    act(() => {
      vi.advanceTimersByTime(
        TOOL_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS,
      );
    });
    fireEvent.click(screen.getByText("2 actions effectuées"));
    expect(screen.getByText("Action du step précédent")).toBeVisible();
    expect(screen.getByText("Action du step silencieux")).toBeVisible();
  });

  it("révèle les résultats web dans le détail de leur action", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(
      <ToolGroup
        tools={[
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

    fireEvent.click(screen.getByText("1 action effectuée"));
    expect(screen.getByText("Documentation Codex")).not.toBeVisible();
    fireEvent.click(screen.getByText("Codex docs"));
    fireEvent.click(
      screen.getByRole("button", { name: /Documentation Codex/ }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("open_chromium_target", {
        target: "https://developers.openai.com/codex/",
      }),
    );
    expect(openUrl).not.toHaveBeenCalled();
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
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith("https://example.com/"),
    );
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
