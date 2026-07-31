import { describe, expect, it } from "vitest";
import { presentSubagentTools } from "../../src/lib/subagentPresentation";
import type { SubagentTranscript, ToolCall } from "../../src/types";

const childTool: ToolCall = {
  id: "spawn-1",
  kind: "collabAgentToolCall",
  title: "New agent",
  detail: "Audit",
  status: "running",
  subagent: { threadIds: ["child-1"], status: "running" },
};

function transcript(
  status: SubagentTranscript["status"],
): SubagentTranscript {
  return { messages: [], status };
}

describe("présentation des sous-agents", () => {
  it("conserve l’action ouverte tant qu’elle travaille seule", () => {
    const result = presentSubagentTools(
      [childTool],
      { "child-1": transcript("running") },
      undefined,
      false,
    );
    expect(result.tools[0].status).toBe("running");
    expect(result.backgroundToolIds.has("spawn-1")).toBe(false);
  });

  it("la replie pour laisser arriver l’action parent suivante", () => {
    const nextTool: ToolCall = {
      ...childTool,
      id: "next-1",
      kind: "webSearch",
      subagent: undefined,
    };
    const result = presentSubagentTools(
      [childTool, nextTool],
      { "child-1": transcript("running") },
      undefined,
      false,
    );
    expect(result.backgroundToolIds.has("spawn-1")).toBe(true);
    expect(result.backgroundToolIds.has("next-1")).toBe(false);
  });

  it("résout l’action à la fin du tour enfant", () => {
    expect(
      presentSubagentTools(
        [childTool],
        { "child-1": transcript("completed") },
        undefined,
        true,
      ).tools[0].status,
    ).toBe("done");
    expect(
      presentSubagentTools(
        [childTool],
        { "child-1": transcript("error") },
        undefined,
        true,
      ).tools[0].status,
    ).toBe("error");
  });
});
