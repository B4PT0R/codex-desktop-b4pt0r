import { describe, expect, it } from "vitest";
import {
  messagesFromThread,
  messagesFromTurnsNewestFirst,
} from "../../src/lib/threadPresentation";
import { scheduledTaskPrompt } from "../../src/lib/scheduledTaskMessage";

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
                  {
                    type: "skill",
                    name: "use-shared-browser",
                    path: "/skills/use-shared-browser/SKILL.md",
                  },
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
        content: "Analyse ceci",
        attachments: ["capture.png"],
        skills: [{ name: "use-shared-browser" }],
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

  it("ignore les messages agent vides entre deux outils au replay", () => {
    const messages = messagesFromThread({
      id: "thread-1",
      turns: [
        {
          items: [
            {
              id: "command-1",
              type: "commandExecution",
              command: "npm run dev",
              status: "completed",
            },
            { id: "empty-step", type: "agentMessage", text: "  " },
            {
              id: "browser-1",
              type: "mcpToolCall",
              server: "playwright",
              tool: "browser_navigate",
              status: "completed",
            },
          ],
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].tools?.map(({ id }) => id)).toEqual([
      "command-1",
      "browser-1",
    ]);
  });

  it("restaure un commentaire court comme description de l’action suivante", () => {
    const messages = messagesFromThread({
      id: "thread-commentary",
      turns: [
        {
          items: [
            {
              id: "commentary",
              type: "agentMessage",
              phase: "commentary",
              text: "Je contrôle la compilation.",
            },
            {
              id: "build",
              type: "commandExecution",
              command: "npm run build",
              status: "completed",
            },
          ],
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("");
    expect(messages[0].tools?.[0]).toMatchObject({
      id: "build",
      description: "Je contrôle la compilation.",
    });
  });

  it("restaure un réveil planifié comme une modalité distincte", () => {
    expect(
      messagesFromThread({
        id: "thread-1",
        turns: [
          {
            items: [
              {
                id: "scheduled-1",
                type: "userMessage",
                content: [
                  {
                    type: "text",
                    text: scheduledTaskPrompt(
                      "Veille",
                      "Inspecte les nouveautés",
                    ),
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        id: "scheduled-1",
        role: "user",
        modality: "scheduledTask",
        title: "Veille",
        content: "Inspecte les nouveautés",
      },
    ]);
  });

  it("restaure une erreur terminale et la durée calculée d’une action", () => {
    const messages = messagesFromThread({
      id: "thread-1",
      turns: [
        {
          id: "turn-1",
          status: "failed",
          error: { message: "Le modèle est temporairement indisponible." },
          items: [
            {
              id: "command-1",
              type: "commandExecution",
              command: "git status",
              status: "completed",
              exitCode: 0,
              startedAtMs: 1_000,
              completedAtMs: 2_750,
            },
          ],
        },
      ],
    });
    expect(messages[0].tools?.[0]).toMatchObject({ durationMs: 1_750 });
    expect(messages[1]).toMatchObject({
      id: "turn-error-turn-1",
      modality: "applicationError",
      title: "Ce tour s’est terminé avec une erreur",
      content: "Le modèle est temporairement indisponible.",
    });
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

  it("restaure un tour parallèle encore actif sans finaliser ses derniers items", () => {
    const messages = messagesFromThread({
      id: "thread-active",
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            {
              id: "command-done",
              type: "commandExecution",
              command: "git status",
              status: "completed",
              exitCode: 0,
            },
            {
              id: "command-live",
              type: "commandExecution",
              command: "npm run dev",
              status: "inProgress",
              aggregatedOutput: "ready\n",
            },
            {
              id: "agent-live",
              type: "agentMessage",
              text: "Réponse partielle",
            },
          ],
        },
      ],
    });

    expect(messages[0].tools).toEqual([
      expect.objectContaining({ id: "command-done", status: "done" }),
      expect.objectContaining({
        id: "command-live",
        status: "running",
        output: "ready\n",
      }),
    ]);
    expect(messages[1]).toMatchObject({
      id: "agent-live",
      content: "Réponse partielle",
      streaming: true,
    });
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
