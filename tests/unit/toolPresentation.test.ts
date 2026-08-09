import { describe, expect, it } from "vitest";
import {
  appendToolOutput,
  normalizeTerminalOutput,
  toolFromItem,
  toolStatus,
} from "../../src/lib/toolPresentation";
import { translate } from "../../src/i18n/translate";

describe("feedbacks d’outils", () => {
  it.each([
    "reasoning",
    "plan",
    "agentMessage",
    "userMessage",
    "hookPrompt",
    "enteredReviewMode",
    "exitedReviewMode",
    "contextCompaction",
  ])("exclut %s", (type) =>
    expect(toolFromItem({ id: "1", type })).toBeUndefined(),
  );

  it("reconstruit une délégation depuis l’activité native du sous-agent", () => {
    expect(
      toolFromItem({
        id: "spawn-1",
        type: "subAgentActivity",
        kind: "started",
        agentThreadId: "child-1",
        agentPath: "/root/audit",
      }),
    ).toMatchObject({
      id: "spawn-1",
      kind: "collabAgentToolCall",
      title: "Nouvel agent",
      detail: "/root/audit",
      status: "running",
      subagent: { threadIds: ["child-1"], status: "running" },
    });
  });

  it.each([
    ["commandExecution", { command: "cargo test" }, "Commande", "cargo test"],
    [
      "fileChange",
      { changes: [{ path: "src/App.tsx" }] },
      "Modification de fichiers",
      "src/App.tsx",
    ],
    [
      "mcpToolCall",
      { server: "github", tool: "get_pr" },
      "get_pr",
      "MCP · github",
    ],
    [
      "dynamicToolCall",
      { namespace: "demo", tool: "run" },
      "run",
      "Outil · demo",
    ],
    [
      "collabAgentToolCall",
      { tool: "spawnAgent", prompt: "Analyse" },
      "Nouvel agent",
      "Analyse",
    ],
    ["webSearch", { query: "Codex docs" }, "Recherche web", "Codex docs"],
    ["imageView", { path: "/tmp/a.png" }, "Lecture d’image", "/tmp/a.png"],
    ["sleep", { durationMs: 1500 }, "Attente", "1.5 s"],
    ["imageGeneration", { prompt: "Un chat" }, "Génération d’image", "Un chat"],
  ])("présente %s", (type, data, title, detail) =>
    expect(toolFromItem({ id: "1", type, ...data })).toMatchObject({
      title,
      detail,
    }),
  );

  it("traduit les statuts terminaux", () => {
    expect(toolStatus({ status: "completed" })).toBe("done");
    expect(toolStatus({ status: "failed" })).toBe("error");
    expect(toolStatus({ status: "declined" })).toBe("error");
    expect(toolStatus({}, true)).toBe("done");
  });

  it("garde l’action de délégation active pendant le tour du sous-agent", () => {
    const item = {
      id: "collab-1",
      type: "collabAgentToolCall",
      tool: "spawnAgent",
      status: "completed",
      receiverThreadIds: ["child-1"],
      prompt: "Audite le transport",
      model: "gpt-5.4",
      reasoningEffort: "high",
      agentsStates: { "child-1": { status: "running" } },
    };
    expect(toolStatus(item, true)).toBe("running");
    expect(toolFromItem(item)).toMatchObject({
      status: "running",
      subagent: {
        threadIds: ["child-1"],
        prompt: "Audite le transport",
        model: "gpt-5.4",
        reasoningEffort: "high",
        status: "running",
      },
    });
    expect(
      toolStatus({
        ...item,
        agentsStates: { "child-1": { status: "completed" } },
      }),
    ).toBe("done");
  });

  it("laisse les autres appels de collaboration sous forme d’actions simples", () => {
    const wait = toolFromItem({
      id: "wait-1",
      type: "collabAgentToolCall",
      tool: "wait",
      status: "completed",
      receiverThreadIds: ["child-1"],
      agentsStates: { "child-1": { status: "running" } },
    });
    expect(wait?.status).toBe("done");
    expect(wait?.subagent).toBeUndefined();
  });

  it("présente prudemment un outil partiellement formé", () => {
    expect(
      toolFromItem({ id: "1", type: "fileChange", changes: [null, {}] }),
    ).toMatchObject({ detail: "Préparation des changements" });
    expect(
      toolFromItem({ id: "1", type: "sleep", durationMs: -1 }),
    ).toMatchObject({ detail: "En cours" });
    expect(toolFromItem({ type: "commandExecution" })).toBeUndefined();
  });

  it("normalise une image générée sans conserver de résultat invalide", () => {
    expect(
      toolFromItem({
        id: "image-1",
        type: "imageGeneration",
        status: "completed",
        revisedPrompt: "Un carré bleu",
        result: "iVBORw0KGgo=",
        savedPath: "/tmp/square.png",
      }),
    ).toMatchObject({
      detail: "Un carré bleu",
      artifacts: [
        {
          type: "generatedImage",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
          path: "/tmp/square.png",
          prompt: "Un carré bleu",
        },
      ],
    });
    expect(
      toolFromItem({
        id: "image-2",
        type: "imageGeneration",
        status: "completed",
        result: "not base64!",
      })?.artifacts,
    ).toBeUndefined();
  });

  it("borne et filtre les résultats web à des liens sûrs reconnus", () => {
    const tool = toolFromItem({
      id: "search-1",
      type: "webSearch",
      query: "Codex docs",
      results: [
        {
          type: "text_result",
          title: "Documentation Codex",
          url: "https://developers.openai.com/codex/",
          snippet: "Documentation officielle",
        },
        { type: "future_result", url: "https://example.com/future" },
        { type: "text_result", url: "javascript:alert(1)" },
      ],
    });

    expect(tool?.artifacts).toEqual([
      {
        type: "webResult",
        title: "Documentation Codex",
        url: "https://developers.openai.com/codex/",
        snippet: "Documentation officielle",
      },
    ]);
  });

  it("présente une navigation web même sans liste de résultats", () => {
    expect(
      toolFromItem({
        id: "open-1",
        type: "webSearch",
        query: "Page",
        action: { type: "openPage", url: "https://example.com/page" },
      })?.artifacts,
    ).toEqual([
      {
        type: "webResult",
        title: "https://example.com/page",
        url: "https://example.com/page",
      },
    ]);
  });

  it("borne les sorties longues en conservant leur fin", () => {
    const output = appendToolOutput("a".repeat(50_000), "fin");
    expect(output).toContain("[sortie précédente tronquée]");
    expect(output.endsWith("fin")).toBe(true);
    expect(output.length).toBeLessThan(50_100);
  });

  it("interprète les réécritures de progression ANSI du terminal", () => {
    const streamed = [1, 2, 3]
      .reduce(
        (output, step) => appendToolOutput(
          output,
          `\u001b[2K\u001b[1Grendering chunks (${step})...`,
        ),
        "",
      );
    expect(streamed).toBe("rendering chunks (3)...");
    expect(normalizeTerminalOutput(
      "\u001b[32mready\u001b[0m\n\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007",
    )).toBe("ready\nlink");
  });

  it("normalise aussi la sortie agrégée au replay", () => {
    expect(toolFromItem({
      id: "vite",
      type: "commandExecution",
      command: "npm run build",
      aggregatedOutput:
        "rendering chunks (1)...\u001b[2K\u001b[1Grendering chunks (8)...",
    })?.output).toBe("rendering chunks (8)...");
  });

  it("présente les outils avec le pack anglais", () => {
    const t = (
      key: Parameters<typeof translate>[1],
      params?: Record<string, string | number>,
    ) => translate("en", key, params);
    expect(
      toolFromItem({ id: "1", type: "fileChange", changes: [] }, t),
    ).toMatchObject({ title: "File changes", detail: "Preparing changes" });
    expect(toolFromItem({ id: "2", type: "webSearch" }, t)).toMatchObject({
      title: "Web search",
      detail: "Search in progress",
    });
  });
});
