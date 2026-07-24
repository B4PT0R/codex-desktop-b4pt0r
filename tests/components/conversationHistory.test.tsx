// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { Conversation } from "../../src/components/Conversation";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import { closedStepRevealDelay } from "../../src/lib/toolActivityTiming";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const scrollTo = vi.fn();

function renderConversation(props: ComponentProps<typeof Conversation>) {
  return render(
    <I18nProvider>
      <Conversation {...props} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem("codex-desktop.locale", "fr");
  scrollTo.mockReset();
  HTMLElement.prototype.scrollTo = scrollTo;
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  window.cancelAnimationFrame = vi.fn();
});

describe("historique de conversation", () => {
  it("présente un accueil centré dans un nouveau chat", () => {
    renderConversation({ activity: null, messages: [] });
    expect(
      screen.getByRole("heading", { name: "Construisez tout avec Codex" }),
    ).toBeVisible();
    expect(screen.getByText(/Décrivez une idée/)).toBeVisible();
  });

  it("permet de charger les échanges précédents", () => {
    const onLoadOlder = vi.fn();
    renderConversation({
      activity: null,
      canLoadOlder: true,
      messages: [{ id: "message-1", role: "assistant", content: "Récent" }],
      onLoadOlder,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Charger les échanges précédents" }),
    );

    expect(onLoadOlder).toHaveBeenCalledOnce();
  });

  it("sort le dernier plan du fil pour n’afficher qu’un widget persistant", async () => {
    renderConversation({
      activity: "thinking",
      messages: [
        {
          id: "assistant-plan",
          role: "assistant",
          content: "Je commence.",
          signals: [
            {
              id: "plan-1",
              kind: "plan",
              title: "Plan",
              status: "running",
              steps: [{ step: "Analyser", status: "inProgress" }],
            },
          ],
        },
      ],
    });

    expect(
      await screen.findByRole("complementary", {
        name: "Progression du plan",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Plan")).toHaveLength(1);
  });

  it("place le raisonnement avant le texte streamé de l’agent", () => {
    renderConversation({
      activity: "talking",
      messages: [
        {
          id: "assistant-stream",
          role: "assistant",
          content: "Je lance maintenant les vérifications.",
          streaming: true,
          signals: [
            {
              id: "reasoning-1",
              kind: "reasoning",
              title: "Analyse",
              detail: "Je détermine les contrôles nécessaires.",
              status: "done",
            },
          ],
        },
      ],
    });

    const reasoning = screen.getByText("Analyse");
    const streamedText = screen.getByText(
      "Je lance maintenant les vérifications.",
    );
    expect(
      reasoning.compareDocumentPosition(streamedText) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("attend la fin du repli technique avant de révéler le texte suivant", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const revealDelay = closedStepRevealDelay(1);
    renderConversation({
      activity: "talking",
      messages: [
        {
          id: "assistant-tools",
          role: "assistant",
          content: "Je vérifie.",
          tools: [
            {
              id: "command-1",
              kind: "commandExecution",
              title: "Tests",
              detail: "npm test",
              status: "done",
            },
          ],
        },
        {
          id: "assistant-review",
          role: "assistant",
          content: "Les tests sont concluants.",
          streaming: true,
          revealAfter: now + revealDelay,
        },
      ],
    });

    expect(screen.queryByText("Les tests sont concluants.")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(revealDelay);
    });
    expect(screen.getByText("Les tests sont concluants.")).toBeVisible();
  });

  it("désactive le contrôle pendant le chargement", () => {
    renderConversation({
      activity: null,
      canLoadOlder: true,
      loadingOlder: true,
      messages: [],
    });

    expect(
      screen.getByRole("button", { name: "Chargement de l’historique…" }),
    ).toBeDisabled();
  });

  it("descend au dernier échange après un nouveau prompt seulement", () => {
    const initial = [
      { id: "user-1", role: "user" as const, content: "Premier prompt" },
      { id: "assistant-1", role: "assistant" as const, content: "Réponse" },
    ];
    const { rerender } = renderConversation({
      activity: null,
      messages: initial,
    });
    expect(scrollTo).toHaveBeenCalledOnce();

    rerender(
      <I18nProvider>
        <Conversation
          activity={null}
          messages={[
            { id: "older", role: "assistant", content: "Plus ancien" },
            ...initial,
          ]}
        />
      </I18nProvider>,
    );
    expect(scrollTo).toHaveBeenCalledOnce();

    rerender(
      <I18nProvider>
        <Conversation
          activity={null}
          messages={[
            ...initial,
            { id: "user-2", role: "user", content: "Nouveau prompt" },
          ]}
        />
      </I18nProvider>,
    );
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 0,
    });
  });

  it("suit le streaming près du bas puis respecte la lecture de l’historique", () => {
    const initial = [
      { id: "user-1", role: "user" as const, content: "Prompt" },
      {
        id: "assistant-1",
        role: "assistant" as const,
        content: "Début",
        streaming: true,
      },
    ];
    const { container, rerender } = renderConversation({
      activity: "thinking",
      messages: initial,
    });
    expect(scrollTo).toHaveBeenCalledOnce();

    rerender(
      <I18nProvider>
        <Conversation
          activity="thinking"
          messages={[
            initial[0],
            { ...initial[1], content: "Début de réponse" },
          ]}
        />
      </I18nProvider>,
    );
    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "auto",
      top: 0,
    });
    const callsWhileFollowing = scrollTo.mock.calls.length;

    const conversation = container.querySelector(".conversation");
    Object.defineProperties(conversation, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_200 },
      scrollTop: { configurable: true, value: 100 },
    });
    fireEvent.scroll(conversation!);
    rerender(
      <I18nProvider>
        <Conversation
          activity="thinking"
          messages={[
            initial[0],
            { ...initial[1], content: "Début de réponse prolongé" },
          ]}
        />
      </I18nProvider>,
    );
    expect(scrollTo).toHaveBeenCalledTimes(callsWhileFollowing);
  });
});
