import { useCallback, useEffect, useRef, useState } from "react";
import { request, subscribeAppServerMessages } from "./codex";
import { threadInjectAutoReviewApprovalParams } from "./protocol";
import {
  autoReviewDenialFromMessage,
  type AutoReviewDenial,
} from "./autoReviewDenials";

export function useAutoReviewDenials() {
  const [denials, setDenials] = useState<AutoReviewDenial[]>([]);
  const pendingApprovals = useRef(new Set<string>());

  useEffect(
    () =>
      subscribeAppServerMessages((message) => {
        const denial = autoReviewDenialFromMessage(message);
        if (!denial) return;
        setDenials((current) => [
          denial,
          ...current.filter(
            (candidate) =>
              candidate.threadId !== denial.threadId ||
              candidate.id !== denial.id,
          ),
        ].slice(0, 30));
      }),
    [],
  );

  const approve = useCallback(async (threadId: string, id: string) => {
    const approvalKey = `${threadId}\u0000${id}`;
    if (pendingApprovals.current.has(approvalKey)) return false;
    const denial = denials.find(
      (candidate) => candidate.threadId === threadId && candidate.id === id,
    );
    if (!denial) return false;
    pendingApprovals.current.add(approvalKey);
    try {
      await request(
        "thread/inject_items",
        threadInjectAutoReviewApprovalParams(threadId, denial.action),
      );
      setDenials((current) =>
        current.filter(
          (candidate) =>
            candidate.threadId !== threadId || candidate.id !== id,
        ),
      );
      return true;
    } finally {
      pendingApprovals.current.delete(approvalKey);
    }
  }, [denials]);

  return {
    approve,
    forThread: (threadId?: string) =>
      threadId
        ? denials.filter((denial) => denial.threadId === threadId)
        : [],
  };
}
