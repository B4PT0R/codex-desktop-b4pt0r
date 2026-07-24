import { describe, expect, it } from "vitest";
import { threadRuntimeSettings } from "../../src/lib/threadRuntimeSettings";

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
      }),
    ).toEqual({
      cwd: "/project",
      model: "gpt-5.6",
      effort: "xhigh",
      permission: ":danger-full-access",
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
});
