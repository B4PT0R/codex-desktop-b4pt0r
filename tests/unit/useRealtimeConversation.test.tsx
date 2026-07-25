// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const createRealtimeThreadMock = vi.hoisted(() => vi.fn());
const acceptRealtimeAnswerMock = vi.hoisted(() => vi.fn());
const playRealtimeAudioMock = vi.hoisted(() => vi.fn());
const startRealtimeMock = vi.hoisted(() => vi.fn());
const stopRealtimeMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/codex", () => ({
  request: requestMock,
}));
vi.mock("../../src/lib/realtimeThread", () => ({
  createRealtimeThread: createRealtimeThreadMock,
}));
vi.mock("../../src/lib/realtimeBridge", () => ({
  acceptRealtimeAnswer: acceptRealtimeAnswerMock,
  playRealtimeAudio: playRealtimeAudioMock,
  startRealtime: startRealtimeMock,
  stopRealtime: stopRealtimeMock,
}));

import { defaultTranslate } from "../../src/i18n/translate";
import { useRealtimeConversation } from "../../src/lib/useRealtimeConversation";
import type { AgentActivity } from "../../src/lib/activity";
import type { ChatMessage } from "../../src/types";

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({});
  createRealtimeThreadMock
    .mockReset()
    .mockResolvedValue({ thread: { id: "realtime-child" } });
  acceptRealtimeAnswerMock.mockReset();
  playRealtimeAudioMock.mockReset();
  startRealtimeMock.mockReset().mockResolvedValue(undefined);
  stopRealtimeMock.mockReset().mockResolvedValue(undefined);
});

describe("cycle de vie de la conversation Realtime", () => {
  it("isole le fork, rend les transcriptions et les injecte dans le parent", async () => {
    const showError = vi.fn();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const [activity, setActivity] = useState<AgentActivity>(null);
      const conversation = useRealtimeConversation({
        setActivity,
        setMessages,
        showError,
        translate: defaultTranslate,
      });
      return { activity, conversation, messages };
    });

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "persistent-parent",
        cwd: "/work",
        model: "gpt-5.4",
        permission: ":workspace",
        personality: "pragmatic",
        approvalPolicy: "never",
        voice: "juniper",
      }),
    );
    expect(result.current.conversation.recording).toBe(true);

    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "realtime-child",
          role: "user",
          text: "Bonjour",
        },
      });
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          text: "Salut",
        },
      });
    });

    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Bonjour",
      "Salut",
    ]);
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledTimes(2),
    );
    expect(requestMock.mock.calls.map(([method]) => method)).toEqual([
      "thread/inject_items",
      "thread/inject_items",
    ]);
    expect(
      requestMock.mock.calls.map(([, params]) => params.threadId),
    ).toEqual(["persistent-parent", "persistent-parent"]);
    expect(showError).not.toHaveBeenCalled();
  });

  it("ignore les notifications tardives d’un ancien fork et libère le fork actif", async () => {
    const showError = vi.fn();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const [, setActivity] = useState<AgentActivity>(null);
      return {
        messages,
        conversation: useRealtimeConversation({
          setActivity,
          setMessages,
          showError,
          translate: defaultTranslate,
        }),
      };
    });

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        personality: "pragmatic",
        voice: "juniper",
      }),
    );
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "stale-child",
          role: "assistant",
          text: "À ignorer",
        },
      });
    });
    expect(result.current.messages).toEqual([]);

    await act(() => result.current.conversation.stop());
    expect(stopRealtimeMock).toHaveBeenCalledOnce();
    expect(requestMock).toHaveBeenCalledWith("thread/unsubscribe", {
      threadId: "realtime-child",
    });
    expect(result.current.conversation.recording).toBe(false);
  });
});
