import { describe, expect, it } from "vitest";
import { messagesForPresentation } from "../../src/lib/chatPresentation";
import type { ChatMessage, ToolCall } from "../../src/types";

const tool = (id: string): ToolCall => ({
  id,
  kind: "commandExecution",
  title: id,
  detail: id,
  status: "done",
});

describe("présentation des messages", () => {
  it("conserve les messages inchangés quand le raisonnement est visible", () => {
    const messages: ChatMessage[] = [
      { id: "reasoning", role: "assistant", content: "", signals: [] },
    ];
    expect(messagesForPresentation(messages, true)).toBe(messages);
  });

  it("regroupe uniquement les prises de parole Realtime consécutives", () => {
    const messages: ChatMessage[] = [
      {
        id: "voice-1",
        role: "assistant",
        modality: "realtimeVoice",
        content: "Première phrase.",
      },
      {
        id: "voice-2",
        role: "assistant",
        modality: "realtimeVoice",
        content: "Deuxième phrase.",
        streaming: true,
      },
      { id: "user", role: "user", content: "Réponse." },
      {
        id: "voice-3",
        role: "assistant",
        modality: "realtimeVoice",
        content: "Nouvelle prise de parole.",
      },
    ];

    expect(messagesForPresentation(messages, true)).toEqual([
      {
        ...messages[0],
        content: "Première phrase.\n\nDeuxième phrase.",
        streaming: true,
      },
      messages[2],
      messages[3],
    ]);
  });

  it("retire le raisonnement sans laisser les groupes d’actions séparés", () => {
    const messages: ChatMessage[] = [
      { id: "user", role: "user", content: "Go" },
      { id: "actions-1", role: "assistant", content: "", tools: [tool("one")] },
      {
        id: "signal-reasoning",
        role: "assistant",
        content: "",
        signals: [
          {
            id: "reasoning",
            kind: "reasoning",
            title: "Analyse",
            detail: "Suite",
            status: "done",
          },
        ],
        tools: [tool("two")],
      },
    ];

    expect(messagesForPresentation(messages, false)).toEqual([
      messages[0],
      { ...messages[1], tools: [tool("one"), tool("two")] },
    ]);
  });

  it("retire aussi le raisonnement intégré à une réponse visible", () => {
    const message: ChatMessage = {
      id: "answer",
      role: "assistant",
      content: "Terminé",
      signals: [
        {
          id: "reasoning",
          kind: "reasoning",
          title: "Analyse",
          status: "done",
        },
        {
          id: "warning",
          kind: "warning",
          title: "Attention",
          status: "error",
        },
      ],
    };
    expect(messagesForPresentation([message], false)[0].signals).toEqual([
      message.signals?.[1],
    ]);
  });
});
