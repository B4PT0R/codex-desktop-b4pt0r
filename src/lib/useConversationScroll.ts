import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { AgentActivity } from "./activity";
import type { ChatMessage } from "../types";

const BOTTOM_THRESHOLD_PX = 96;

/** Follows live output while the reader stays near the bottom of the transcript. */
export function useConversationScroll(
  messages: ChatMessage[],
  activity: AgentActivity,
) {
  const container = useRef<HTMLElement>(null);
  const following = useRef(true);
  const latestUserId = useMemo(() => latestUserMessageId(messages), [messages]);
  const tail = messages.at(-1);
  const frame = useRef<number | undefined>(undefined);
  const previousUser = useRef<string | undefined>(undefined);
  const previousTail = useRef<ChatMessage | undefined>(tail);
  const previousActivity = useRef<AgentActivity>(activity);

  useLayoutEffect(() => {
    const newPrompt = latestUserId !== previousUser.current;
    const liveTailChanged =
      tail !== previousTail.current || activity !== previousActivity.current;
    previousUser.current = latestUserId;
    previousTail.current = tail;
    previousActivity.current = activity;

    if (newPrompt && latestUserId) {
      following.current = true;
      cancelFrame(frame.current);
      scrollToBottom(container.current, "smooth");
      return;
    }
    if (!liveTailChanged || !following.current || !tail) return;
    cancelFrame(frame.current);
    frame.current = scheduleFrame(() => {
      frame.current = undefined;
      scrollToBottom(container.current, "auto");
    });
  }, [activity, latestUserId, tail]);

  useEffect(
    () => () => {
      cancelFrame(frame.current);
    },
    [],
  );

  function onScroll() {
    const element = container.current;
    if (!element) return;
    following.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <=
      BOTTOM_THRESHOLD_PX;
  }

  return { container, onScroll };
}

function scrollToBottom(element: HTMLElement | null, behavior: ScrollBehavior) {
  element?.scrollTo({ top: element.scrollHeight, behavior });
}

function latestUserMessageId(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].id;
  }
  return undefined;
}

function cancelFrame(frame: number | undefined) {
  if (frame === undefined) return;
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frame);
  } else {
    window.clearTimeout(frame);
  }
}

function scheduleFrame(callback: FrameRequestCallback) {
  return typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}
