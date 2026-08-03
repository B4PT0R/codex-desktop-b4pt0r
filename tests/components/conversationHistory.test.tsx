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
  it("identifie discrètement les skills explicitement jointes au tour", () => {
    renderConversation({
      activity: null,
      messages: [
        {
          id: "skill-turn",
          role: "user",
          content: "$use-shared-browser ouvre cette page",
          skills: [{ name: "use-shared-browser" }],
        },
      ],
    });

    expect(screen.getByText("Skill · use-shared-browser")).toBeVisible();
  });

  it("affiche les citations mémoire structurées hors du Markdown", () => {
    renderConversation({
      activity: null,
      messages: [
        {
          id: "memory-answer",
          role: "assistant",
          content: "Je m’en souviens.",
          memoryCitations: [
            {
              path: "/home/user/.codex/memories/preferences.md",
              lineStart: 4,
              lineEnd: 6,
              note: "Préférence utilisateur",
            },
          ],
        },
      ],
    });

    expect(
      screen.getByRole("complementary", { name: "Sources de la mémoire" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Préférence utilisateur/ }),
    ).toHaveTextContent("lignes 4–6");
  });

  it("présente un accueil centré dans un nouveau chat", () => {
    renderConversation({ activity: null, messages: [] });
    const heading = screen.getByRole("heading", {
      name: "Construisez tout avec Codex",
    });
    expect(heading).toBeVisible();
    expect(heading.closest(".conversation-content")).toHaveClass("is-empty");
    expect(screen.getByText(/Décrivez une idée/)).toBeVisible();
  });

  it("remplace l’accueil par un chargement puis révèle la conversation", () => {
    vi.useFakeTimers();
    const { rerender } = renderConversation({
      activity: null,
      loadingThread: true,
      messages: [],
    });

    expect(
      screen.getByRole("status", { name: "Chargement de la conversation…" }),
    ).toBeVisible();
    const preparedWelcome = screen
      .getByRole("heading", {
        name: "Construisez tout avec Codex",
        hidden: true,
      })
      .closest(".conversation-content");
    expect(preparedWelcome).toHaveAttribute("aria-hidden", "true");
    expect(preparedWelcome).not.toHaveClass("is-preparing");

    rerender(
      <I18nProvider>
        <Conversation
          activity={null}
          messages={[
            {
              id: "loaded-message",
              role: "assistant",
              content: "Conversation restaurée",
            },
          ]}
        />
      </I18nProvider>,
    );

    const exiting = screen.getByRole("status", {
      name: "Chargement de la conversation…",
    });
    expect(exiting).toHaveClass("is-exiting");
    const preparedTranscript = screen
      .getByText("Conversation restaurée")
      .closest(".conversation-content");
    expect(preparedTranscript).toHaveAttribute("aria-hidden", "true");
    expect(preparedTranscript).not.toHaveClass("is-preparing");

    act(() => vi.advanceTimersByTime(180));

    expect(
      screen.queryByRole("status", { name: "Chargement de la conversation…" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(".conversation-loading-layer"),
    ).toHaveClass("is-exiting");
    expect(
      screen.getByText("Conversation restaurée").closest(".conversation-content"),
    ).toHaveAttribute("aria-hidden", "true");

    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByText("Conversation restaurée")).toBeVisible();
    expect(
      screen.getByText("Conversation restaurée").closest(".conversation-content"),
    ).not.toHaveAttribute("aria-hidden");
    expect(
      document.querySelector(".conversation-loading-layer"),
    ).not.toBeInTheDocument();
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

  it("distingue une erreur applicative d’une réponse de l’agent", () => {
    renderConversation({
      activity: null,
      messages: [
        {
          id: "application-error",
          role: "assistant",
          modality: "applicationError",
          title: "Impossible de renommer cette conversation",
          content: "Error: Mode aperçu navigateur",
        },
      ],
    });

    const error = screen.getByRole("alert", {
      name: "Impossible de renommer cette conversation",
    });
    expect(error).toBeVisible();
    expect(error).toHaveClass("application-error-message");
    expect(error).toHaveTextContent("Error: Mode aperçu navigateur");
  });

  it("présente une image générée hors de l’accordéon d’actions", () => {
    renderConversation({
      activity: null,
      messages: [
        {
          id: "generated-image",
          role: "assistant",
          content: "",
          tools: [
            {
              id: "image-tool",
              kind: "imageGeneration",
              title: "Génération d’image",
              detail: "Un chat astronaute",
              status: "done",
              artifacts: [
                {
                  type: "generatedImage",
                  dataUrl: "data:image/png;base64,iVBORw0KGgo=",
                  prompt: "Un chat astronaute",
                },
              ],
            },
          ],
        },
      ],
    });

    const action = screen.getByText("1 action effectuée").closest(".tool-group");
    const widget = screen.getByText("Image générée").closest(
      ".generated-image-widget",
    );
    expect(action).toBeInTheDocument();
    expect(widget).toBeVisible();
    expect(action).not.toContainElement(
      screen.getByRole("img", { name: "Un chat astronaute" }),
    );
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
    expect(document.querySelector(".conversation")).toHaveClass("has-plan");
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

  it("hiérarchise les réponses vocale et textuelle pendant Realtime", () => {
    vi.useFakeTimers();
    const { rerender } = renderConversation({
      activity: "talking",
      messages: [
        {
          id: "text",
          role: "assistant",
          modality: "realtimeText",
          content: "Détail complet de l’agent textuel.",
          streaming: true,
        },
        {
          id: "voice",
          role: "assistant",
          modality: "realtimeVoice",
          content: "Synthèse vocale prioritaire.",
        },
      ],
    });

    expect(
      screen.getByRole("region", { name: "Agent textuel" }),
    ).toHaveTextContent("Détail complet");
    expect(screen.getByText("Agent vocal")).toBeVisible();
    expect(screen.getByText("Synthèse vocale prioritaire.")).toBeVisible();

    rerender(
      <I18nProvider>
        <Conversation
          activity={null}
          messages={[
            {
              id: "text",
              role: "assistant",
              modality: "realtimeText",
              content: "Détail complet de l’agent textuel.",
              streaming: false,
            },
          ]}
        />
      </I18nProvider>,
    );
    act(() => vi.advanceTimersByTime(500));
    expect(
      screen.getByRole("button", { name: "Agent textuel" }),
    ).toHaveAttribute("aria-expanded", "false");
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
      scrollTop: { configurable: true, value: 800 },
    });
    fireEvent.scroll(conversation!);
    Object.defineProperties(conversation, {
      scrollTop: { configurable: true, value: 100 },
    });
    fireEvent.wheel(conversation!, { deltaY: -100 });
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

  it("reste ancré en bas pendant la stabilisation d'un long historique", () => {
    let notifyResize: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    const { container } = renderConversation({
      activity: null,
      messages: [
        { id: "user-long", role: "user", content: "Question ancienne" },
        {
          id: "assistant-long",
          role: "assistant",
          content: "Réponse très longue avec des blocs rendus tardivement",
        },
      ],
    });
    const conversation = container.querySelector(".conversation");
    Object.defineProperty(conversation, "scrollHeight", {
      configurable: true,
      value: 3_600,
    });

    act(() => notifyResize?.([], {} as ResizeObserver));

    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "auto",
      top: 3_600,
    });
    const callsWhileFollowing = scrollTo.mock.calls.length;
    Object.defineProperties(conversation, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 4_000 },
      scrollTop: { configurable: true, value: 3_600 },
    });
    fireEvent.scroll(conversation!);
    Object.defineProperties(conversation, {
      scrollTop: { configurable: true, value: 100 },
    });
    fireEvent.wheel(conversation!, { deltaY: -100 });
    fireEvent.scroll(conversation!);
    act(() => notifyResize?.([], {} as ResizeObserver));
    expect(scrollTo).toHaveBeenCalledTimes(callsWhileFollowing);
    vi.unstubAllGlobals();
  });
});
