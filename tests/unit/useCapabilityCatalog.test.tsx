// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isTauri: () => true,
  request: requestMock,
}));

import { useCapabilityCatalog } from "../../src/lib/useCapabilityCatalog";

beforeEach(() => requestMock.mockReset());
afterEach(cleanup);

describe("catalogue de capacités", () => {
  it("charge les modes et toutes les pages de profils", async () => {
    requestMock.mockImplementation(
      (method: string, params?: { cursor?: string }) => {
        if (method === "collaborationMode/list")
          return Promise.resolve({
            data: [
              {
                name: "Plan",
                mode: "plan",
                model: null,
                reasoning_effort: "medium",
              },
            ],
          });
        return Promise.resolve({
          data: [
            {
              id: params?.cursor ? "custom" : ":workspace",
              description: null,
              allowed: true,
            },
          ],
          nextCursor: params?.cursor ? null : "next",
        });
      },
    );
    const { result } = renderHook(() =>
      useCapabilityCatalog({ cwd: "/project", enabled: true }),
    );
    await waitFor(() =>
      expect(result.current.permissionProfiles.data).toHaveLength(2),
    );
    expect(
      result.current.permissionProfiles.data.map((profile) => profile.id),
    ).toEqual([":workspace", "custom"]);
    expect(result.current.collaborationModes.data[0].mode).toBe("plan");
  });

  it("conserve des choix sûrs si le catalogue expérimental échoue", async () => {
    requestMock.mockImplementation((method: string) =>
      method === "collaborationMode/list"
        ? Promise.reject(new Error("non disponible"))
        : Promise.resolve({ data: [], nextCursor: null }),
    );
    const { result } = renderHook(() =>
      useCapabilityCatalog({ cwd: "/project", enabled: true }),
    );
    await waitFor(() =>
      expect(result.current.collaborationModes.error).toBe("non disponible"),
    );
    expect(
      result.current.collaborationModes.data.map((mode) => mode.mode),
    ).toEqual(["default", "plan"]);
    expect(result.current.permissionProfiles.data).toHaveLength(3);
  });
});
