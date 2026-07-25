export type ToolCall = {
  id: string;
  kind:
    | "commandExecution"
    | "fileChange"
    | "mcpToolCall"
    | "dynamicToolCall"
    | "collabAgentToolCall"
    | "webSearch"
    | "imageView"
    | "sleep"
    | "imageGeneration";
  title: string;
  detail: string;
  status: "running" | "done" | "error";
  output?: string;
  diff?: string;
  progress?: string;
  exitCode?: number;
  durationMs?: number;
  artifacts?: ToolArtifact[];
};
export type ToolArtifact =
  | {
      type: "generatedImage";
      dataUrl?: string;
      path?: string;
      prompt?: string;
    }
  | {
      type: "webResult";
      title: string;
      url: string;
      snippet?: string;
    };
export type AgentSignal = {
  id: string;
  kind: "reasoning" | "plan" | "compaction" | "review" | "agent" | "warning";
  title: string;
  detail?: string;
  status: "running" | "done" | "error";
  steps?: Array<{ step: string; status: string }>;
};
export type ChatMessage = {
  id: string;
  /** App Server item shared by chronological UI segments of one agent message. */
  sourceItemId?: string;
  /** Keeps an accepted text delta hidden until the preceding activity folds. */
  revealAfter?: number;
  role: "user" | "assistant";
  /** Distinguishes assistant and client-owned presentation surfaces. */
  modality?: "realtimeVoice" | "realtimeText" | "applicationError";
  /** Client-owned heading for an application error card. */
  title?: string;
  content: string;
  tools?: ToolCall[];
  signals?: AgentSignal[];
  streaming?: boolean;
  attachments?: string[];
};
export type Approval = {
  requestId: number | string;
  kind: "command" | "file" | "permissions";
  title: string;
  description: string;
  command?: string;
  permissions?: Record<string, unknown>;
  allowSession: boolean;
};
export type Model = {
  id: string;
  label: string;
  supportedReasoningEfforts?: Array<{
    reasoningEffort: string;
    description: string;
  }>;
  defaultReasoningEffort?: string;
  supportsPersonality?: boolean;
};
export type Personality = "none" | "friendly" | "pragmatic";
export type CollaborationMode = "default" | "plan";
export type Quota = {
  used: number;
  durationMinutes: number | null;
  resetsAt: number | null;
};
export type ThreadStatus = "notLoaded" | "idle" | "active" | "systemError";
export type ThreadSummary = {
  id: string;
  name?: string | null;
  preview?: string;
  updatedAt?: number;
  cwd?: string;
  status?: ThreadStatus;
  searchSnippet?: string;
};
