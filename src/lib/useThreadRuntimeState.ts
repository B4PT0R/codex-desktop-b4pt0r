import { useCallback, useRef, useState } from "react";
import type { ApprovalPolicy, Permission } from "./protocol";
import type { ThreadRuntimeSettings } from "./threadRuntimeSettings";
import type { CollaborationMode, Personality } from "../types";

type SettingSource = "fallback" | "server" | "user";

export type ThreadRuntimeState = {
  approvalPolicy: ApprovalPolicy;
  collaborationMode: CollaborationMode;
  effort: string;
  model: string;
  permission: Permission;
  personality: Personality;
};

type InitialThreadRuntimeState = ThreadRuntimeState;

/**
 * Owns renderer-side thread behavior and tracks whether access settings are
 * merely UI fallbacks or effective values chosen by App Server/the user.
 *
 * Fallback access values are useful for rendering a new composer but must not
 * become explicit thread overrides until a server or user has selected them.
 */
export function useThreadRuntimeState(initial: InitialThreadRuntimeState) {
  const [state, setState] = useState(initial);
  const permissionSource = useRef<SettingSource>("fallback");
  const approvalSource = useRef<SettingSource>("fallback");

  const applyServerSettings = useCallback((settings: ThreadRuntimeSettings) => {
    setState((current) => ({
      ...current,
      ...(settings.model ? { model: settings.model } : {}),
      ...(settings.effort ? { effort: settings.effort } : {}),
      ...(settings.permission ? { permission: settings.permission } : {}),
      ...(settings.personality ? { personality: settings.personality } : {}),
      ...(settings.collaborationMode
        ? { collaborationMode: settings.collaborationMode }
        : {}),
      ...(settings.approvalPolicy
        ? { approvalPolicy: settings.approvalPolicy }
        : {}),
    }));
    if (settings.permission) permissionSource.current = "server";
    if (settings.approvalPolicy) approvalSource.current = "server";
  }, []);

  const applyServerDefaults = useCallback(
    (
      defaults: Pick<
        ThreadRuntimeSettings,
        "approvalPolicy" | "effort" | "model"
      >,
    ) => {
      setState((current) => ({
        ...current,
        ...(defaults.model ? { model: defaults.model } : {}),
        ...(defaults.effort ? { effort: defaults.effort } : {}),
        ...(defaults.approvalPolicy
          ? { approvalPolicy: defaults.approvalPolicy }
          : {}),
      }));
      if (defaults.approvalPolicy) approvalSource.current = "server";
    },
    [],
  );

  const resetAccessSettings = useCallback(() => {
    permissionSource.current = "fallback";
    approvalSource.current = "fallback";
    setState((current) => ({
      ...current,
      permission: ":workspace",
      approvalPolicy: "on-request",
    }));
  }, []);

  const selectPermission = useCallback((permission: Permission) => {
    permissionSource.current = "user";
    setState((current) => ({ ...current, permission }));
  }, []);

  const selectApprovalPolicy = useCallback((approvalPolicy: ApprovalPolicy) => {
    approvalSource.current = "user";
    setState((current) => ({ ...current, approvalPolicy }));
  }, []);

  const setModel = useCallback((model: string) => {
    setState((current) => ({ ...current, model }));
  }, []);
  const setEffort = useCallback((effort: string) => {
    setState((current) => ({ ...current, effort }));
  }, []);
  const setPersonality = useCallback((personality: Personality) => {
    setState((current) => ({ ...current, personality }));
  }, []);
  const setCollaborationMode = useCallback(
    (collaborationMode: CollaborationMode) => {
      setState((current) => ({ ...current, collaborationMode }));
    },
    [],
  );

  return {
    ...state,
    applyServerDefaults,
    applyServerSettings,
    approvalPolicyForStart:
      approvalSource.current === "fallback" ? undefined : state.approvalPolicy,
    permissionForStart:
      permissionSource.current === "fallback" ? undefined : state.permission,
    resetAccessSettings,
    selectApprovalPolicy,
    selectPermission,
    setCollaborationMode,
    setEffort,
    setModel,
    setPersonality,
  };
}
