export type AutomationSchedule =
  | { type: "interval"; intervalMinutes: number }
  | { type: "once"; at: number }
  | { type: "weekly"; time: string; days: number[] };

export type AutomationTarget =
  | { type: "newThread" }
  | { type: "ephemeralThread" }
  | { type: "thread"; threadId: string };

export type Automation = {
  id: string;
  name: string;
  prompt: string;
  cwd?: string;
  enabled: boolean;
  unattendedAccess?: boolean;
  schedule: AutomationSchedule;
  target: AutomationTarget;
  nextRunAt?: number;
  lastRunAt?: number;
  lastStatus?: "running" | "succeeded" | "failed";
  lastThreadId?: string;
  lastError?: string;
  activeRunId?: string;
};

export type AutomationDraft = Omit<
  Automation,
  | "id"
  | "nextRunAt"
  | "lastRunAt"
  | "lastStatus"
  | "lastThreadId"
  | "lastError"
  | "activeRunId"
> & { id?: string };

export type AutomationsController = {
  automations: Automation[];
  error?: string;
  loading: boolean;
  deleteAutomation: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  runNow: (id: string) => Promise<boolean>;
  save: (draft: AutomationDraft) => Promise<Automation | undefined>;
};
