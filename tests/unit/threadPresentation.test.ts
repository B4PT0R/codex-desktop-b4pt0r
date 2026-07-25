import { describe, expect, it } from "vitest";
import {
  messagesFromThread,
  messagesFromTurnsNewestFirst,
} from "../../src/lib/threadPresentation";

describe("reprise de conversation", () => {
  it("restaure le texte, les pièces jointes, les outils et le raisonnement", () => {
    expect(
      messagesFromThread({
        id: "thread-1",
        turns: [
          {
            items: [
              {
                id: "user-1",
                type: "userMessage",
                content: [
                  { type: "text", text: "Analyse ceci" },
                  { type: "localImage", path: "/tmp/capture.png" },
                ],
              },
              {
                id: "reasoning-1",
                type: "reasoning",
                summary: ["Inspection du projet"],
              },
              {
                id: "command-1",
                type: "commandExecution",
                command: "rg --files",
                status: "completed",
                aggregatedOutput: "src/App.tsx\n",
                exitCode: 0,
                durationMs: 42,
              },
              {
                id: "agent-1",
                type: "agentMessage",
                text: "Voici le résultat.",
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "Analyse ceci\n/tmp/capture.png",
      },
      {
        id: "signal-reasoning-1",
        role: "assistant",
        content: "",
        signals: [
          {
            id: "reasoning-1",
            kind: "reasoning",
            title: "Raisonnement",
            detail: "Inspection du projet",
            status: "done",
          },
        ],
        tools: [
          {
            id: "command-1",
            kind: "commandExecution",
            title: "Commande",
            detail: "rg --files",
            status: "done",
            output: "src/App.tsx\n",
            exitCode: 0,
            durationMs: 42,
          },
        ],
      },
      {
        id: "agent-1",
        role: "assistant",
        content: "Voici le résultat.",
      },
    ]);
  });

  it("retourne une conversation vide pour un thread sans tours", () => {
    expect(messagesFromThread({ id: "thread-1" })).toEqual([]);
  });

  it("restaure l’identité vocale depuis l’identifiant persistant", () => {
    expect(
      messagesFromThread({
        id: "thread-1",
        turns: [
          {
            items: [
              {
                id: "realtime_voice_assistant_message-1",
                type: "agentMessage",
                text: "Réponse vocale",
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        id: "realtime_voice_assistant_message-1",
        role: "assistant",
        content: "Réponse vocale",
        modality: "realtimeVoice",
      },
    ]);
  });

  it("restaure les images générées et résultats web structurés", () => {
    const messages = messagesFromThread({
      id: "thread-1",
      turns: [
        {
          items: [
            {
              id: "image-1",
              type: "imageGeneration",
              status: "completed",
              revisedPrompt: "Une aurore",
              result: "iVBORw0KGgo=",
              savedPath: "/tmp/aurora.png",
            },
            {
              id: "search-1",
              type: "webSearch",
              query: "documentation",
              results: [
                {
                  type: "text_result",
                  title: "Documentation",
                  url: "https://example.com/docs",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(messages[0].tools).toEqual([
      expect.objectContaining({
        id: "image-1",
        artifacts: [
          expect.objectContaining({
            type: "generatedImage",
            path: "/tmp/aurora.png",
          }),
        ],
      }),
      expect.objectContaining({
        id: "search-1",
        artifacts: [
          {
            type: "webResult",
            title: "Documentation",
            url: "https://example.com/docs",
          },
        ],
      }),
    ]);
  });

  it("remet une page descendante dans l’ordre de lecture", () => {
    expect(
      messagesFromTurnsNewestFirst([
        { items: [{ id: "new", type: "agentMessage", text: "Récent" }] },
        {
          items: [
            {
              id: "old",
              type: "userMessage",
              content: [{ type: "text", text: "Ancien" }],
            },
          ],
        },
      ]).map(({ id }) => id),
    ).toEqual(["old", "new"]);
  });
});
