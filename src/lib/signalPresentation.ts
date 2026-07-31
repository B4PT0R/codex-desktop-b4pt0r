import type { AgentSignal } from "../types";
import type { AppServerMessage } from "./codex";
import { defaultTranslate, type Translate } from "../i18n/translate";

const itemSignals = new Set([
  "reasoning",
  "plan",
  "subAgentActivity",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction",
  "hookPrompt",
]);

export function signalFromItem(
  item: unknown,
  t: Translate = defaultTranslate,
): AgentSignal | undefined {
  const value = record(item);
  const id = stringValue(value?.id);
  const type = stringValue(value?.type);
  if (!value || !id || !type || !itemSignals.has(type)) return undefined;

  switch (type) {
    case "reasoning": {
      const detail = stringArray(value?.summary)?.join("\n") ?? "";
      if (!detail.trim()) return undefined;
      return {
        id,
        kind: "reasoning",
        title: t("signal.reasoning"),
        detail,
        status: "running",
      };
    }
    case "plan":
      return {
        id,
        kind: "plan",
        title: t("signal.plan"),
        detail: stringValue(value?.text),
        status: "running",
      };
    case "subAgentActivity":
      // A start event is the only canonical live representation emitted by
      // some App Server builds for spawn_agent. It is rendered as the parent
      // tool action so the child transcript has one stable owner.
      if (value.kind === "started") return undefined;
      return {
        id,
        kind: "agent",
        title: t("signal.agent"),
        detail: agentActivity(value, t),
        status: "running",
      };
    case "enteredReviewMode":
      return reviewSignal(id, t("signal.review.running"), value, "running");
    case "exitedReviewMode":
      return reviewSignal(id, t("signal.review.done"), value, "done");
    case "contextCompaction":
      return {
        id,
        kind: "compaction",
        title: t("signal.compaction.running"),
        detail: t("signal.compaction.runningDetail"),
        status: "running",
      };
    case "hookPrompt":
      return {
        id,
        kind: "warning",
        title: t("signal.hook"),
        detail: t("signal.hook.detail"),
        status: "done",
      };
  }
}

