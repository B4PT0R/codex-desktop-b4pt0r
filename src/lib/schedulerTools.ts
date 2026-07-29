import type {
  Automation,
  AutomationDraft,
  AutomationSchedule,
  AutomationTarget,
} from "./automations";

export const SCHEDULER_TOOL_NAMESPACE = "scheduler";

type JsonSchema = Record<string, unknown>;

type DynamicTool = {
  type: "function";
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type DynamicToolNamespace = {
  type: "namespace";
  name: string;
  description: string;
  tools: DynamicTool[];
};

export type SchedulerToolCall = {
  requestId: number | string;
  threadId: string;
  tool: string;
  arguments: Record<string, unknown>;
};

export type DynamicToolResponse = {
  contentItems: Array<{ type: "inputText"; text: string }>;
  success: boolean;
};

const scheduleSchema: JsonSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "at"],
      properties: {
        type: { const: "once" },
        at: {
          type: "string",
          description:
            "ISO 8601 date and time. Include a UTC offset when possible.",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "intervalMinutes"],
      properties: {
        type: { const: "interval" },
        intervalMinutes: { type: "integer", minimum: 5, maximum: 10080 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "time", "days"],
      properties: {
        type: { const: "weekly" },
        time: {
          type: "string",
          pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
          description: "Local time in HH:MM format.",
        },
        days: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "integer",
            minimum: 0,
            maximum: 6,
            description: "Day of week, Sunday=0 through Saturday=6.",
          },
        },
      },
    },
  ],
};

const targetSchema: JsonSchema = {
  type: "string",
  enum: ["currentThread", "newThread", "ephemeralThread"],
  description:
    "Where each run executes. Defaults to currentThread. New threads use the task workspace.",
};

export function schedulerDynamicTools(): DynamicToolNamespace[] {
  return [
    {
      type: "namespace",
      name: SCHEDULER_TOOL_NAMESPACE,
      description:
        "Manage Codex Desktop scheduled tasks. Use only when the user explicitly asks to inspect, create, change, run, enable, disable, or delete a scheduled task.",
      tools: [
        tool("list", "List the user's scheduled tasks and their current state.", {
          type: "object",
          additionalProperties: false,
          properties: {},
        }),
        tool(
          "create",
          "Create a scheduled task. Confirm the intended schedule and prompt with the user before calling.",
          {
            type: "object",
            additionalProperties: false,
            required: ["name", "prompt", "schedule"],
            properties: {
              name: { type: "string", minLength: 1 },
              prompt: { type: "string", minLength: 1 },
              schedule: scheduleSchema,
              target: targetSchema,
              cwd: {
                type: "string",
                description:
                  "Absolute workspace path. Omit to use the current workspace.",
              },
              unattendedAccess: {
                type: "boolean",
                description:
                  "Run with full filesystem/network access and never ask for approval. Use only when the user explicitly requests unattended execution and understands the risk.",
              },
            },
          },
        ),
        tool(
          "update",
          "Update selected fields of an existing scheduled task. Unspecified fields remain unchanged.",
          {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: {
              id: { type: "string", minLength: 1 },
              name: { type: "string", minLength: 1 },
              prompt: { type: "string", minLength: 1 },
              schedule: scheduleSchema,
              target: targetSchema,
              cwd: {
                type: ["string", "null"],
                description:
                  "Absolute workspace path, or null to use the global default.",
              },
              unattendedAccess: {
                type: "boolean",
                description:
                  "Enable or disable full-access, never-ask unattended execution.",
              },
            },
          },
        ),
        tool(
          "set_enabled",
          "Enable or disable an existing scheduled task without changing its schedule.",
          {
            type: "object",
            additionalProperties: false,
            required: ["id", "enabled"],
            properties: {
              id: { type: "string", minLength: 1 },
              enabled: { type: "boolean" },
            },
          },
        ),
        tool("run_now", "Queue an existing scheduled task to run now.", {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string", minLength: 1 } },
        }),
        tool(
          "delete",
          "Permanently delete a scheduled task. The desktop client will ask the user for confirmation.",
          {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: { id: { type: "string", minLength: 1 } },
          },
        ),
      ],
    },
  ];
}

export function schedulerToolCallFromMessage(
  message: {
    id?: number | string;
    method?: string;
    params?: unknown;
  },
): SchedulerToolCall | undefined {
  if (message.method !== "item/tool/call" || message.id === undefined) {
    return undefined;
  }
  const params = record(message.params);
  if (
    params?.namespace !== SCHEDULER_TOOL_NAMESPACE ||
    typeof params.threadId !== "string" ||
    typeof params.tool !== "string"
  ) {
    return undefined;
  }
  const args = record(params.arguments);
  if (!args) throw new Error("Scheduler tool arguments must be an object.");
  return {
    requestId: message.id,
    threadId: params.threadId,
    tool: params.tool,
    arguments: args,
  };
}

