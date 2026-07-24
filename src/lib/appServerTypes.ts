export type AppServerModel = {
  id: string;
  displayName?: string;
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
  path?: string;
};

export type AppServerThreadItem = {
  [key: string]: unknown;
  id: string;
  type: string;
  text?: string;
  content?: AppServerInput[];
  summary?: string[];
};

export type AppServerTurn = {
  id?: string;
  items?: AppServerThreadItem[];
};

export type AppServerThread = {
  id: string;
  name?: string | null;
  preview?: string;
  updatedAt?: number;
  cwd?: string;
  status?: { type?: string; activeFlags?: string[] };
  turns?: AppServerTurn[];
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
export type ThreadStartResponse = { thread: AppServerThread; cwd?: string };
export type ThreadForkResponse = { thread: AppServerThread; cwd: string };
export type ThreadResumeResponse = {
  thread: AppServerThread;
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

export type AppInfo = {
  id: string;
  name: string;
  description: string | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: string[];
};

export type AppsListResponse = {
  data: AppInfo[];
  nextCursor: string | null;
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
