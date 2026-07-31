import { useCallback, useEffect, useState } from "react";
import { request, subscribeAppServerMessages } from "./codex";
import { threadInjectAutoReviewApprovalParams } from "./protocol";
import {
  autoReviewDenialFromMessage,
  type AutoReviewDenial,
} from "./autoReviewDenials";

export function useAutoReviewDenials() {
  const [denials, setDenials] = useState<AutoReviewDenial[]>([]);

  useEffect(
    () =>
      subscribeAppServerMessages((message) => {
        const denial = autoReviewDenialFromMessage(message);
        if (!denial) return;
        setDenials((current) => [
          denial,
          ...current.filter((candidate) => candidate.id !== denial.id),
        ].slice(0, 30));
      }),
    [],
  );

  const approve = useCallback(async (threadId: string, id: string) => {
    const denial = denials.find(
      (candidate) => candidate.threadId === threadId && candidate.id === id,
    );
    if (!denial) return false;
    await request(
      "thread/inject_items",
      threadInjectAutoReviewApprovalParams(threadId, denial.action),
    );
    setDenials((current) => current.filter((candidate) => candidate.id !== id));
    return true;
  }, [denials]);

  return {
    approve,
    forThread: (threadId?: string) =>
      threadId
        ? denials.filter((denial) => denial.threadId === threadId)
        : [],
  };
}
