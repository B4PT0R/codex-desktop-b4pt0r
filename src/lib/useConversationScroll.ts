import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import type { AgentActivity } from "./activity";
import type { ChatMessage } from "../types";

const BOTTOM_THRESHOLD_PX = 96;

/** Follows live output while the reader stays near the bottom of the transcript. */
export function useConversationScroll(
  messages: ChatMessage[],
  activity: AgentActivity,
) {
  const container = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousScrollTop = useRef(0);
  const userScrollIntent = useRef(false);
  const latestUserId = useMemo(() => latestUserMessageId(messages), [messages]);
  const tail = messages.at(-1);
  const frame = useRef<number | undefined>(undefined);
  const previousUser = useRef<string | undefined>(undefined);
  const previousTail = useRef<ChatMessage | undefined>(tail);
  const previousActivity = useRef<AgentActivity>(activity);

  useLayoutEffect(() => {
    const previousUserId = previousUser.current;
    const newPrompt = latestUserId !== previousUserId;
    const liveTailChanged =
      tail !== previousTail.current || activity !== previousActivity.current;
    previousUser.current = latestUserId;
    previousTail.current = tail;
    previousActivity.current = activity;

    if (newPrompt && latestUserId) {
      const appendedPrompt =
        previousUserId !== undefined &&
        messages.some((message) => message.id === previousUserId);
      following.current = true;
      cancelFrame(frame.current);
      scrollToBottom(container.current, appendedPrompt ? "smooth" : "auto");
      return;
    }
    if (!liveTailChanged || !following.current || !tail) return;
    // The observer below owns geometry-driven following in Chromium. Scheduling
    // another scroll for every immutable streaming-message update makes token
    // deltas and tool notifications race the actual resize callback, producing
    // visible one-frame repositioning. Retain this path only as a fallback for
    // environments without ResizeObserver.
    if (typeof ResizeObserver !== "undefined") return;
    cancelFrame(frame.current);
    frame.current = scheduleFrame(() => {
      frame.current = undefined;
      scrollToBottom(container.current, "auto");
    });
  }, [activity, latestUserId, messages, tail]);

  useEffect(() => {
    const contentElement = content.current;
    const containerElement = container.current;
    if (
      !contentElement ||
      !containerElement ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const observer = new ResizeObserver((entries) => {
      if (!following.current) return;
      cancelFrame(frame.current);
      if (entries.some((entry) => entry.target === containerElement)) {
        frame.current = undefined;
        scrollToBottom(containerElement, "auto");
        return;
      }
      frame.current = scheduleFrame(() => {
        frame.current = undefined;
        scrollToBottom(containerElement, "auto");
      });
    });
    observer.observe(contentElement);
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      cancelFrame(frame.current);
    },
    [],
  );

  function onScroll() {
    const element = container.current;
    if (!element) return;
    const scrolledUp = element.scrollTop < previousScrollTop.current - 1;
    previousScrollTop.current = element.scrollTop;
    if (scrolledUp && userScrollIntent.current) {
      following.current = false;
      return;
    }
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <=
      BOTTOM_THRESHOLD_PX
    ) {
      following.current = true;
      userScrollIntent.current = false;
    }
  }

  function onWheel(event: WheelEvent<HTMLElement>) {
    if (event.deltaY < 0) userScrollIntent.current = true;
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.pointerType === "touch" || event.clientX >= bounds.right - 16) {
      userScrollIntent.current = true;
    }
  }

  function onPointerUp() {
    userScrollIntent.current = false;
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
      userScrollIntent.current = true;
    }
  }

  return {
    container,
    content,
    onKeyDown,
    onPointerDown,
    onPointerUp,
    onScroll,
    onWheel,
  };
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
