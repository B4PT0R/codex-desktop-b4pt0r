export type AppServerModel = {
  id: string;
  displayName?: string;
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

export type ModelListResponse = {
  data?: AppServerModel[];
  models?: AppServerModel[];
};

export type ConfigReadResponse = {
  config: {
    model?: string | null;
    model_reasoning_effort?: string | null;
    approval_policy?: string | null;
    developer_instructions?: string | null;
    apps?: AppsConfiguration | null;
  };
};

export type AppToolApprovalMode = "auto" | "prompt" | "writes" | "approve";

export type AppToolConfiguration = {
  enabled?: boolean | null;
  approval_mode?: AppToolApprovalMode | null;
};

export type AppConfiguration = {
  enabled: boolean;
  approvals_reviewer?: "user" | "auto_review" | null;
  destructive_enabled?: boolean | null;
  open_world_enabled?: boolean | null;
  default_tools_approval_mode?: AppToolApprovalMode | null;
  default_tools_enabled?: boolean | null;
  tools?: Record<string, AppToolConfiguration> | null;
};

export type AppsConfiguration = {
  _default?: Omit<AppConfiguration, "default_tools_enabled" | "tools"> | null;
  [appId: string]: AppConfiguration | null | undefined;
};

export type RateLimitWindow = {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

export type RateLimitSnapshot = {
  primary?: RateLimitWindow | null;
  secondary?: RateLimitWindow | null;
  rateLimitReachedType?:
    | "rate_limit_reached"
    | "workspace_owner_credits_depleted"
    | "workspace_member_credits_depleted"
    | "workspace_owner_usage_limit_reached"
    | "workspace_member_usage_limit_reached"
    | null;
};

export type AccountRateLimitsResponse = {
  rateLimits: RateLimitSnapshot;
  rateLimitsByLimitId?: Record<string, RateLimitSnapshot> | null;
  rateLimitResetCredits: RateLimitResetCreditsSummary | null;
};

export type RateLimitResetCredit = {
  id: string;
  resetType: "codexRateLimits" | "unknown";
  status: "available" | "redeeming" | "redeemed" | "unknown";
  grantedAt: number;
  expiresAt: number | null;
  title: string | null;
  description: string | null;
};

export type RateLimitResetCreditsSummary = {
  availableCount: number;
  credits: RateLimitResetCredit[] | null;
};

export type ConsumeRateLimitResetCreditResponse = {
  outcome: "reset" | "nothingToReset" | "noCredit" | "alreadyRedeemed";
};

export type WorkspaceMessage = {
  messageId: string;
  messageType: "headline" | "announcement" | "unknown";
  messageBody: string;
  createdAt: number | null;
  archivedAt: number | null;
};

export type GetWorkspaceMessagesResponse = {
  featureEnabled: boolean;
  messages: WorkspaceMessage[];
};

export type SendCreditsNudgeResponse = {
  status: "sent" | "cooldown_active";
};

export type AppServerInput = {
  type: string;
  text?: string;
  name?: string;
  path?: string;
};

export type AppServerThreadItem = {
  [key: string]: unknown;
  id: string;
  type: string;
  text?: string;
  content?: AppServerInput[];
  summary?: string[];
  startedAtMs?: number;
  completedAtMs?: number;
};

export type AppServerTurn = {
  id?: string;
  items?: AppServerThreadItem[];
  status?: "completed" | "inProgress" | "failed" | "interrupted";
  error?: {
    message?: string;
    codexErrorInfo?: string | null;
    additionalDetails?: string | null;
  } | null;
  startedAt?: number | null;
  completedAt?: number | null;
  durationMs?: number | null;
};

export type AppServerThread = {
  id: string;
  parentThreadId?: string | null;
  agentNickname?: string | null;
  agentRole?: string | null;
  name?: string | null;
  preview?: string;
  updatedAt?: number;
  cwd?: string;
  status?: { type?: string; activeFlags?: string[] };
  turns?: AppServerTurn[];
  section?: { id: string; name: string } | null;
};

export type TurnsPage = {
  data: AppServerTurn[];
  nextCursor?: string | null;
  backwardsCursor?: string | null;
};

export type ThreadListResponse = {
  data?: AppServerThread[];
  nextCursor?: string | null;
};
export type ThreadSearchResponse = {
  data?: Array<{ thread: AppServerThread; snippet?: string }>;
  nextCursor?: string | null;
};
export type ActivePermissionProfile = {
  id: string;
  extends?: string | null;
};

export type SandboxPolicy = {
  type: "dangerFullAccess" | "externalSandbox" | "readOnly" | "workspaceWrite";
};

export type ThreadRuntimeResponse = {
  thread: AppServerThread;
  cwd: string;
  model: string;
  reasoningEffort?: string | null;
  approvalsReviewer?: string | null;
  serviceTier?: string | null;
  activePermissionProfile?: ActivePermissionProfile | null;
  sandbox?: SandboxPolicy;
  approvalPolicy?: string;
  instructionSources?: string[];
};

export type ThreadStartResponse = ThreadRuntimeResponse;
export type ThreadForkResponse = ThreadRuntimeResponse;
export type ThreadReadResponse = {
  thread: AppServerThread;
};
export type ThreadResumeResponse = {
  thread: AppServerThread;
  cwd: string;
  model: string;
  reasoningEffort?: string | null;
  activePermissionProfile?: ActivePermissionProfile | null;
  sandbox?: SandboxPolicy;
  initialTurnsPage?: TurnsPage | null;
};

export type ThreadTurnsListResponse = TurnsPage;

export type AppServerSkill = {
  name: string;
  description: string;
  shortDescription?: string;
  path: string;
  scope: string;
  enabled: boolean;
};

export type SkillsListResponse = {
  data: Array<{
    cwd: string;
    skills: AppServerSkill[];
    errors: Array<{ path: string; message: string }>;
  }>;
};

export type AppServerHook = {
  key: string;
  eventName: string;
  handlerType: string;
  matcher: string | null;
  command: string | null;
  timeoutSec: number;
  statusMessage: string | null;
  sourcePath: string;
  source: string;
  pluginId: string | null;
  displayOrder: number;
  enabled: boolean;
  isManaged: boolean;
  currentHash: string;
  trustStatus: string;
};

export type HooksListResponse = {
  data: Array<{
    cwd: string;
    hooks: AppServerHook[];
    warnings: string[];
    errors: Array<{ path: string; message: string }>;
  }>;
};

export type McpAuthStatus =
  "unsupported" | "notLoggedIn" | "bearerToken" | "oAuth";

export type McpServerStatus = {
  name: string;
  serverInfo: {
    name: string;
    title: string | null;
    version: string;
    description: string | null;
  } | null;
  tools: Record<string, unknown>;
  resources: unknown[];
  resourceTemplates: unknown[];
  authStatus: McpAuthStatus;
};

export type McpServerStartupState =
  | "starting"
  | "ready"
  | "failed"
  | "cancelled";

export type McpServerStartupStatus = {
  status: McpServerStartupState;
  error?: string;
  failureReason?: "reauthenticationRequired";
};

export type ListMcpServerStatusResponse = {
  data: McpServerStatus[];
  nextCursor: string | null;
};

export type PermissionProfileSummary = {
  id: string;
  description: string | null;
  allowed: boolean;
};

export type PermissionProfileListResponse = {
  data: PermissionProfileSummary[];
  nextCursor: string | null;
};

export type CollaborationModePreset = {
  name: string;
  mode: "default" | "plan" | null;
  model: string | null;
  reasoning_effort: string | null;
};

export type CollaborationModeListResponse = {
  data: CollaborationModePreset[];
};

export type Account =
  | { type: "apiKey" }
  | { type: "chatgpt"; email: string | null; planType: string }
  | { type: "amazonBedrock"; usesCodexManagedCredentials: boolean };

export type GetAccountResponse = {
  account: Account | null;
  requiresOpenaiAuth: boolean;
};

export type LoginAccountResponse =
  | { type: "apiKey" }
  | { type: "chatgpt"; loginId: string; authUrl: string }
  | {
      type: "chatgptDeviceCode";
      loginId: string;
      verificationUrl: string;
      userCode: string;
    };

export type AccountTokenUsageSummary = {
  lifetimeTokens: number | null;
  peakDailyTokens: number | null;
  longestRunningTurnSec: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
};

export type GetAccountTokenUsageResponse = {
  summary: AccountTokenUsageSummary;
  dailyUsageBuckets: Array<{ startDate: string; tokens: number }> | null;
};

export type RemoteControlConnectionStatus =
  "disabled" | "connecting" | "connected" | "errored";

export type RemoteControlStatus = {
  status: RemoteControlConnectionStatus;
  serverName: string;
  installationId: string;
  environmentId: string | null;
};

export type RemoteControlPairing = {
  pairingCode: string;
  manualPairingCode: string | null;
  environmentId: string;
  expiresAt: number;
};

export type RemoteControlClient = {
  clientId: string;
  displayName: string | null;
  deviceType: string | null;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  appVersion: string | null;
  lastSeenAt: number | null;
};

export type RemoteControlClientsListResponse = {
  data: RemoteControlClient[];
  nextCursor: string | null;
};

export type AppInfo = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  distributionChannel: string | null;
  branding: {
    category: string | null;
    developer: string | null;
    website: string | null;
    isDiscoverableApp: boolean;
  } | null;
  appMetadata: {
    categories: string[] | null;
    seoDescription: string | null;
    developer: string | null;
    version: string | null;
  } | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: string[];
};

export type AppsListResponse = {
  data: AppInfo[];
  nextCursor: string | null;
};

export type InstalledApp = {
  id: string;
  runtimeName: string | null;
  enabled: boolean;
  callable: boolean;
};

export type AppsInstalledResponse = { apps: InstalledApp[] };

export type AppToolSummary = {
  name: string;
  title: string | null;
  description: string;
  isEnabled: boolean;
  disabledReason: string | null;
  isReadOnly: boolean;
};

export type ConnectorMetadata = {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconUrlDark: string | null;
  distributionChannel: string | null;
  installUrl: string | null;
  pluginDisplayNames: string[];
  toolSummaries: AppToolSummary[] | null;
};

export type AppsReadResponse = {
  apps: ConnectorMetadata[];
  missingAppIds: string[];
};

export type ThreadGoalStatus =
  | "active"
  | "paused"
  | "blocked"
  | "usageLimited"
  | "budgetLimited"
  | "complete";

export type ThreadGoal = {
  threadId: string;
  objective: string;
  status: ThreadGoalStatus;
  tokenBudget: number | null;
  tokensUsed: number;
  timeUsedSeconds: number;
  createdAt: number;
  updatedAt: number;
};

export type ThreadGoalGetResponse = { goal: ThreadGoal | null };
export type ThreadGoalSetResponse = { goal: ThreadGoal };

export type ExternalAgentMigrationItemType =
  | "AGENTS_MD"
  | "CONFIG"
  | "SKILLS"
  | "PLUGINS"
  | "MCP_SERVER_CONFIG"
  | "SUBAGENTS"
  | "HOOKS"
  | "COMMANDS"
  | "MEMORY"
  | "SESSIONS";

export type ExternalAgentMigrationSource = "claude-code" | "cursor";

export const realtimeVoices = [
  "alloy",
  "arbor",
  "ash",
  "ballad",
  "breeze",
  "cedar",
  "coral",
  "cove",
  "echo",
  "ember",
  "juniper",
  "maple",
  "marin",
  "sage",
  "shimmer",
  "sol",
  "spruce",
  "vale",
  "verse",
] as const;

export type RealtimeVoice = (typeof realtimeVoices)[number];

export type RealtimeVoicesList = {
  v1: RealtimeVoice[];
  v2: RealtimeVoice[];
  defaultV1: RealtimeVoice;
  defaultV2: RealtimeVoice;
};

export type ExternalAgentMigrationDetails = {
  plugins?: Array<{ marketplaceName: string; pluginNames: string[] }>;
  skills?: Array<{ name: string }>;
  sessions?: Array<{ path: string; cwd: string; title?: string | null }>;
  mcpServers?: Array<{ name: string }>;
  hooks?: Array<{ name: string }>;
  subagents?: Array<{ name: string }>;
  commands?: Array<{ name: string }>;
  memory?: string[];
};

export type ExternalAgentMigrationItem = {
  itemType: ExternalAgentMigrationItemType;
  description: string;
  cwd?: string | null;
  details?: ExternalAgentMigrationDetails | null;
};

export type ExternalAgentImportSuccess = {
  itemType: ExternalAgentMigrationItemType;
  cwd?: string | null;
  source?: string | null;
  target?: string | null;
};

export type ExternalAgentImportFailure = {
  itemType: ExternalAgentMigrationItemType;
  errorType?: string | null;
  subErrorType?: string | null;
  failureStage: string;
  message: string;
  cwd?: string | null;
  source?: string | null;
};

export type ExternalAgentImportTypeResult = {
  itemType: ExternalAgentMigrationItemType;
  successes: ExternalAgentImportSuccess[];
  failures: ExternalAgentImportFailure[];
};

export type ExternalAgentImportHistory = {
  importId: string;
  completedAtMs: number;
  successes: ExternalAgentImportSuccess[];
  failures: ExternalAgentImportFailure[];
};

export type ExternalAgentImportHistoriesReadResponse = {
  data: ExternalAgentImportHistory[];
  connectors: Array<{
    name: string;
    sessionCount: number;
    source: "remoteMcpServersConfig";
  }>;
};
