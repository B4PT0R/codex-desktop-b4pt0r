// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
}));

import { normalizeConfigRequirements } from "../../src/lib/useConfigRequirements";
import { useConfigRequirements } from "../../src/lib/useConfigRequirements";

beforeEach(() => requestMock.mockReset());

describe("contraintes administrées", () => {
  it("normalise uniquement les contraintes utiles aux contrôles actuels", () => {
    expect(
      normalizeConfigRequirements({
        requirements: {
          allowManagedHooksOnly: true,
          allowRemoteControl: false,
          defaultPermissions: ":workspace",
          allowedPermissionProfiles: {
            ":workspace": true,
            ":danger-full-access": false,
            malformed: "no",
          },
          allowedApprovalPolicies: ["on-request", "never", { granular: {} }],
          allowedApprovalsReviewers: [
            "user",
            "guardian_subagent",
            "invalid",
          ],
          allowedWebSearchModes: ["cached", "disabled", "invalid"],
        },
      }),
    ).toEqual({
      managed: true,
      managedHooksOnly: true,
      allowRemoteControl: false,
      defaultPermission: ":workspace",
      allowedPermissionProfiles: {
        ":workspace": true,
        ":danger-full-access": false,
      },
      allowedApprovalPolicies: ["on-request", "never"],
      allowedApprovalsReviewers: ["user", "auto_review"],
      allowedWebSearchModes: ["cached", "disabled"],
    });
  });

  it("représente explicitement l’absence de politique", () => {
    expect(normalizeConfigRequirements({ requirements: null })).toEqual({
      managed: false,
      managedHooksOnly: false,
    });
  });

  it("retire les contraintes hydratées dès la déconnexion", async () => {
    requestMock.mockResolvedValue({
      requirements: {
        allowRemoteControl: false,
        allowedPermissionProfiles: { ":workspace": true },
      },
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useConfigRequirements(enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.managed).toBe(true);

    rerender({ enabled: false });

    expect(result.current).toEqual({
      managed: false,
      managedHooksOnly: false,
      error: undefined,
      loading: false,
    });
  });

  it("ignore une lecture tardive puis repart proprement à la reconnexion", async () => {
    const stale = deferred<{
      requirements: { allowManagedHooksOnly: boolean };
    }>();
    requestMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ requirements: null });
    const { result, rerender } = renderHook(
      ({ enabled }) => useConfigRequirements(enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);
    rerender({ enabled: true });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    stale.resolve({ requirements: { allowManagedHooksOnly: true } });
    await act(async () => stale.promise);

    expect(result.current.managed).toBe(false);
    expect(result.current.managedHooksOnly).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