export function signalFromNotification(
  message: AppServerMessage,
  t: Translate = defaultTranslate,
): AgentSignal | undefined {
  const params = record(message.params) ?? {};
  if (message.method === "client/protocol/error") {
    return {
      id: `protocol-${crypto.randomUUID()}`,
      kind: "warning",
      title: t("signal.protocol.title"),
      detail: t("signal.protocol.detail"),
      status: "error",
    };
  }
  if (message.method === "error") {
    const error = record(params.error);
    const retrying = params.willRetry === true;
    return {
      id: `error-${stringValue(params.turnId) ?? crypto.randomUUID()}`,
      kind: "warning",
      title: retrying ? t("signal.error.retrying") : t("signal.error.stopped"),
      detail: [
        stringValue(error?.message) ?? t("signal.error.appServer"),
        stringValue(error?.additionalDetails),
      ]
        .filter(Boolean)
        .join("\n\n"),
      status: retrying ? "running" : "error",
    };
  }
  if (message.method === "deprecationNotice") {
    return {
      id: `deprecation-${crypto.randomUUID()}`,
      kind: "warning",
      title: stringValue(params.summary) ?? t("signal.deprecated"),
      detail: stringValue(params.details),
      status: "error",
    };
  }
  if (message.method === "turn/plan/updated") {
    const steps = planSteps(params.plan);
    return {
      id: `plan-${stringValue(params.turnId) ?? "unknown"}`,
      kind: "plan",
      title: t("signal.plan"),
      detail: stringValue(params.explanation),
      status:
        steps.length > 0 && steps.every((step) => step.status === "completed")
          ? "done"
          : "running",
      steps,
    };
  }
  if (
    message.method === "hook/started" ||
    message.method === "hook/completed"
  ) {
    const run = record(params.run);
    const id = stringValue(run?.id);
    if (!id) return undefined;
    const completed = message.method === "hook/completed";
    const failed =
      run?.status === "failed" ||
      run?.status === "blocked" ||
      run?.status === "stopped";
    const entries = Array.isArray(run?.entries)
      ? run.entries
          .flatMap((entry) => {
            const value = record(entry);
            const text = boundedString(value?.text, 2_000);
            return text ? [text] : [];
          })
          .slice(0, 3)
      : [];
    return {
      id: `hook-${id}`,
      kind: failed ? "warning" : "agent",
      title:
        boundedString(run?.statusMessage, 256) ??
        t(completed ? "signal.hook.completed" : "signal.hook.running"),
      detail:
        entries.join("\n") ||
        t("signal.hook.event", {
          event: boundedString(run?.eventName, 128) ?? t("signal.hook.unknown"),
        }),
      status: failed ? "error" : completed ? "done" : "running",
    };
  }
  if (message.method === "model/verification") {
    const verifications = boundedStrings(params.verifications, 8, 128);
    if (verifications.length === 0) return undefined;
    return {
      id: `verification-${stringValue(params.turnId) ?? "unknown"}`,
      kind: "warning",
      title: t("signal.verification.title"),
      detail: t("signal.verification.detail"),
      status: "error",
    };
  }
  if (message.method === "model/safetyBuffering/updated") {
    const buffering = params.showBufferingUi === true;
    const fasterModel = boundedString(params.fasterModel, 128);
    return {
      id: `safety-buffering-${stringValue(params.turnId) ?? "unknown"}`,
      kind: "warning",
      title: t(
        buffering ? "signal.safetyBuffering.title" : "signal.safetyBuffering.done",
      ),
      detail: buffering
        ? t(
            fasterModel
              ? "signal.safetyBuffering.fasterModel"
              : "signal.safetyBuffering.detail",
            fasterModel ? { model: fasterModel } : undefined,
          )
        : undefined,
      status: buffering ? "running" : "done",
    };
  }
  if (
    message.method === "warning" ||
    message.method === "guardianWarning" ||
    message.method === "configWarning"
  ) {
    return {
      id: `warning-${crypto.randomUUID()}`,
      kind: "warning",
      title: stringValue(params.summary) ?? t("signal.warning"),
      detail: stringValue(params.details) ?? stringValue(params.message),
      status: "error",
    };
  }
  return undefined;
}

export function completedSignal(
  signal: AgentSignal,
  item: unknown,
  t: Translate = defaultTranslate,
): AgentSignal {
  const value = record(item);
  const type = stringValue(value?.type);
  if (type === "contextCompaction") {
    return {
      ...signal,
      title: t("signal.compaction"),
      detail: undefined,
      status: "done",
    };
  }
  const completedDetail =
    type === "reasoning"
      ? stringArray(value?.summary)?.join("\n")
      : (stringValue(value?.text) ?? stringValue(value?.review));
  const detail =
    completedDetail && signal.detail?.endsWith(completedDetail)
      ? signal.detail
      : completedDetail || signal.detail;
  return {
    ...signal,
    detail,
    status: type === "enteredReviewMode" ? "running" : "done",
  };
}

function reviewSignal(
  id: string,
  title: string,
  item: Record<string, unknown>,
  status: AgentSignal["status"],
): AgentSignal {
  return {
    id,
    kind: "review",
    title,
    detail: stringValue(item.review),
    status,
  };
}

function agentActivity(item: Record<string, unknown>, t: Translate) {
  const labels: Record<string, string> = {
    waiting: t("signal.agent.waiting"),
    tool: t("signal.agent.tool"),
    thinking: t("signal.agent.thinking"),
    message: t("signal.agent.message"),
  };
  const kind = stringValue(item.kind);
  return (
    (kind ? labels[kind] : undefined) ??
    stringValue(item.agentPath) ??
    t("signal.agent.active")
  );
}

function planSteps(value: unknown): NonNullable<AgentSignal["steps"]> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    const candidate = record(step);
    const text = stringValue(candidate?.step);
    const status = stringValue(candidate?.status);
    return text && status ? [{ step: text, status }] : [];
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function boundedStrings(value: unknown, count: number, length: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, count)
        .map((item) => item.slice(0, length))
    : [];
}

function boundedString(value: unknown, length: number) {
  return typeof value === "string" ? value.slice(0, length) : undefined;
}
