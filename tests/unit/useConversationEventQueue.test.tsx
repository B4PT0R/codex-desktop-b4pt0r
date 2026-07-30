// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTranslate } from "../../src/i18n/translate";
import { useConversationEventQueue } from "../../src/lib/useConversationEventQueue";
import type { ChatMessage } from "../../src/types";

afterEach(() => {
  vi.useRealTimers();
});

describe("file de rendu des événements de conversation", () => {
  it("préserve l’ordre des deltas et ne rend qu’une fois par rafale", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => {
      const renders = useRef(0);
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      renders.current += 1;
      const queue = useConversationEventQueue({
        captureMessageDecorator: () => (_previous, next) => next,
        setMessages,
        translate: defaultTranslate,
      });
      return { messages, queue, renders: renders.current };
    });

    act(() => {
      for (const delta of ["Bon", "jour", " !"]) {
        result.current.queue.enqueue({
          method: "item/agentMessage/delta",
          params: { itemId: "answer", delta },
        });
      }
    });
    expect(result.current.messages).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.messages.at(-1)?.content).toBe("Bonjour !");
    expect(result.current.renders).toBe(2);
  });

  it("annule une rafale en attente au démontage", () => {
    vi.useFakeTimers();
    const setMessages = vi.fn();
    const { result, unmount } = renderHook(() =>
      useConversationEventQueue({
        captureMessageDecorator: () => (_previous, next) => next,
        setMessages,
        translate: defaultTranslate,
      }),
    );

    act(() => {
      result.current.enqueue({ method: "item/agentMessage/delta" });
    });
    unmount();
    act(() => {
      vi.runAllTimers();
    });
    expect(setMessages).not.toHaveBeenCalled();
  });

  it("écarte les événements en attente quand le thread change", () => {
    vi.useFakeTimers();
    const setMessages = vi.fn();
    const { result, rerender } = renderHook(
      ({ threadId }) =>
        useConversationEventQueue({
          captureMessageDecorator: () => (_previous, next) => next,
          scopeKey: threadId,
          setMessages,
          translate: defaultTranslate,
        }),
      { initialProps: { threadId: "thread-a" } },
    );

    act(() => {
      result.current.enqueue({ method: "item/agentMessage/delta" });
    });
    rerender({ threadId: "thread-b" });
    act(() => {
      vi.runAllTimers();
    });
    expect(setMessages).not.toHaveBeenCalled();
  });

  it("fige le contexte de présentation au moment de la réception", () => {
    vi.useFakeTimers();
    let context = "realtime";
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const queue = useConversationEventQueue({
        captureMessageDecorator: () => {
          const captured = context;
          return (_previous, next) =>
            next.map((message) => ({
              ...message,
              content: `${message.content}:${captured}`,
            }));
        },
        setMessages,
        translate: defaultTranslate,
      });
      return { messages, queue };
    });

    act(() => {
      result.current.queue.enqueue({
        method: "item/agentMessage/delta",
        params: { itemId: "answer", delta: "Réponse" },
      });
      context = "closed";
      vi.advanceTimersByTime(16);
    });
    expect(result.current.messages.at(-1)?.content).toBe("Réponse:realtime");
  });

  it("écarte immédiatement les événements de l’ancien thread pendant une reprise", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const queue = useConversationEventQueue({
        captureMessageDecorator: () => (_previous, next) => next,
        scopeKey: "thread-a",
        setMessages,
        translate: defaultTranslate,
      });
      return { messages, queue };
    });

    act(() => {
      result.current.queue.enqueue(
        {
          method: "item/reasoning/summaryTextDelta",
          params: { itemId: "old-reasoning", delta: "Ancien raisonnement" },
        },
        "thread-a",
      );
      result.current.queue.beginScopeTransition("thread-b");
      result.current.queue.enqueue(
        {
          method: "item/agentMessage/delta",
          params: { itemId: "old-answer", delta: "Ancienne réponse" },
        },
        "thread-a",
      );
      vi.runAllTimers();
    });

    expect(result.current.messages).toEqual([]);
  });

  it("tamponne le nouveau stream jusqu’à la fin de son hydratation", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const queue = useConversationEventQueue({
        captureMessageDecorator: () => (_previous, next) => next,
        scopeKey: "thread-a",
        setMessages,
        translate: defaultTranslate,
      });
      return { messages, queue, setMessages };
    });

    act(() => {
      result.current.queue.beginScopeTransition("thread-b");
      result.current.queue.enqueue(
        {
          method: "item/agentMessage/delta",
          params: { itemId: "live-answer", delta: "Suite en direct" },
        },
        "thread-b",
      );
      vi.runAllTimers();
    });
    expect(result.current.messages).toEqual([]);

    act(() => {
      result.current.setMessages([
        { id: "history", role: "assistant", content: "Historique" },
      ]);
      result.current.queue.completeScopeTransition("thread-b");
      vi.advanceTimersByTime(16);
    });
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Historique",
      "Suite en direct",
    ]);
  });
});
