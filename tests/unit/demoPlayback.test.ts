// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDemoPlaybackFrames,
  useDemoPlayback,
} from "../../src/lib/useDemoPlayback";
import type { ChatMessage } from "../../src/types";

afterEach(() => {
  vi.useRealTimers();
});

describe("scénario de streaming de démonstration", () => {
  it("prévisualise le chargement pendant exactement trois secondes", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useDemoPlayback({
        enabled: true,
        setActivity: vi.fn(),
        setMessages: vi.fn(),
      }),
    );

    act(() => result.current.previewThreadLoading());
    expect(result.current.loadingThread).toBe(true);
    act(() => vi.advanceTimersByTime(2_999));
    expect(result.current.loadingThread).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.loadingThread).toBe(false);
  });

  it("fait progresser texte, plan et outils jusqu’à un état final cohérent", () => {
    const frames = buildDemoPlaybackFrames();
    let messages = frames[0].update([]);
    for (const frame of frames.slice(1)) messages = frame.update(messages);

    expect(frames.map((frame) => frame.at)).toEqual(
      [...frames].map((frame) => frame.at).sort((a, b) => a - b),
    );
    expect(frames.at(-1)?.complete).toBe(true);
    expect(frames.at(-1)?.at).toBeGreaterThan(15_000);
    const assistants = messages.filter(
      (message) => message.role === "assistant",
    );
    expect(assistants).toHaveLength(3);
    expect(assistants.every((message) => message.streaming !== true)).toBe(true);
    expect(assistants[1].signals?.[0]).toMatchObject({
      kind: "compaction",
      status: "done",
    });
    expect(assistants[2].content).toContain("La vague reste continue");
    expect(assistants[0].tools).toHaveLength(7);
    expect(assistants[1].tools).toHaveLength(3);
    expect(
      assistants
        .flatMap((message) => message.tools ?? [])
        .every(
          (tool) =>
            tool.status === "done" ||
            (tool.id === "demo-live-dev-server" &&
              tool.status === "running"),
        ),
    ).toBe(true);
    const plan = assistants
      .flatMap((message) => message.signals ?? [])
      .find((signal) => signal.kind === "plan");
    expect(plan?.status).toBe("done");
    expect(
      plan?.steps?.every((step) => step.status === "completed"),
    ).toBe(true);
  });

  it("possède le délai de réponse du browser preview", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const playback = useDemoPlayback({
        enabled: false,
        scopeKey: "preview-thread",
        setActivity: vi.fn(),
        setMessages,
      });
      return { messages, playback };
    });

    act(() =>
      result.current.playback.submitPreview({
        message: {
          id: "preview-response",
          role: "assistant",
          content: "Ready",
        },
        onComplete,
        threadId: "preview-thread",
      }),
    );
    act(() => vi.advanceTimersByTime(899));
    expect(result.current.messages).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.messages).toEqual([
      {
        id: "preview-response",
        role: "assistant",
        content: "Ready",
      },
    ]);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("annule une réponse synthétique lorsque la conversation change", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey?: string }) => {
        const [messages, setMessages] = useState<ChatMessage[]>([]);
        const playback = useDemoPlayback({
          enabled: false,
          scopeKey,
          setActivity: vi.fn(),
          setMessages,
        });
        return { messages, playback };
      },
      { initialProps: { scopeKey: "preview-thread" as string | undefined } },
    );

    act(() =>
      result.current.playback.submitPreview({
        message: {
          id: "preview-response",
          role: "assistant",
          content: "Late",
        },
        onComplete,
        threadId: "preview-thread",
      }),
    );
    rerender({ scopeKey: "another-thread" });
    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current.messages).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
