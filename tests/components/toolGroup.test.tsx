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
import {
  TOOL_BACKGROUND_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_COMPLETION_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
  TOOL_HIDE_MS,
  ToolGroup,
} from "../../src/components/ToolGroup";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import {
  CLOSED_STEP_GROUP_DWELL_MS,
  CLOSED_STEP_TOOL_DWELL_MS,
} from "../../src/lib/toolActivityTiming";
import { invoke, openPath, openUrl } from "../../src/lib/nativeBridge";
import type { ToolCall } from "../../src/types";

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: vi.fn(),
  openPath: vi.fn(),
  openUrl: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  vi.mocked(openPath).mockReset();
  vi.mocked(openUrl).mockReset();
});

function command(
  id: string,
  status: ToolCall["status"] = "running",
): ToolCall {
  return {
    id,
    kind: "commandExecution",
    title: `Commande ${id}`,
    detail: `npm run ${id}`,
    status,
  };
}

function finishLiveAction(stepClosed = false) {
  act(() => {
    vi.advanceTimersByTime(
      (stepClosed ? CLOSED_STEP_TOOL_DWELL_MS : TOOL_COMPLETION_DWELL_MS) +
        TOOL_COLLAPSE_MS,
    );
  });
}

describe("activité des outils", () => {
  it("affiche l’intention agent dans l’en-tête avec le type d’action en second", () => {
    render(
      <ToolGroup
        tools={[
          {
            ...command("check", "done"),
            description: "Je vérifie la compilation avant de continuer.",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /1 action effectuée/ }));
    const header = screen.getByRole("button", {
      name: /Je vérifie la compilation avant de continuer.*Commande check/,
    });
    expect(header).toBeVisible();
    expect(screen.getByText("Commande check")).toBeVisible();
  });

  it("reste replié pendant une action quand la vue compacte est imposée", () => {
    const first = command("first");
    const { rerender } = render(
      <ToolGroup keepCollapsed tools={[first]} />,
    );
    const summary = screen.getByRole("button", { name: /Action en cours/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("npm run first")).not.toBeVisible();

    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("npm run first")).toBeVisible();

    rerender(
      <ToolGroup keepCollapsed tools={[first, command("second")]} />,
    );
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("npm run second")).not.toBeVisible();
  });

  it("affiche immédiatement un en-tête de groupe et les détails de l’action active", () => {
    render(
      <ToolGroup
        tools={[
          {
            ...command("test"),
            output: "9 tests exécutés…",
          },
        ]}
      />,
    );

    expect(screen.getByText("Action en cours")).toBeVisible();
    expect(screen.getByText("npm run test")).toBeVisible();
    expect(screen.getByText("9 tests exécutés…")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Commande test/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("affiche le fil d’un sous-agent dans l’action de délégation parent", () => {
    render(
      <ToolGroup
        renderSubagentMessages={(messages) =>
          messages.map((message) => <p key={message.id}>{message.content}</p>)
        }
        subagentTranscripts={{
          "child-1": {
            messages: [
              {
                id: "child-answer",
                role: "assistant",
                content: "Audit en cours",
              },
            ],
            name: "Atlas",
            role: "reviewer",
            status: "running",
          },
        }}
        tools={[
          {
            id: "spawn-1",
            kind: "collabAgentToolCall",
            title: "Nouvel agent",
            detail: "Inspecter le transport",
            status: "running",
            subagent: {
              threadIds: ["child-1"],
              prompt: "Inspecter le transport",
              model: "gpt-5.4",
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Atlas")).toBeVisible();
    expect(screen.getByText("reviewer")).toBeVisible();
    expect(screen.getByText("Audit en cours")).toBeVisible();
    expect(screen.getByText("Inspecter le transport")).toBeVisible();
  });

  it("traite un sous-agent cédé comme un job d’arrière-plan", () => {
    vi.useFakeTimers();
    const spawn: ToolCall = {
      id: "spawn-1",
      kind: "collabAgentToolCall",
      title: "Nouvel agent",
      detail: "Audit",
      status: "running",
      subagent: { threadIds: ["child-1"], status: "running" },
    };
    render(
      <ToolGroup
        backgroundToolIds={new Set(["spawn-1"])}
        stepClosed
        tools={[spawn]}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(TOOL_BACKGROUND_DWELL_MS + TOOL_COLLAPSE_MS);
    });

    expect(screen.getByRole("button", { name: /Nouvel agent/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    act(() => vi.advanceTimersByTime(CLOSED_STEP_GROUP_DWELL_MS));
    act(() => vi.advanceTimersByTime(TOOL_GROUP_COLLAPSE_MS));
    const summary = screen.getByRole("button", { name: /Action en cours/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(summary.querySelector(".spin")).toBeNull();
    expect(
      summary.querySelector(".lucide-briefcase-business"),
    ).not.toBeNull();

    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    const action = screen.getByRole("button", { name: /Nouvel agent/ });
    fireEvent.click(action);
    expect(action).toHaveAttribute("aria-expanded", "true");
  });

  it("replie uniquement le panneau de détail sans remplacer l’en-tête", () => {
    vi.useFakeTimers();
    const running = command("check");
    const { rerender } = render(<ToolGroup tools={[running]} />);
    const header = screen.getByRole("button", { name: /Commande check/ });

    rerender(<ToolGroup tools={[{ ...running, status: "done" }]} />);
    act(() => vi.advanceTimersByTime(TOOL_COMPLETION_DWELL_MS));
    expect(header.closest(".tool-row")).toHaveClass("closing");
    expect(screen.getByText("npm run check")).toBeVisible();

    act(() => vi.advanceTimersByTime(TOOL_COLLAPSE_MS));
    expect(screen.getByRole("button", { name: /Commande check/ })).toBe(header);
    expect(header.closest(".tool-row")).toHaveClass("collapsed");
    expect(screen.getByText("npm run check")).not.toBeVisible();
  });

  it("ne présente l’appel suivant qu’après la fermeture complète du précédent", () => {
    vi.useFakeTimers();
    const first = command("first");
    const second = command("second");
    const { rerender } = render(<ToolGroup tools={[first, second]} />);

    expect(screen.queryByText("Commande second")).toBeNull();
    rerender(
      <ToolGroup
        tools={[
          { ...first, status: "done" },
          { ...second, status: "done" },
        ]}
      />,
    );
    act(() => vi.advanceTimersByTime(TOOL_COMPLETION_DWELL_MS));
    expect(screen.queryByText("Commande second")).toBeNull();
    expect(screen.getByText("Commande first").closest(".tool-row")).toHaveClass(
      "closing",
    );

    act(() => vi.advanceTimersByTime(TOOL_COLLAPSE_MS));
    expect(screen.getByText("Commande second")).toBeVisible();
    expect(screen.getByText("Commande first").closest(".tool-row")).toHaveClass(
      "collapsed",
    );
  });

  it("laisse une commande en arrière-plan rendre la main aux appels suivants", () => {
    vi.useFakeTimers();
    const server = {
      ...command("dev-server"),
      output: "Local: http://127.0.0.1:1420/",
    };
    const browser: ToolCall = {
      id: "browser",
      kind: "mcpToolCall",
      title: "Navigation Playwright",
      detail: "Ouvrir la preview",
      status: "running",
    };
    const { rerender } = render(
      <ToolGroup
        backgroundToolIds={new Set(["dev-server"])}
        stepClosed={false}
        tools={[server, browser]}
      />,
    );

    expect(screen.queryByText("Navigation Playwright")).toBeNull();
    act(() => vi.advanceTimersByTime(TOOL_BACKGROUND_DWELL_MS));
    expect(
      screen.getByText("Commande dev-server").closest(".tool-row"),
    ).toHaveClass("closing");
    expect(screen.queryByText("Navigation Playwright")).toBeNull();
    act(() => vi.advanceTimersByTime(TOOL_COLLAPSE_MS));

    expect(screen.getByText("Navigation Playwright")).toBeVisible();
    const backgroundStatus = screen.getByLabelText("En arrière-plan");
    expect(backgroundStatus).toBeVisible();
    expect(backgroundStatus.querySelector(".spin")).toBeNull();
    expect(
      backgroundStatus.querySelector(".lucide-briefcase-business"),
    ).not.toBeNull();

    rerender(
      <ToolGroup
        backgroundToolIds={new Set(["dev-server"])}
        stepClosed
        tools={[server, { ...browser, status: "done" }]}
      />,
    );
    finishLiveAction(true);
    act(() => vi.advanceTimersByTime(CLOSED_STEP_GROUP_DWELL_MS));
    act(() => vi.advanceTimersByTime(TOOL_GROUP_COLLAPSE_MS));
    const groupSummary = screen.getByRole("button", {
      name: /1 action effectuée · 1 encore en cours/,
    });
    expect(groupSummary).toHaveAttribute("aria-expanded", "false");
    expect(groupSummary.querySelector(".spin")).toBeNull();
    expect(
      groupSummary.querySelector(".lucide-briefcase-business"),
    ).not.toBeNull();
  });

  it("fait sortir l’action la plus ancienne avant un appel excédentaire", () => {
    vi.useFakeTimers();
    const first = command("one");
    const { rerender } = render(
      <ToolGroup maxVisibleActions={2} tools={[first]} />,
    );
    rerender(
      <ToolGroup
        maxVisibleActions={2}
        tools={[{ ...first, status: "done" }]}
      />,
    );
    finishLiveAction();

    const second = command("two", "done");
    rerender(
      <ToolGroup
        maxVisibleActions={2}
        tools={[{ ...first, status: "done" }, second]}
      />,
    );
    finishLiveAction();

    const third = command("three", "done");
    rerender(
      <ToolGroup
        maxVisibleActions={2}
        tools={[{ ...first, status: "done" }, second, third]}
      />,
    );
    expect(screen.queryByText("Commande three")).toBeNull();
    expect(screen.getByText("Commande one").closest(".tool-row")).toHaveClass(
      "hiding",
    );

    act(() => vi.advanceTimersByTime(TOOL_HIDE_MS - 1));
    expect(screen.queryByText("Commande three")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Commande one")).toBeNull();
    expect(screen.getByText("Commande three")).toBeVisible();
  });

  it("conserve les dernières actions repliées tant que le step reste actif", () => {
    vi.useFakeTimers();
    const running = command("active");
    const { rerender } = render(
      <ToolGroup stepClosed={false} tools={[running]} />,
    );
    rerender(
      <ToolGroup
        stepClosed={false}
        tools={[{ ...running, status: "done" }]}
      />,
    );
    finishLiveAction();
    act(() =>
      vi.advanceTimersByTime(
        CLOSED_STEP_GROUP_DWELL_MS + TOOL_GROUP_COLLAPSE_MS + 2_000,
      ),
    );

    expect(screen.getByText("Commande active")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /1 action effectuée/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("ferme le groupe seulement après la clôture du step", () => {
    vi.useFakeTimers();
    const running = command("closed");
    const { rerender } = render(
      <ToolGroup stepClosed={false} tools={[running]} />,
    );
    rerender(
      <ToolGroup
        stepClosed={false}
        tools={[{ ...running, status: "done" }]}
      />,
    );
    finishLiveAction();
    rerender(
      <ToolGroup
        stepClosed
        tools={[{ ...running, status: "done" }]}
      />,
    );
    act(() => vi.advanceTimersByTime(CLOSED_STEP_GROUP_DWELL_MS));
    expect(screen.getByText("Commande closed")).toBeVisible();
    act(() => vi.advanceTimersByTime(TOOL_GROUP_COLLAPSE_MS));

    expect(screen.getByText("Commande closed")).not.toBeVisible();
    expect(
      screen.getByRole("button", { name: /1 action effectuée/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("permet de revoir l’historique et un diff après fermeture", () => {
    const onReviewDiff = vi.fn();
    const tools = Array.from({ length: 5 }, (_, index) => ({
      ...command(String(index + 1), "done"),
      ...(index === 4 ? { diff: "+ rendu stable" } : {}),
    }));
    render(
      <ToolGroup
        maxVisibleActions={2}
        onReviewDiff={onReviewDiff}
        tools={tools}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /5 actions effectuées/ }));
    expect(screen.queryByText("Commande 1")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher 3 actions précédentes" }),
    );
    expect(screen.getByText("Commande 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Commande 5/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Revoir dans le panneau" }),
    );
    expect(onReviewDiff).toHaveBeenCalledWith(tools[4]);
  });

  it("garde les erreurs repliables et identifiables", () => {
    render(
      <ToolGroup
        tools={[
          {
            ...command("missing", "error"),
            output: "script missing",
          },
        ]}
      />,
    );
    expect(screen.getByText("1 action, dont une en erreur")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: /1 action, dont une en erreur/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Commande missing/,
      }),
    );
    expect(screen.getByText("script missing")).toBeVisible();
    expect(screen.getByLabelText("Échec")).toBeVisible();
  });

  it("ouvre un résultat web et propose le navigateur système en repli", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Chromium unavailable"));
    vi.mocked(openUrl).mockResolvedValueOnce(undefined);
    render(
      <ToolGroup
        tools={[
          {
            id: "web",
            kind: "webSearch",
            title: "Recherche web",
            detail: "Codex docs",
            status: "done",
            artifacts: [
              {
                type: "webResult",
                title: "Documentation Codex",
                url: "https://developers.openai.com/codex/",
              },
            ],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /1 action effectuée/ }));
    fireEvent.click(screen.getByRole("button", { name: /Recherche web/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Documentation Codex/ }),
    );
    expect(
      await screen.findByText("Impossible d’ouvrir ce résultat"),
    ).toHaveAttribute("role", "alert");
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir avec le navigateur système" }),
    );
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith(
        "https://developers.openai.com/codex/",
      ),
    );
  });

  it("traduit le résumé et les détails en anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <ToolGroup
          tools={[
            {
              ...command("test", "done"),
              output: "ok",
              exitCode: 0,
            },
          ]}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("1 action completed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /1 action completed/ }));
    const header = screen.getByRole("button", { name: /Commande test/ });
    expect(header).not.toHaveAccessibleName(/Exit code/);
    fireEvent.click(header);
    expect(screen.getByText("Input")).toBeVisible();
    expect(screen.getByText("Output")).toBeVisible();
    expect(screen.getByText("Exit code 0")).toBeVisible();
  });
});
