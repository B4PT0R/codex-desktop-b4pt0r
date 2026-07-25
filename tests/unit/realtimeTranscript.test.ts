import { describe, expect, it } from "vitest";
import {
  appendRealtimeUserDelta,
  appendRealtimeVoiceDelta,
  finalizeInterruptedRealtimeMessages,
  finalizeRealtimeUserMessage,
  finalizeRealtimeVoiceMessage,
  isVisibleRealtimeTranscript,
  markRealtimeTextUpdates,
  reserveRealtimeUserMessage,
} from "../../src/lib/realtimeTranscript";

describe("transcript Realtime visible", () => {
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
