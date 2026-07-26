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
    });
  });

  it("marque les choix utilisateur comme explicites puis réinitialise seulement l'accès", () => {
    const { result } = renderHook(() => useThreadRuntimeState(initial));
    act(() => {
      result.current.setModel("gpt-selected");
      result.current.selectPermission(":read-only");
      result.current.selectApprovalPolicy("untrusted");
    });
    expect(result.current.permissionForStart).toBe(":read-only");
    expect(result.current.approvalPolicyForStart).toBe("untrusted");

    act(() => result.current.resetAccessSettings());
    expect(result.current).toMatchObject({
      model: "gpt-selected",
      permission: ":workspace",
      approvalPolicy: "on-request",
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
      }),
    );
    expect(result.current).toMatchObject({
      model: "gpt-config",
      effort: "xhigh",
      approvalPolicyForStart: "never",
    });
    expect(result.current.permissionForStart).toBeUndefined();
  });
});
