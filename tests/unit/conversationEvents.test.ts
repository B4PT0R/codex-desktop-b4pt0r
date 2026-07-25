import { describe, expect, it } from "vitest";
import { applyConversationEvent } from "../../src/lib/conversationEvents";
import type { ChatMessage } from "../../src/types";

const assistantMessage: ChatMessage = {
  id: "answer",
  role: "assistant",
  content: "Bonjour",
};

describe("événements de conversation", () => {
  it("préserve les références des messages non concernés par un delta", () => {
    const older: ChatMessage = {
      id: "older",
      role: "assistant",
      content: "Historique Markdown coûteux",
      tools: [],
    };
    const streaming: ChatMessage = {
      id: "answer",
      role: "assistant",
      content: "Bon",
      streaming: true,
    };
    const updated = applyConversationEvent([older, streaming], {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "jour" },
    });

    expect(updated[0]).toBe(older);
    expect(updated[1]).toEqual({ ...streaming, content: "Bonjour" });
  });

  it("assemble les deltas successifs d’un message agent", () => {
    const started = applyConversationEvent([], {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "Bon" },
    });
    const updated = applyConversationEvent(started, {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "jour" },
    });

    expect(updated).toEqual([
      {
        id: "answer",
        role: "assistant",
        content: "Bonjour",
        streaming: true,
      },
    ]);
  });

  it("attache puis finalise un outil sur le dernier message agent", () => {
    const started = applyConversationEvent([assistantMessage], {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });
    const completed = applyConversationEvent(started, {
      method: "item/completed",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "completed",
        },
      },
    });

    expect(completed).toEqual([
      {
        ...assistantMessage,
        tools: [
          {
            id: "command-1",
            kind: "commandExecution",
            title: "Commande",
            detail: "npm test",
            status: "done",
          },
        ],
      },
    ]);
  });

  it("ne ressuscite pas une action isolée sur un démarrage dupliqué", () => {
    const started = applyConversationEvent([assistantMessage], {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });
    const completed = applyConversationEvent(started, {
      method: "item/completed",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "completed",
        },
      },
    });
    const replayedStart = applyConversationEvent(completed, {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });

    expect(replayedStart[0].tools).toEqual([
      expect.objectContaining({
        id: "command-1",
        status: "done",
      }),
    ]);
  });

  it("fusionne un démarrage dupliqué sans dupliquer l’action en cours", () => {
    const started = applyConversationEvent([assistantMessage], {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });
    const withOutput = applyConversationEvent(started, {
      method: "item/commandExecution/outputDelta",
      params: { itemId: "command-1", delta: "Tests en cours" },
    });
    const replayedStart = applyConversationEvent(withOutput, {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test -- --run",
          status: "inProgress",
        },
      },
    });

    expect(replayedStart[0].tools).toEqual([
      expect.objectContaining({
        id: "command-1",
        detail: "npm test -- --run",
        output: "Tests en cours",
        status: "running",
      }),
    ]);
  });

  it("fait évoluer la compaction de l’état actif à l’état terminé", () => {
    const started = applyConversationEvent([], {
      method: "item/started",
      params: {
        item: { id: "compact-1", type: "contextCompaction" },
      },
    });
    expect(started[0].signals?.[0]).toMatchObject({
      title: "Compaction du contexte",
      status: "running",
    });

    const completed = applyConversationEvent(started, {
      method: "item/completed",
      params: {
        item: { id: "compact-1", type: "contextCompaction" },
      },
    });
    expect(completed[0].signals?.[0]).toMatchObject({
      title: "Contexte compacté",
      status: "done",
    });
  });

  it("clôt le groupe d’outils dès que le texte agent reprend", () => {
    const announced = applyConversationEvent([], {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "Je lance les vérifications." },
    });
    const withTool = applyConversationEvent(announced, {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });
    const reviewed = applyConversationEvent(withTool, {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "Les tests sont concluants. " },
    });
    const continued = applyConversationEvent(reviewed, {
      method: "item/agentMessage/delta",
      params: { itemId: "answer", delta: "Je poursuis." },
    });

    expect(continued).toHaveLength(2);
    expect(continued[0]).toEqual(
      expect.objectContaining({
        id: "answer",
        content: "Je lance les vérifications.",
        streaming: false,
        tools: [expect.objectContaining({ id: "command-1" })],
      }),
    );
    expect(continued[1]).toEqual(
      expect.objectContaining({
        sourceItemId: "answer",
        content: "Les tests sont concluants. Je poursuis.",
        streaming: true,
      }),
    );
    expect(continued[1].tools).toBeUndefined();
  });

  it("diffuse la sortie et les interactions d’une commande puis garde le résultat final", () => {
    const started = applyConversationEvent([assistantMessage], {
      method: "item/started",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "inProgress",
        },
      },
    });
    const output = applyConversationEvent(started, {
      method: "item/commandExecution/outputDelta",
      params: { itemId: "command-1", delta: "Tests en cours" },
    });
    const interaction = applyConversationEvent(output, {
      method: "item/commandExecution/terminalInteraction",
      params: { itemId: "command-1", stdin: "y" },
    });
    const completed = applyConversationEvent(interaction, {
      method: "item/completed",
      params: {
        item: {
          id: "command-1",
          type: "commandExecution",
          command: "npm test",
          status: "completed",
          exitCode: 0,
          durationMs: 1250,
        },
      },
    });

    expect(completed[0].tools?.[0]).toEqual({
      id: "command-1",
      kind: "commandExecution",
      title: "Commande",
      detail: "npm test",
      status: "done",
      output: "Tests en cours\n$ y",
      exitCode: 0,
      durationMs: 1250,
    });
  });

  it("actualise le patch courant et la progression MCP", () => {
    const withPatch = applyConversationEvent(
      applyConversationEvent([], {
        method: "item/started",
        params: {
          item: { id: "patch-1", type: "fileChange", status: "inProgress" },
        },
      }),
      {
        method: "item/fileChange/patchUpdated",
        params: {
          itemId: "patch-1",
          changes: [{ path: "src/App.tsx", diff: "+nouvelle ligne" }],
        },
      },
    );
    const withTurnDiff = applyConversationEvent(withPatch, {
      method: "turn/diff/updated",
      params: { turnId: "turn-1", diff: "diff --git a/src/App.tsx" },
    });
    const withMcp = applyConversationEvent(
      applyConversationEvent(withTurnDiff, {
        method: "item/started",
        params: {
          item: {
            id: "mcp-1",
            type: "mcpToolCall",
            server: "github",
            tool: "search",
          },
        },
      }),
      {
        method: "item/mcpToolCall/progress",
        params: { itemId: "mcp-1", message: "Lecture de la page 2" },
      },
    );

    expect(withMcp[0].tools).toEqual([
      expect.objectContaining({
        id: "patch-1",
        detail: "src/App.tsx",
        diff: "diff --git a/src/App.tsx",
      }),
      expect.objectContaining({
        id: "mcp-1",
        progress: "Lecture de la page 2",
      }),
    ]);
  });

  it("ajoute et enrichit le raisonnement visible", () => {
    const started = applyConversationEvent([], {
      method: "item/started",
      params: { item: { id: "reasoning-1", type: "reasoning", summary: [] } },
    });
    const updated = applyConversationEvent(started, {
      method: "item/reasoning/summaryTextDelta",
      params: { itemId: "reasoning-1", delta: "Analyse" },
    });

    expect(updated[0].signals?.[0]).toMatchObject({
      id: "reasoning-1",
      kind: "reasoning",
      detail: "Analyse",
      status: "running",
    });
  });

  it("sépare les sections successives d’un résumé de raisonnement", () => {
    const started = applyConversationEvent([], {
      method: "item/started",
      params: { item: { id: "reasoning-1", type: "reasoning", summary: [] } },
    });
    const first = applyConversationEvent(started, {
      method: "item/reasoning/summaryTextDelta",
      params: { itemId: "reasoning-1", delta: "Analyse" },
    });
    const boundary = applyConversationEvent(first, {
      method: "item/reasoning/summaryPartAdded",
      params: { itemId: "reasoning-1", summaryIndex: 1 },
    });
    const second = applyConversationEvent(boundary, {
      method: "item/reasoning/summaryTextDelta",
      params: { itemId: "reasoning-1", delta: "Vérification" },
    });

    expect(second[0].signals?.[0].detail).toBe("Analyse\n\nVérification");
  });

  it("condense les raisonnements successifs dans une seule carte", () => {
    const first = applyConversationEvent([], {
      method: "item/started",
      params: {
        item: { id: "reasoning-1", type: "reasoning", summary: ["Analyse"] },
      },
    });
    const second = applyConversationEvent(first, {
      method: "item/started",
      params: {
        item: {
          id: "reasoning-2",
          type: "reasoning",
          summary: ["Vérification"],
        },
      },
    });

    expect(second[0].signals).toEqual([
      expect.objectContaining({
        id: "reasoning-2",
        kind: "reasoning",
        detail: "Analyse\n\nVérification",
      }),
    ]);
  });

  it("conserve des cartes distinctes lorsqu'un signal sépare les raisonnements", () => {
    const first = applyConversationEvent([], {
      method: "item/started",
      params: {
        item: { id: "reasoning-1", type: "reasoning", summary: ["Analyse"] },
      },
    });
    const plan = applyConversationEvent(first, {
      method: "item/started",
      params: { item: { id: "plan-1", type: "plan", text: "Exécution" } },
    });
    const second = applyConversationEvent(plan, {
      method: "item/started",
      params: {
        item: {
          id: "reasoning-2",
          type: "reasoning",
          summary: ["Vérification"],
        },
      },
    });

    expect(second[0].signals?.map(({ id }) => id)).toEqual([
      "reasoning-1",
      "plan-1",
      "reasoning-2",
    ]);
  });

  it("matérialise un message agent reçu uniquement à sa complétion", () => {
    expect(
      applyConversationEvent([], {
        method: "item/completed",
        params: {
          item: { id: "answer", type: "agentMessage", text: "Terminé" },
        },
      }),
    ).toEqual([{ id: "answer", role: "assistant", content: "Terminé" }]);
  });

  it("termine un hook dans sa carte initiale même après un nouveau message", () => {
    const started = applyConversationEvent([], {
      method: "hook/started",
      params: {
        run: {
          id: "lint",
          eventName: "postToolUse",
          status: "running",
          entries: [],
        },
      },
    });
    const withText = [
      ...started,
      { id: "answer", role: "assistant" as const, content: "Suite" },
    ];
    const completed = applyConversationEvent(withText, {
      method: "hook/completed",
      params: {
        run: {
          id: "lint",
          eventName: "postToolUse",
          status: "completed",
          entries: [],
        },
      },
    });

    expect(completed[0].signals?.[0]).toMatchObject({
      id: "hook-lint",
      status: "done",
    });
    expect(completed[1].signals).toBeUndefined();
  });

  it("conserve la même collection pour un événement sans effet visuel", () => {
    const messages = [assistantMessage];

    expect(
      applyConversationEvent(messages, {
        method: "thread/started",
        params: {},
      }),
    ).toBe(messages);
  });
});
