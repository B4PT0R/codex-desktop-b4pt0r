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
const realtimeInstructionItemsMock = vi.hoisted(() => vi.fn());

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
vi.mock("../../src/lib/realtimeInstructions", () => ({
  realtimeInstructionItems: realtimeInstructionItemsMock,
}));

import { defaultTranslate } from "../../src/i18n/translate";
import { useRealtimeConversation } from "../../src/lib/useRealtimeConversation";
import type { AgentActivity } from "../../src/lib/activity";
import type { ChatMessage } from "../../src/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({});
  createRealtimeThreadMock
    .mockReset()
    .mockResolvedValue({ thread: { id: "realtime-child" }, cwd: "/resolved" });
  acceptRealtimeAnswerMock.mockReset();
  playRealtimeAudioMock.mockReset();
  startRealtimeMock.mockReset().mockResolvedValue(undefined);
  stopRealtimeMock.mockReset().mockResolvedValue(undefined);
  realtimeInstructionItemsMock.mockReset().mockResolvedValue([
    { role: "developer", text: "Effective AGENTS.md instructions" },
  ]);
});

describe("cycle de vie de la conversation Realtime", () => {
  it("refuse un second démarrage pendant l'initialisation", async () => {
    const creation = deferred<{
      thread: { id: string };
      cwd: string;
    }>();
    createRealtimeThreadMock.mockReturnValueOnce(creation.promise);
    const { result } = renderHook(() => {
      const [, setMessages] = useState<ChatMessage[]>([]);
      const [, setActivity] = useState<AgentActivity>(null);
      return useRealtimeConversation({
        activeParentThreadId: "parent",
        setActivity,
        setMessages,
        showError: vi.fn(),
        translate: defaultTranslate,
      });
    });

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      });
      second = result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      });
    });

    await expect(second).resolves.toBe(false);
    expect(createRealtimeThreadMock).toHaveBeenCalledOnce();
    expect(result.current.starting).toBe(true);
    creation.resolve({ thread: { id: "realtime-child" }, cwd: "/work" });
    await act(() => first);
    expect(result.current.starting).toBe(false);
    expect(result.current.recording).toBe(true);
  });

  it("annule un démarrage différé et libère son fork après reset", async () => {
    const creation = deferred<{
      thread: { id: string };
      cwd: string;
    }>();
    const showError = vi.fn();
    createRealtimeThreadMock.mockReturnValueOnce(creation.promise);
    const { result } = renderHook(() => {
      const [, setMessages] = useState<ChatMessage[]>([]);
      const [, setActivity] = useState<AgentActivity>(null);
      return useRealtimeConversation({
        activeParentThreadId: "parent",
        setActivity,
        setMessages,
        showError,
        translate: defaultTranslate,
      });
    });

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      });
    });
    act(() => result.current.reset());
    expect(result.current.starting).toBe(true);

    creation.resolve({ thread: { id: "cancelled-child" }, cwd: "/work" });
    await expect(pending).resolves.toBe(false);
    await waitFor(() => expect(result.current.starting).toBe(false));
    expect(startRealtimeMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledWith("thread/unsubscribe", {
      threadId: "cancelled-child",
    });
    expect(showError).not.toHaveBeenCalled();
  });

  it("termine un démarrage annulé avant d’autoriser la session suivante", async () => {
    const firstNativeStart = deferred<void>();
    createRealtimeThreadMock
      .mockResolvedValueOnce({ thread: { id: "first-child" }, cwd: "/work" })
      .mockResolvedValueOnce({ thread: { id: "second-child" }, cwd: "/work" });
    startRealtimeMock
      .mockReturnValueOnce(firstNativeStart.promise)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => {
      const [, setMessages] = useState<ChatMessage[]>([]);
      const [, setActivity] = useState<AgentActivity>(null);
      return useRealtimeConversation({
        activeParentThreadId: "parent",
        setActivity,
        setMessages,
        showError: vi.fn(),
        translate: defaultTranslate,
      });
    });

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      });
    });
    await waitFor(() => expect(startRealtimeMock).toHaveBeenCalledOnce());
    act(() => result.current.reset());
    await expect(
      result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      }),
    ).resolves.toBe(false);

    firstNativeStart.resolve();
    await expect(first).resolves.toBe(false);
    await waitFor(() => expect(result.current.starting).toBe(false));
    const stopCallsBeforeRestart = stopRealtimeMock.mock.calls.length;

    await act(() =>
      result.current.start({
        parentThreadId: "parent",
        model: "gpt-5.4",
        voice: "juniper",
      }),
    );
    expect(result.current.recording).toBe(true);
    expect(startRealtimeMock).toHaveBeenLastCalledWith(
      "second-child",
      expect.anything(),
      expect.anything(),
      expect.any(Function),
      expect.any(Array),
    );
    expect(stopRealtimeMock).toHaveBeenCalledTimes(stopCallsBeforeRestart);
  });

  it("tamponne le transcript hors de son parent puis le rattache au retour", async () => {
    const { result, rerender } = renderHook(
      ({ activeThreadId }) => {
        const [messages, setMessages] = useState<ChatMessage[]>([
          { id: "history-a", role: "assistant", content: "Historique A" },
        ]);
        const [activity, setActivity] = useState<AgentActivity>("working");
        const conversation = useRealtimeConversation({
          activeParentThreadId: activeThreadId,
          setActivity,
          setMessages,
          showError: vi.fn(),
          translate: defaultTranslate,
        });
        return { activity, conversation, messages, setMessages };
      },
      { initialProps: { activeThreadId: "parent-a" } },
    );

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "parent-a",
        model: "gpt-5.4",
        voice: "juniper",
      }),
    );
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/delta",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          delta: "Visible A",
        },
      });
    });

    act(() => {
      result.current.conversation.detachVisibleTranscript("thread-b");
      result.current.setMessages([
        { id: "history-b", role: "assistant", content: "Historique B" },
      ]);
    });
    rerender({ activeThreadId: "thread-b" });
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/delta",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          delta: " puis caché",
        },
      });
    });
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Historique B",
    ]);
    const decorate = result.current.conversation.captureMessageDecorator();
    expect(
      decorate(result.current.messages, [
        ...result.current.messages,
        { id: "text-b", role: "assistant", content: "Texte B" },
      ]).at(-1)?.modality,
    ).toBeUndefined();

    act(() => {
      result.current.conversation.detachVisibleTranscript("parent-a");
      result.current.setMessages([]);
    });
    rerender({ activeThreadId: "parent-a" });
    act(() => {
      result.current.setMessages([
        { id: "history-a", role: "assistant", content: "Historique A" },
      ]);
      result.current.conversation.attachVisibleTranscript("parent-a");
    });
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Historique A",
      "Visible A puis caché",
    ]);
    expect(result.current.messages.at(-1)).toMatchObject({
      modality: "realtimeVoice",
      streaming: true,
    });
    expect(result.current.activity).toBe("working");
  });

  it("conserve un transcript finalisé si la session se ferme hors de son parent", async () => {
    const { result, rerender } = renderHook(
      ({ activeThreadId }) => {
        const [messages, setMessages] = useState<ChatMessage[]>([]);
        const [, setActivity] = useState<AgentActivity>(null);
        const conversation = useRealtimeConversation({
          activeParentThreadId: activeThreadId,
          setActivity,
          setMessages,
          showError: vi.fn(),
          translate: defaultTranslate,
        });
        return { conversation, messages, setMessages };
      },
      { initialProps: { activeThreadId: "parent-a" } },
    );

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "parent-a",
        model: "gpt-5.4",
        voice: "juniper",
      }),
    );
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          text: "Réponse vocale finalisée",
        },
      });
      result.current.conversation.detachVisibleTranscript("thread-b");
      result.current.setMessages([
        { id: "history-b", role: "assistant", content: "Historique B" },
      ]);
    });
    rerender({ activeThreadId: "thread-b" });
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/closed",
        params: { threadId: "realtime-child" },
      });
    });
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Historique B",
    ]);

    act(() => result.current.setMessages([]));
    rerender({ activeThreadId: "parent-a" });
    act(() => {
      result.current.conversation.attachVisibleTranscript("parent-a");
    });
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Réponse vocale finalisée",
    ]);
  });

  it("isole le fork, rend les transcriptions et les injecte dans le parent", async () => {
    const showError = vi.fn();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([]);
      const [activity, setActivity] = useState<AgentActivity>(null);
      const conversation = useRealtimeConversation({
        activeParentThreadId: "persistent-parent",
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
    expect(realtimeInstructionItemsMock).toHaveBeenCalledWith(
      "realtime-child",
      "/resolved",
    );
    expect(startRealtimeMock).toHaveBeenCalledWith(
      "realtime-child",
      "juniper",
      "conversation",
      expect.any(Function),
      [{ role: "developer", text: "Effective AGENTS.md instructions" }],
    );

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
          activeParentThreadId: "parent",
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

  it("persiste une session headless sans modifier le chat affiché", async () => {
    const reportError = vi.fn();
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([
        { id: "visible", role: "assistant", content: "Tour textuel actif" },
      ]);
      const [activity, setActivity] = useState<AgentActivity>("working");
      const conversation = useRealtimeConversation({
        activeParentThreadId: "other-thread",
        setActivity,
        setMessages,
        showError: vi.fn(),
        translate: defaultTranslate,
      });
      return { activity, conversation, messages };
    });

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "headless-parent",
        model: "gpt-5.4",
        voice: "juniper",
        displayTranscript: false,
        reportError,
      }),
    );
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "realtime-child",
          role: "user",
          text: "Contexte vocal",
        },
      });
      result.current.conversation.handleMessage({
        method: "thread/realtime/closed",
        params: { threadId: "realtime-child" },
      });
    });

    expect(result.current.messages).toEqual([
      { id: "visible", role: "assistant", content: "Tour textuel actif" },
    ]);
    expect(result.current.activity).toBe("working");
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "thread/inject_items",
        expect.objectContaining({
          threadId: "headless-parent",
          items: [
            expect.objectContaining({
              role: "user",
              content: [{ type: "input_text", text: "Contexte vocal" }],
            }),
          ],
        }),
      ),
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  it("rattache le transcript accumulé lorsqu’une session headless devient visible", async () => {
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([
        { id: "history", role: "assistant", content: "Contexte existant" },
      ]);
      const [, setActivity] = useState<AgentActivity>(null);
      const conversation = useRealtimeConversation({
        activeParentThreadId: "headless-parent",
        setActivity,
        setMessages,
        showError: vi.fn(),
        translate: defaultTranslate,
      });
      return { conversation, messages };
    });

    await act(() =>
      result.current.conversation.start({
        parentThreadId: "headless-parent",
        model: "gpt-5.4",
        voice: "juniper",
        displayTranscript: false,
      }),
    );
    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/done",
        params: {
          threadId: "realtime-child",
          role: "user",
          text: "Question déjà prononcée",
        },
      });
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/delta",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          delta: "Réponse en ",
        },
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.conversation.headlessParentThreadId).toBe(
      "headless-parent",
    );
    act(() => {
      expect(
        result.current.conversation.attachHeadlessTranscript(),
      ).toBe(true);
    });
    expect(result.current.conversation.headlessParentThreadId).toBeUndefined();
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Contexte existant",
      "Question déjà prononcée",
      "Réponse en ",
    ]);
    expect(result.current.messages.at(-1)).toMatchObject({
      modality: "realtimeVoice",
      streaming: true,
    });

    act(() => {
      result.current.conversation.handleMessage({
        method: "thread/realtime/transcript/delta",
        params: {
          threadId: "realtime-child",
          role: "assistant",
          delta: "direct",
        },
      });
    });
    expect(result.current.messages.at(-1)?.content).toBe("Réponse en direct");
  });

  it("libère la session même si l’arrêt audio natif échoue", async () => {
    const showError = vi.fn();
    stopRealtimeMock.mockRejectedValueOnce(new Error("audio bridge closed"));
    const { result } = renderHook(() => {
      const [, setMessages] = useState<ChatMessage[]>([]);
      const [, setActivity] = useState<AgentActivity>(null);
      return useRealtimeConversation({
        activeParentThreadId: "persistent-parent",
        setActivity,
        setMessages,
        showError,
        translate: defaultTranslate,
      });
    });

    await act(() =>
      result.current.start({
        parentThreadId: "persistent-parent",
        model: "gpt-5.4",
        voice: "juniper",
      }),
    );
    await act(() => result.current.stop());

    expect(result.current.recording).toBe(false);
    expect(requestMock).toHaveBeenCalledWith("thread/unsubscribe", {
      threadId: "realtime-child",
    });
    expect(showError).toHaveBeenCalledWith(
      expect.stringMatching(/audio|connexion/i),
      expect.objectContaining({ message: "audio bridge closed" }),
    );
  });
});
