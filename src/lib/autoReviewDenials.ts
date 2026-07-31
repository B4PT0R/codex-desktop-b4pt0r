import type { Translate } from "../i18n/translate";

export type AutoReviewDenial = {
  action: Record<string, unknown>;
  id: string;
  rationale?: string;
  threadId: string;
};

export function autoReviewDenialFromMessage(message: {
  method?: string;
  params?: unknown;
}): AutoReviewDenial | undefined {
  if (message.method !== "item/autoApprovalReview/completed") return undefined;
  const params = record(message.params);
  const review = record(params?.review);
  const action = record(params?.action);
  const threadId = boundedText(params?.threadId, 1_024);
  const reviewId = boundedText(params?.reviewId, 1_024);
  if (
    review?.status !== "denied" ||
    !action ||
    !threadId ||
    !reviewId ||
    JSON.stringify(action).length > 65_536
  )
    return undefined;
  return {
    action,
    id: reviewId,
    rationale: boundedText(review.rationale, 4_096),
    threadId,
  };
}

export function autoReviewActionLabel(
  action: Record<string, unknown>,
  t: Translate,
) {
  if (action.type === "command" && typeof action.command === "string")
    return shortLabel(action.command);
  if (action.type === "execve" && Array.isArray(action.argv))
    return shortLabel(
      action.argv.filter((part) => typeof part === "string").join(" "),
    );
  if (action.type === "applyPatch" && Array.isArray(action.files))
    return t("composer.approve.patch", {
      files: action.files.filter((file) => typeof file === "string").join(", "),
    });
  if (action.type === "networkAccess" && typeof action.target === "string")
    return t("composer.approve.network", { target: action.target });
  if (action.type === "mcpToolCall" && typeof action.toolName === "string")
    return t("composer.approve.mcp", { tool: action.toolName });
  if (action.type === "requestPermissions")
    return t("composer.approve.permissions");
  return t("composer.approve.action");
}

function shortLabel(value: string) {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length > 180 ? `${singleLine.slice(0, 179)}…` : singleLine;
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
