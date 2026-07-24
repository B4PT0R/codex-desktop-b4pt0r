// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import { useApps } from "../../src/lib/useApps";

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
});

describe("apps connectées", () => {
  it("ne conserve que les apps accessibles et activées", async () => {
    requestMock.mockResolvedValue({
      data: [
        app("github", true, true),
        app("inactive", true, false),
        app("private", false, true),
      ],
      nextCursor: null,
    });
    const { result } = renderHook(() =>
      useApps({ enabled: true, threadId: "thr" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps.map(({ id }) => id)).toEqual(["github"]);
    expect(requestMock).toHaveBeenCalledWith("app/list", {
      cursor: null,
      limit: 50,
      threadId: "thr",
      forceRefetch: false,
    });
  });

  it("normalise les mises à jour et ignore les entrées malformées", async () => {
    requestMock.mockResolvedValue({ data: [], nextCursor: null });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "app/list/updated",
        params: {
          data: [
            {
              id: "docs",
              name: "Documents",
              isAccessible: true,
              isEnabled: true,
            },
            { id: 42 },
          ],
        },
      }),
    );
    expect(result.current.apps).toEqual([
      {
        id: "docs",
        name: "Documents",
        description: null,
        installUrl: null,
        isAccessible: true,
        isEnabled: true,
        pluginDisplayNames: [],
      },
    ]);
  });
});

function app(id: string, isAccessible: boolean, isEnabled: boolean) {
  return {
    id,
    name: id,
    description: null,
    installUrl: null,
    isAccessible,
    isEnabled,
    pluginDisplayNames: [],
  };
}
