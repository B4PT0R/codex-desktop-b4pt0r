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
  scopeKey?: string;
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
  const activeScope = useRef(scopeKey);
  const scopeTransition = useRef(false);
  const captureDecoratorRef = useRef(captureMessageDecorator);
  const translateRef = useRef(translate);
  captureDecoratorRef.current = captureMessageDecorator;
  translateRef.current = translate;

  const flush = useCallback(() => {
    timer.current = undefined;
    const events = pending.current;
    pending.current = [];
    if (events.length === 0) return;
    const currentScope = activeScope.current;
    const scopedEvents = events.filter(
      (queued) => queued.scopeKey === currentScope,
    );
    if (scopedEvents.length === 0) return;

    startTransition(() => {
      setMessages((messages) =>
        scopedEvents.reduce((current, queued) => {
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

  const scheduleFlush = useCallback(() => {
    if (
      !scopeTransition.current &&
      pending.current.length > 0 &&
      timer.current === undefined
    ) {
      timer.current = window.setTimeout(flush, RENDER_BATCH_MS);
    }
  }, [flush]);

  const enqueue = useCallback(
    (event: AppServerMessage, eventScope = activeScope.current) => {
      if (eventScope !== activeScope.current) return;
      pending.current.push({
        decorate: captureDecoratorRef.current(),
        event,
        scopeKey: eventScope,
      });
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const clearPending = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = [];
  }, []);

  const replaceScope = useCallback(
    (nextScope?: string) => {
      clearPending();
      activeScope.current = nextScope;
      scopeTransition.current = false;
    },
    [clearPending],
  );

  const beginScopeTransition = useCallback(
    (nextScope: string) => {
      clearPending();
      activeScope.current = nextScope;
      scopeTransition.current = true;
    },
    [clearPending],
  );

  const completeScopeTransition = useCallback(
    (completedScope: string) => {
      if (activeScope.current !== completedScope) return;
      scopeTransition.current = false;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  useEffect(() => {
    if (activeScope.current !== scopeKey) replaceScope(scopeKey);
  }, [replaceScope, scopeKey]);

  useEffect(
    () => () => {
      clearPending();
    },
    [clearPending],
  );

  return {
    beginScopeTransition,
    completeScopeTransition,
    enqueue,
    replaceScope,
  };
}
