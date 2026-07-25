import { describe, expect, it } from "vitest";
import {
  threadRuntimeSettings,
  threadRuntimeSettingsFromNotification,
} from "../../src/lib/threadRuntimeSettings";

describe("réglages effectifs d'un thread", () => {
  it("préfère les valeurs résolues par App Server", () => {
    expect(
      threadRuntimeSettings({
        thread: { id: "thread-1", cwd: "/thread/fallback" },
        cwd: "/project",
        model: "gpt-5.6",
        reasoningEffort: "xhigh",
        activePermissionProfile: {
          id: ":danger-full-access",
          extends: ":workspace",
        },
        approvalPolicy: "never",
      }),
    ).toEqual({
      cwd: "/project",
      model: "gpt-5.6",
      effort: "xhigh",
      permission: ":danger-full-access",
      approvalPolicy: "never",
    });
  });

  it("retombe uniquement sur le cwd du thread et ignore les champs malformés", () => {
    expect(
      threadRuntimeSettings({
        thread: { id: "thread-1", cwd: "/thread" },
        model: undefined,
        reasoningEffort: null,
        activePermissionProfile: null,
      }),
    ).toEqual({
      cwd: "/thread",
      model: undefined,
      effort: undefined,
      permission: undefined,
    });
  });

  it.each([
    ["dangerFullAccess", ":danger-full-access"],
    ["readOnly", ":read-only"],
    ["workspaceWrite", ":workspace"],
  ] as const)(
    "retombe sur la politique sandbox effective %s quand le profil est inconnu",
    (type, permission) => {
      expect(
        threadRuntimeSettings({
          thread: { id: "thread-1" },
          activePermissionProfile: null,
          sandbox: { type },
        }),
      ).toMatchObject({ permission });
    },
  );

  it("préfère le profil actif à la politique sandbox legacy", () => {
    expect(
      threadRuntimeSettings({
        thread: { id: "thread-1" },
        activePermissionProfile: { id: "custom-profile" },
        sandbox: { type: "dangerFullAccess" },
      }),
    ).toMatchObject({ permission: "custom-profile" });
  });

  it("normalise la notification de réglages avec les champs effectifs", () => {
    expect(
      threadRuntimeSettingsFromNotification({
        threadId: "thread-1",
        threadSettings: {
          cwd: "/managed",
          model: "gpt-5.6",
          effort: "high",
          personality: "friendly",
          collaborationMode: { mode: "plan", settings: { model: "gpt-5.6" } },
          activePermissionProfile: { id: ":read-only" },
          sandboxPolicy: { type: "dangerFullAccess" },
          approvalPolicy: "untrusted",
        },
      }),
    ).toEqual({
      cwd: "/managed",
      model: "gpt-5.6",
      effort: "high",
      personality: "friendly",
      collaborationMode: "plan",
      permission: ":read-only",
      approvalPolicy: "untrusted",
    });
  });
});
