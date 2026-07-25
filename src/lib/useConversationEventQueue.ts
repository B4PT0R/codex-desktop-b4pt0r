import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Translate } from "../i18n/translate";
import type { ChatMessage } from "../types";
import type { AppServerMessage } from "./codex";
import { applyConversationEvent } from "./conversationEvents";

const RENDER_BATCH_MS = 16;

type ConversationEventQueueOptions = {
  captureMessageDecorator: () => MessageDecorator;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  scopeKey?: string;
  translate: Translate;
};

type MessageDecorator = (
  previous: ChatMessage[],
  next: ChatMessage[],
) => ChatMessage[];

type QueuedConversationEvent = {
  decorate: MessageDecorator;
  event: AppServerMessage;
};

/**
 * Coalesces transport bursts into at most one non-urgent conversation render
 * per frame while preserving the exact App Server event order.
 */
export function useConversationEventQueue({
  captureMessageDecorator,
  setMessages,
  scopeKey,
  translate,
}: ConversationEventQueueOptions) {
  const pending = useRef<QueuedConversationEvent[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const captureDecoratorRef = useRef(captureMessageDecorator);
  const translateRef = useRef(translate);
  captureDecoratorRef.current = captureMessageDecorator;
  translateRef.current = translate;

  const flush = useCallback(() => {
    timer.current = undefined;
    const events = pending.current;
    pending.current = [];
    if (events.length === 0) return;

    startTransition(() => {
      setMessages((messages) =>
        events.reduce((current, queued) => {
          const next = applyConversationEvent(
            current,
            queued.event,
            translateRef.current,
          );
          return queued.decorate(current, next);
        }, messages),
      );
    });
  }, [setMessages]);

  const enqueue = useCallback(
    (event: AppServerMessage) => {
      pending.current.push({
        decorate: captureDecoratorRef.current(),
        event,
      });
      timer.current ??= window.setTimeout(flush, RENDER_BATCH_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = [];
  }, [scopeKey]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      pending.current = [];
    },
    [],
  );

  return enqueue;
}
