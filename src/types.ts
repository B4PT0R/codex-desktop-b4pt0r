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
  subagent?: {
    threadIds: string[];
    prompt?: string;
    model?: string;
    reasoningEffort?: string;
    status?: SubagentStatus;
  };
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
export type SubagentStatus =
  | "pending"
  | "running"
  | "completed"
  | "interrupted"
  | "error";
export type SubagentTranscript = {
  messages: ChatMessage[];
  status: SubagentStatus;
  name?: string;
  role?: string;
  path?: string;
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
  /** App Server classification used to distinguish narration from final text. */
  phase?: "commentary" | "final_answer";
  /** Distinguishes assistant and client-owned presentation surfaces. */
  modality?:
    | "realtimeVoice"
    | "realtimeText"
    | "applicationError"
    | "scheduledTask"
    | "commandResult";
  /** Client-owned heading for an application error card. */
  title?: string;
  content: string;
  tools?: ToolCall[];
  signals?: AgentSignal[];
  streaming?: boolean;
  attachments?: string[];
  /** Explicit skill input items attached to this user turn. */
  skills?: Array<{ name: string }>;
  memoryCitations?: MemoryCitation[];
};
export type MemoryCitation = {
  path: string;
  lineStart: number;
  lineEnd: number;
  note: string;
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
  isDefault?: boolean;
  serviceTiers?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
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
  isPinned?: boolean;
  name?: string | null;
  preview?: string;
  updatedAt?: number;
  cwd?: string;
  status?: ThreadStatus;
  searchSnippet?: string;
  section?: { id: string; name: string };
};
