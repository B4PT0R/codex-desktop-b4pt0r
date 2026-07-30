import { useRef } from "react";
import { request } from "./codex";
import {
  threadApprovalPolicyUpdateParams,
  threadBehaviorUpdateParams,
  threadPermissionUpdateParams,
  threadServiceTierUpdateParams,
  type ApprovalPolicy,
  type Permission,
} from "./protocol";
import type { CollaborationMode, Personality } from "../types";
import type { ThreadRuntimeController } from "./useThreadRuntimeState";

type MutationKey =
  | "approvalPolicy"
  | "collaborationMode"
  | "permission"
  | "serviceTier";

const mutationKeys: MutationKey[] = [
  "approvalPolicy",
  "collaborationMode",
  "permission",
  "serviceTier",
];

type Mutation<T> = {
  apply: (value: T) => void;
  key: MutationKey;
  next: T;
  params: (threadId: string) => unknown;
  previous: T;
};

export function useThreadRuntimeMutations({
  onError,
  personality,
  runtime,
  threadId,
}: {
  onError: (error: unknown) => void;
  personality?: Personality;
  runtime: ThreadRuntimeController;
  threadId?: string;
}) {
  const activeThreadRef = useRef(threadId);
  activeThreadRef.current = threadId;
  const generations = useRef<Record<MutationKey, number>>({
    approvalPolicy: 0,
    collaborationMode: 0,
    permission: 0,
    serviceTier: 0,
  });
  const generationThreadRef = useRef(threadId);
  // A response from a thread we left must never roll back hydrated state if
  // the user returns to that thread before the response finally arrives.
  if (generationThreadRef.current !== threadId) {
    generationThreadRef.current = threadId;
    for (const key of mutationKeys) {
      generations.current[key] += 1;
    }
  }

  async function mutate<T>({
    apply,
    key,
    next,
    params,
    previous,
  }: Mutation<T>) {
    apply(next);
    const targetThreadId = threadId;
    if (!targetThreadId) return true;

    const generation = ++generations.current[key];
    try {
      await request("thread/settings/update", params(targetThreadId));
      return true;
    } catch (error) {
      // Only the latest write for the currently displayed thread owns rollback
      // and error presentation; superseded failures are no longer actionable.
      const stillCurrent =
        activeThreadRef.current === targetThreadId &&
        generations.current[key] === generation;
      if (stillCurrent) {
        apply(previous);
        onError(error);
      }
      return false;
    }
  }

  return {
    changeApprovalPolicy(next: ApprovalPolicy) {
      return mutate({
        apply: runtime.selectApprovalPolicy,
        key: "approvalPolicy",
        next,
        params: (id) => threadApprovalPolicyUpdateParams(id, next),
        previous: runtime.approvalPolicy,
      });
    },
    changeCollaborationMode(next: CollaborationMode) {
      return mutate({
        apply: runtime.setCollaborationMode,
        key: "collaborationMode",
        next,
        params: (id) =>
          threadBehaviorUpdateParams(
            id,
            runtime.model,
            runtime.effort,
            personality,
            next,
            runtime.permission,
            runtime.approvalPolicy,
          ),
        previous: runtime.collaborationMode,
      });
    },
    changePermission(next: Permission) {
      return mutate({
        apply: runtime.selectPermission,
        key: "permission",
        next,
        params: (id) => threadPermissionUpdateParams(id, next),
        previous: runtime.permission,
      });
    },
    changeServiceTier(next: string | null) {
      return mutate({
        apply: runtime.selectServiceTier,
        key: "serviceTier",
        next,
        params: (id) => threadServiceTierUpdateParams(id, next),
        previous: runtime.serviceTier,
      });
    },
  };
}
