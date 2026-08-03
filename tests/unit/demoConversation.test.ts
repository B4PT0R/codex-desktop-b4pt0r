import { describe, expect, it } from "vitest";
import {
  demoConversation,
  demoQuotas,
  demoSubagentTranscripts,
  demoTelemetry,
  demoThreads,
  readmeDemoConversation,
  readmeDemoThreads,
} from "../../src/lib/demoConversation";

describe("conversation de démonstration", () => {
  it("couvre messages, signaux et plusieurs sortes d’outils", () => {
    const messages = demoConversation();
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "assistant",
    ]);
    expect(messages.at(-2)?.modality).toBe("realtimeText");
    expect(messages.at(-1)?.modality).toBe("realtimeVoice");
    expect(messages.flatMap((message) => message.signals ?? [])).toHaveLength(3);
    expect(
      new Set(
        messages
          .flatMap((message) => message.tools ?? [])
          .map((tool) => tool.kind),
      ),
    ).toEqual(
      new Set([
        "webSearch",
        "commandExecution",
        "fileChange",
        "imageGeneration",
        "collabAgentToolCall",
      ]),
    );
    expect(demoSubagentTranscripts["demo-child-thread"].messages).toHaveLength(
      2,
    );
  });

  it("fournit une jauge de contexte réaliste", () => {
    expect(demoTelemetry.context).toEqual(
      expect.objectContaining({
        percentUsed: 41,
        windowTokens: 128_000,
      }),
    );
  });

  it("présente les quotas sur cinq heures et sept jours", () => {
    expect(demoQuotas).toEqual([
      expect.objectContaining({ durationMinutes: 300, used: 34 }),
      expect.objectContaining({ durationMinutes: 10_080, used: 14 }),
    ]);
  });

  it("remplit la sidebar avec plusieurs projets et états de conversation", () => {
    expect(
      new Set(demoThreads.map((thread) => thread.cwd)).size,
    ).toBeGreaterThan(5);
    expect(demoThreads.length).toBeGreaterThan(12);
    expect(demoThreads.some((thread) => thread.status === "active")).toBe(true);
    expect(demoThreads.some((thread) => thread.status === "systemError")).toBe(
      true,
    );
  });

  it("fournit une démonstration README entièrement en anglais", () => {
    const messages = readmeDemoConversation();
    expect(messages[0]?.content).toContain("workspace navigation");
    expect(messages.flatMap((message) => message.signals ?? [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Plan" }),
        expect.objectContaining({ title: "Context compacted" }),
      ]),
    );
    expect(readmeDemoThreads[0]?.name).toBe("Polish the Electron interface");
    expect(readmeDemoThreads.length).toBeGreaterThan(10);
  });
});
