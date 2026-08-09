import { describe, expect, it } from "vitest";
import {
  appendRealtimeUserDelta,
  appendRealtimeVoiceDelta,
  dedupeLiveRealtimeTextPersistence,
  finalizeInterruptedRealtimeMessages,
  finalizeRealtimeUserMessage,
  finalizeRealtimeVoiceMessage,
  isRealtimeVoiceItemId,
  isRealtimeTextItemId,
  isVisibleRealtimeTranscript,
  markRealtimeConversationUpdates,
  markRealtimeTextUpdates,
  realtimeConversationScope,
  realtimeVoiceItemId,
  realtimeTextItemId,
  reserveRealtimeUserMessage,
} from "../../src/lib/realtimeTranscript";

describe("transcript Realtime visible", () => {
  it("masque la copie persistée live mais la conserve au replay", () => {
    const source = {
      id: "text-agent-1",
      role: "assistant" as const,
      content: "Réponse",
      modality: "realtimeText" as const,
    };
    const persisted = {
      ...source,
      id: "msg_rtt_text-agent-1",
    };
    expect(dedupeLiveRealtimeTextPersistence([source], [source, persisted]))
      .toEqual([source]);
    expect(dedupeLiveRealtimeTextPersistence([], [persisted]))
      .toEqual([persisted]);
  });
  it("route les messages du fork actif vers son parent visible", () => {
    expect(
      realtimeConversationScope("fork-1", "fork-1", "parent-1"),
    ).toBe("parent-1");
    expect(
      realtimeConversationScope("fork-2", "fork-1", "parent-1"),
    ).toBeUndefined();
    expect(
      realtimeConversationScope("fork-1", "fork-1", undefined),
    ).toBeUndefined();
  });

  it("bufferise la réponse textuelle sans exposer le prompt interne", () => {
    expect(markRealtimeConversationUpdates([], [
      { id: "internal", role: "user", content: "delegated prompt" },
      { id: "answer", role: "assistant", content: "résultat" },
    ])).toEqual([
      {
        id: "answer",
        role: "assistant",
        content: "résultat",
        modality: "realtimeText",
      },
    ]);
  });
  it("génère des identifiants Responses valides et relit le format historique", () => {
    const id = realtimeVoiceItemId(
      "user",
      "afa65b43-c52b-4c85-b63a-b099878e5f99",
    );
    expect(id).toBe("msg_rtv_user_afa65b43-c52b-4c85-b63a-b099878e5f99");
    expect(id.length).toBeLessThanOrEqual(64);
    expect(isRealtimeVoiceItemId("msg_rtv_assistant_message-1")).toBe(true);
    expect(isRealtimeVoiceItemId("msg_realtime_voice_assistant_message-2"))
      .toBe(true);
    expect(isRealtimeVoiceItemId("realtime_voice_assistant_message-legacy"))
      .toBe(true);
    expect(realtimeTextItemId("backend-message-1")).toBe(
      "msg_rtt_backend-message-1",
    );
    expect(isRealtimeTextItemId("msg_rtt_backend-message-1")).toBe(true);
    const longTextId = realtimeTextItemId(`msg_${"a".repeat(100)}`);
    expect(longTextId).toMatch(/^msg_rtt_/);
    expect(longTextId.length).toBeLessThanOrEqual(64);
  });

  it("affiche les deux rôles de la conversation vocale", () => {
    expect(isVisibleRealtimeTranscript("assistant")).toBe(true);
    expect(isVisibleRealtimeTranscript("user")).toBe(true);
  });

  it("identifie seulement les messages textuels modifiés pendant Realtime", () => {
    const previous = [
      { id: "old", role: "assistant" as const, content: "Déjà présent" },
    ];
    const next = [
      previous[0],
      { id: "new", role: "assistant" as const, content: "Réponse parallèle" },
      { id: "tools", role: "assistant" as const, content: "" },
      { id: "user", role: "user" as const, content: "Question" },
    ];

    expect(markRealtimeTextUpdates(previous, next, true)).toEqual([
      previous[0],
      {
        id: "new",
        role: "assistant",
        content: "Réponse parallèle",
        modality: "realtimeText",
      },
      next[2],
      next[3],
    ]);
    expect(markRealtimeTextUpdates(previous, next, false)).toBe(next);
  });

  it("ne reclasse pas une réponse qui précédait le démarrage de Realtime", () => {
    const previous = [
      { id: "before", role: "assistant" as const, content: "Réponse terminée" },
    ];
    const rebuilt = [
      {
        id: "before",
        role: "assistant" as const,
        content: "Réponse terminée",
        streaming: false,
      },
      {
        id: "during",
        role: "assistant" as const,
        content: "Réponse simultanée",
      },
    ];

    expect(
      markRealtimeTextUpdates(
        previous,
        rebuilt,
        true,
        new Set(["before"]),
      ),
    ).toEqual([
      rebuilt[0],
      {
        ...rebuilt[1],
        modality: "realtimeText",
      },
    ]);
  });

  it("streame puis finalise la parole assistant dans un seul message", () => {
    const started = appendRealtimeVoiceDelta([], "voice-1", "Je vérifie");
    const continued = appendRealtimeVoiceDelta(started, "voice-1", " cela.");
    expect(continued).toEqual([
      {
        id: "voice-1",
        role: "assistant",
        modality: "realtimeVoice",
        content: "Je vérifie cela.",
        streaming: true,
      },
    ]);

    expect(
      finalizeRealtimeVoiceMessage(
        continued,
        "voice-1",
        "Je vérifie cela.",
      ),
    ).toEqual([
      expect.objectContaining({
        id: "voice-1",
        content: "Je vérifie cela.",
        streaming: false,
      }),
    ]);
  });

  it("crée directement le message final quand aucun delta n’a précédé", () => {
    expect(finalizeRealtimeVoiceMessage([], "voice-2", "Terminé.")).toEqual([
      {
        id: "voice-2",
        role: "assistant",
        modality: "realtimeVoice",
        content: "Terminé.",
        streaming: false,
      },
    ]);
  });

  it("streame puis stabilise la parole utilisateur à la même position", () => {
    const started = appendRealtimeUserDelta([], "user-1", "On peut");
    const continued = appendRealtimeUserDelta(
      started,
      "user-1",
      " le faire.",
    );
    expect(continued).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "On peut le faire.",
        streaming: true,
      },
    ]);
    expect(
      finalizeRealtimeUserMessage(continued, "user-1", "On peut le faire."),
    ).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "On peut le faire.",
        streaming: false,
      },
    ]);
  });

  it("réserve le tour utilisateur avant une réponse assistant déjà streamée", () => {
    const reserved = reserveRealtimeUserMessage([], "user-early");
    const withAssistant = appendRealtimeVoiceDelta(
      reserved,
      "voice-after",
      "Je réponds déjà.",
    );

    expect(
      finalizeRealtimeUserMessage(
        withAssistant,
        "user-early",
        "Ma question finalisée.",
      ).map(({ id, content }) => ({ id, content })),
    ).toEqual([
      { id: "user-early", content: "Ma question finalisée." },
      { id: "voice-after", content: "Je réponds déjà." },
    ]);
    expect(reserveRealtimeUserMessage(reserved, "user-early")).toBe(reserved);
  });

  it("clôt en une passe les deux bulles laissées par une interruption", () => {
    expect(
      finalizeInterruptedRealtimeMessages(
        [
          {
            id: "user-live",
            role: "user",
            content: "Question",
            streaming: true,
          },
          {
            id: "voice-live",
            role: "assistant",
            modality: "realtimeVoice",
            content: "Réponse",
            streaming: true,
          },
        ],
        "voice-live",
        "user-live",
      ),
    ).toEqual([
      expect.objectContaining({ id: "user-live", streaming: false }),
      expect.objectContaining({ id: "voice-live", streaming: false }),
    ]);
  });
});
