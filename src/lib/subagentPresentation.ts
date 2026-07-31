import type {
  SubagentStatus,
  SubagentTranscript,
  ToolCall,
} from "../types";

export function presentSubagentTools(
  tools: ToolCall[],
  transcripts: Record<string, SubagentTranscript>,
  backgroundToolIds: ReadonlySet<string> | undefined,
  stepClosed: boolean,
) {
  const background = new Set(backgroundToolIds);
  const presented = tools.map((tool, index) => {
    if (tool.kind !== "collabAgentToolCall" || !tool.subagent) return tool;
    const status = combinedStatus(tool, transcripts);
    if (
      status === "running" &&
      (stepClosed || index < tools.length - 1)
    ) {
      background.add(tool.id);
    }
    return status === tool.status ? tool : { ...tool, status };
  });
  return {
    backgroundToolIds: background,
    tools: presented,
  };
}

function combinedStatus(
  tool: ToolCall,
  transcripts: Record<string, SubagentTranscript>,
): ToolCall["status"] {
  const statuses = tool.subagent!.threadIds.map(
    (threadId) =>
      transcripts[threadId]?.status ?? tool.subagent?.status ?? "pending",
  );
  if (statuses.length === 0) return tool.status;
  if (statuses.some((status) => status === "error")) return "error";
  if (statuses.some(isActive)) return "running";
  return "done";
}

function isActive(status: SubagentStatus) {
  return status === "pending" || status === "running";
}
