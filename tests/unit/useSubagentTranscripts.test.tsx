// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../src/i18n/translate";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useSubagentTranscripts } from "../../src/lib/useSubagentTranscripts";

const t = (
  key: Parameters<typeof translate>[1],
  params?: Record<string, string | number>,
) => translate("fr", key, params);

beforeEach(() => requestMock.mockReset());

describe("suivi des threads de sous-agents", () => {
  it("réhydrate les descendants et leur transcript", async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [
          {
            id: "child-1",
            parentThreadId: "parent-1",
            agentNickname: "Atlas",
          },
        ],
      })
      .mockResolvedValueOnce({
        thread: {
          id: "child-1",
          agentNickname: "Atlas",
          agentRole: "reviewer",
          status: { type: "idle" },
          turns: [
            {
              items: [
                { id: "answer-1", type: "agentMessage", text: "Audit fini" },
              ],
            },
          ],
        },
      });

    const { result } = renderHook(() =>
      useSubagentTranscripts({
        enabled: true,
        parentThreadId: "parent-1",
        translate: t,
      }),
    );

    await waitFor(() =>
      expect(result.current.transcripts["child-1"]).toMatchObject({
        name: "Atlas",
        role: "reviewer",
        status: "completed",
        messages: [{ id: "answer-1", content: "Audit fini" }],
      }),
    );
  });

  it("route uniquement les événements des enfants du parent courant", async () => {
    requestMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() =>
      useSubagentTranscripts({
        enabled: true,
        parentThreadId: "parent-1",
        translate: t,
      }),
    );
    await waitFor(() => expect(requestMock).toHaveBeenCalledOnce());

    act(() => {
      result.current.handleMessage({
        method: "item/started",
        params: {
          threadId: "other-parent",
          item: {
            id: "other-spawn",
            type: "collabAgentToolCall",
            receiverThreadIds: ["foreign-child"],
          },
        },
      });
      result.current.handleMessage({
        method: "item/completed",
        params: {
          threadId: "parent-1",
          item: {
            id: "spawn-1",
            type: "subAgentActivity",
            kind: "started",
            agentThreadId: "child-1",
            agentPath: "/root/audit",
          },
        },
      });
      result.current.handleMessage({
        method: "item/agentMessage/delta",
        params: {
          threadId: "child-1",
          itemId: "answer-1",
          delta: "Je vérifie",
        },
      });
      result.current.handleMessage({
        method: "turn/completed",
        params: {
          threadId: "child-1",
          turn: { status: "completed" },
        },
      });
    });

    await waitFor(() =>
      expect(result.current.transcripts["child-1"]).toMatchObject({
        status: "completed",
        messages: [{ id: "answer-1", content: "Je vérifie" }],
      }),
    );
    expect(result.current.transcripts["foreign-child"]).toBeUndefined();
  });

  it("efface immédiatement le transcript lors d’un changement de parent", async () => {
    requestMock
      .mockResolvedValueOnce({ data: [{ id: "child-1" }] })
      .mockResolvedValueOnce({
        thread: { id: "child-1", status: { type: "idle" }, turns: [] },
      })
      .mockResolvedValueOnce({ data: [] });
    const { result, rerender } = renderHook(
      ({ parentThreadId }) =>
        useSubagentTranscripts({ enabled: true, parentThreadId, translate: t }),
      { initialProps: { parentThreadId: "parent-1" } },
    );
    await waitFor(() =>
      expect(result.current.transcripts["child-1"]).toBeDefined(),
    );

    rerender({ parentThreadId: "parent-2" });

    expect(result.current.transcripts).toEqual({});
  });

  it("conserve les replays disponibles si un descendant est illisible", async () => {
    requestMock.mockImplementation(
      (method: string, params?: Record<string, unknown>) => {
        if (method === "thread/list" || !params?.threadId)
          return Promise.resolve({
            data: [{ id: "child-ok" }, { id: "child-missing" }],
          });
        if (params?.threadId === "child-ok")
          return Promise.resolve({
            thread: {
              id: "child-ok",
              status: { type: "idle" },
              turns: [],
            },
          });
        return Promise.reject(new Error("not found"));
      },
    );
    const { result } = renderHook(() =>
      useSubagentTranscripts({
        enabled: true,
        parentThreadId: "parent-1",
        translate: t,
      }),
    );

    await waitFor(() =>
      expect(result.current.transcripts["child-ok"]).toBeDefined(),
    );
    expect(result.current.error).toBe(
      "Certains fils délégués n’ont pas pu être rejoués (1).",
    );
  });
});
