// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useThreadRuntimeState } from "../../src/lib/useThreadRuntimeState";

const initial = {
  approvalPolicy: "on-request" as const,
  collaborationMode: "default" as const,
  effort: "medium",
  model: "gpt-default",
  permission: ":workspace" as const,
  personality: "pragmatic" as const,
  serviceTier: null,
};

describe("état effectif du thread", () => {
  it("n'envoie pas les valeurs d'affichage tant qu'elles restent des fallbacks", () => {
    const { result } = renderHook(() => useThreadRuntimeState(initial));
    expect(result.current.permissionForStart).toBeUndefined();
    expect(result.current.approvalPolicyForStart).toBeUndefined();
  });

  it("rend les valeurs serveur effectives et les expose au prochain démarrage", () => {
    const { result } = renderHook(() => useThreadRuntimeState(initial));
    act(() =>
      result.current.applyServerSettings({
        model: "gpt-server",
        effort: "high",
        permission: ":danger-full-access",
        approvalPolicy: "never",
        personality: "friendly",
        collaborationMode: "plan",
        serviceTier: "fast",
      }),
    );
    expect(result.current).toMatchObject({
      model: "gpt-server",
      effort: "high",
      permission: ":danger-full-access",
      permissionForStart: ":danger-full-access",
      approvalPolicy: "never",
      approvalPolicyForStart: "never",
      personality: "friendly",
      collaborationMode: "plan",
      serviceTier: "fast",
    });
  });

  it("marque les choix utilisateur comme explicites puis prépare un nouveau thread", () => {
    const { result } = renderHook(() => useThreadRuntimeState(initial));
    act(() => {
      result.current.setModel("gpt-selected");
      result.current.selectServiceTier("fast");
      result.current.selectPermission(":read-only");
      result.current.selectApprovalPolicy("untrusted");
    });
    expect(result.current.permissionForStart).toBe(":read-only");
    expect(result.current.approvalPolicyForStart).toBe("untrusted");
    expect(result.current.serviceTierForStart).toBe("fast");

    act(() => result.current.resetForNewThread());
    expect(result.current).toMatchObject({
      model: "gpt-selected",
      permission: ":workspace",
      approvalPolicy: "on-request",
      serviceTier: null,
    });
    expect(result.current.permissionForStart).toBeUndefined();
    expect(result.current.approvalPolicyForStart).toBeUndefined();
  });

  it("hydrate les defaults sans rendre la permission fallback explicite", () => {
    const { result } = renderHook(() => useThreadRuntimeState(initial));
    act(() =>
      result.current.applyServerDefaults({
        model: "gpt-config",
        effort: "xhigh",
        approvalPolicy: "never",
        serviceTier: "fast",
      }),
    );
    expect(result.current).toMatchObject({
      model: "gpt-config",
      effort: "xhigh",
      approvalPolicyForStart: "never",
      serviceTier: "fast",
    });
    expect(result.current.permissionForStart).toBeUndefined();
  });
});