export function automationDraftFromCreate(
  args: Record<string, unknown>,
  currentThreadId: string,
): AutomationDraft {
  return {
    name: requiredString(args.name, "name"),
    prompt: requiredString(args.prompt, "prompt"),
    enabled: true,
    unattendedAccess: args.unattendedAccess === true,
    schedule: parseSchedule(args.schedule),
    target: parseTarget(args.target, currentThreadId),
    ...(optionalString(args.cwd, "cwd") ? { cwd: args.cwd as string } : {}),
  };
}

export function automationDraftFromUpdate(
  current: Automation,
  args: Record<string, unknown>,
  currentThreadId: string,
): AutomationDraft {
  const cwd =
    args.cwd === null
      ? undefined
      : args.cwd === undefined
        ? current.cwd
        : optionalString(args.cwd, "cwd");
  return {
    id: current.id,
    name:
      args.name === undefined
        ? current.name
        : requiredString(args.name, "name"),
    prompt:
      args.prompt === undefined
        ? current.prompt
        : requiredString(args.prompt, "prompt"),
    enabled: current.enabled,
    unattendedAccess:
      args.unattendedAccess === undefined
        ? current.unattendedAccess
        : booleanValue(args.unattendedAccess, "unattendedAccess"),
    schedule:
      args.schedule === undefined
        ? current.schedule
        : parseSchedule(args.schedule),
    target:
      args.target === undefined
        ? current.target
        : parseTarget(args.target, currentThreadId),
    ...(cwd ? { cwd } : {}),
  };
}

export function dynamicToolSuccess(value: unknown): DynamicToolResponse {
  return dynamicToolResponse(true, value);
}

export function dynamicToolFailure(error: unknown): DynamicToolResponse {
  return dynamicToolResponse(false, {
    error: error instanceof Error ? error.message : String(error),
  });
}

function tool(
  name: string,
  description: string,
  inputSchema: JsonSchema,
): DynamicTool {
  return { type: "function", name, description, inputSchema };
}

function parseSchedule(value: unknown): AutomationSchedule {
  const schedule = record(value);
  if (!schedule) throw new Error("schedule must be an object.");
  if (schedule.type === "once") {
    const at = Date.parse(requiredString(schedule.at, "schedule.at"));
    if (!Number.isFinite(at)) {
      throw new Error("schedule.at must be a valid ISO 8601 date and time.");
    }
    return { type: "once", at };
  }
  if (schedule.type === "interval") {
    const intervalMinutes = schedule.intervalMinutes;
    if (
      typeof intervalMinutes !== "number" ||
      !Number.isInteger(intervalMinutes) ||
      intervalMinutes < 5 ||
      intervalMinutes > 10080
    ) {
      throw new Error(
        "schedule.intervalMinutes must be an integer from 5 to 10080.",
      );
    }
    return { type: "interval", intervalMinutes };
  }
  if (schedule.type === "weekly") {
    const time = requiredString(schedule.time, "schedule.time");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("schedule.time must use HH:MM.");
    }
    if (
      !Array.isArray(schedule.days) ||
      schedule.days.length === 0 ||
      schedule.days.some(
        (day) =>
          typeof day !== "number" ||
          !Number.isInteger(day) ||
          day < 0 ||
          day > 6,
      )
    ) {
      throw new Error("schedule.days must contain weekdays from 0 to 6.");
    }
    return { type: "weekly", time, days: [...new Set(schedule.days)] };
  }
  throw new Error("Unsupported schedule type.");
}

function parseTarget(
  value: unknown,
  currentThreadId: string,
): AutomationTarget {
  if (value === undefined || value === "currentThread") {
    return { type: "thread", threadId: currentThreadId };
  }
  if (value === "newThread") return { type: "newThread" };
  if (value === "ephemeralThread") return { type: "ephemeralThread" };
  throw new Error("Unsupported target.");
}

function dynamicToolResponse(
  success: boolean,
  value: unknown,
): DynamicToolResponse {
  return {
    success,
    contentItems: [
      {
        type: "inputText",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown, name: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  const trimmed = value.trim();
  return trimmed || undefined;
}

function booleanValue(value: unknown, name: string) {
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean.`);
  return value;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
