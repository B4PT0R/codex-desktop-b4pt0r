import type { Translate } from "../i18n/translate";
import type { PermissionProfileSummary } from "../lib/appServerTypes";
import type { ApprovalPolicy, Permission } from "../lib/protocol";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import {
  autoReviewActionLabel,
  type AutoReviewDenial,
} from "../lib/autoReviewDenials";
import type { Model } from "../types";
import {
  normalizePermission,
  permissionDetail,
  permissionLabel,
} from "./permissionPresentation";

export function modelCommandChoices(models: Model[], selectedModel: string) {
  return models.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    detail: candidate.id,
    selected: candidate.id === selectedModel,
  }));
}

export function reasoningCommandChoices(
  models: Model[],
  selectedModel: string,
  effort: string,
  t: Translate,
) {
  const model = models.find((candidate) => candidate.id === selectedModel);
  return (
    model?.supportedReasoningEfforts ?? [
      { reasoningEffort: effort, description: "" },
    ]
  ).map((option) => ({
    id: option.reasoningEffort,
    label: reasoningEffortLabel(option.reasoningEffort, t),
    detail: option.description || undefined,
    selected: option.reasoningEffort === effort,
  }));
}

export function permissionCommandChoices(
  profiles: PermissionProfileSummary[],
  permission: Permission,
  t: Translate,
) {
  return profiles.map((profile) => ({
    id: profile.id,
    label: permissionLabel(profile.id, t),
    detail: profile.description || permissionDetail(profile.id, t),
    selected:
      normalizePermission(profile.id) === normalizePermission(permission),
    disabled: !profile.allowed,
  }));
}

export function approvalCommandChoices(
  allowed: ApprovalPolicy[] | undefined,
  selectedPolicy: ApprovalPolicy,
  t: Translate,
) {
  return (["untrusted", "on-request", "never"] as const).map((policy) => ({
    id: policy,
    label: t(`approvalPolicy.${policy}`),
    detail: t(`approvalPolicy.${policy}.detail`),
    selected: policy === selectedPolicy,
    disabled: allowed !== undefined && !allowed.includes(policy),
  }));
}

export function autoReviewCommandChoices(
  denials: AutoReviewDenial[],
  t: Translate,
) {
  return denials.map((denial) => ({
    id: denial.id,
    label: autoReviewActionLabel(denial.action, t),
    detail: denial.rationale,
  }));
}
