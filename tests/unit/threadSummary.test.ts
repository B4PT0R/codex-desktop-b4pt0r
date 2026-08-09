import { describe, expect, it } from "vitest";
import {
  isCodexDiscussionWorkspace,
  threadSummary,
} from "../../src/lib/threadSummary";

describe("présentation des conversations", () => {
  it("reconnaît le workspace synthétique des discussions Codex", () => {
    expect(
      isCodexDiscussionWorkspace(
        "/home/user/Documents/Codex/2026-08-05-salut",
      ),
    ).toBe(true);
    expect(isCodexDiscussionWorkspace("/work/project")).toBe(false);
    expect(isCodexDiscussionWorkspace()).toBe(false);
  });

  it("classe les réponses App Server sans exposer la convention de chemin", () => {
    expect(
      threadSummary({
        id: "discussion",
        cwd: "/home/user/Documents/Codex/2026-08-05-salut",
      }),
    ).toMatchObject({ id: "discussion", kind: "discussion" });
    expect(
      threadSummary({ id: "project", cwd: "/work/project" }),
    ).toEqual({
      id: "project",
      name: undefined,
      preview: undefined,
      updatedAt: undefined,
      cwd: "/work/project",
      status: undefined,
      section: undefined,
    });
  });

  it("dérive l’épinglage depuis la section serveur stable", () => {
    expect(
      threadSummary({
        id: "pinned",
        section: {
          id: "01984de2-8f74-7c91-a3b2-5c5e937cf318",
          name: "Pinned",
        },
      }).isPinned,
    ).toBe(true);
    expect(
      threadSummary({
        id: "custom-section",
        section: { id: "section-1", name: "Later" },
      }).isPinned,
    ).toBe(false);
  });
});
