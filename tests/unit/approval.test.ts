import { describe, expect, it } from "vitest";
import { approvalFromMessage, approvalResponse } from "../../src/lib/approval";
import { translate } from "../../src/i18n/translate";

describe("approbations", () => {
  it("parse une demande de commande", () => {
    const approval = approvalFromMessage({
      id: 7,
      method: "item/commandExecution/requestApproval",
      params: {
        command: "rm file",
        cwd: "/tmp",
        availableDecisions: ["accept", "decline"],
      },
    })!;
    expect(approval).toMatchObject({
      requestId: 7,
      kind: "command",
      command: "rm file",
      allowSession: false,
    });
    expect(approvalResponse(approval, "accept")).toEqual({
      decision: "accept",
    });
  });

  it("conserve le choix de session pour un ancien serveur sans décisions", () =>
    expect(
      approvalFromMessage({
        id: 8,
        method: "item/commandExecution/requestApproval",
        params: {},
      }),
    ).toMatchObject({ allowSession: true }));

  it("parse une demande de fichier", () =>
    expect(
      approvalFromMessage({
        id: "x",
        method: "item/fileChange/requestApproval",
        params: { grantRoot: "/outside" },
      }),
    ).toMatchObject({ kind: "file", allowSession: true }));

  it("répond au nouveau protocole de permissions", () => {
    const approval = approvalFromMessage({
      id: 9,
      method: "item/permissions/requestApproval",
      params: {
        permissions: { network: { enabled: true }, fileSystem: null },
      },
    })!;
    expect(approvalResponse(approval, "session")).toEqual({
      permissions: { network: { enabled: true } },
      scope: "session",
    });
    expect(approvalResponse(approval, "decline")).toEqual({
      permissions: {},
      scope: "turn",
    });
  });

  it("ignore les messages et paramètres mal formés", () => {
    expect(
      approvalFromMessage({
        id: 10,
        method: "item/commandExecution/requestApproval",
        params: "invalid",
      }),
    ).toBeUndefined();
    expect(
      approvalFromMessage({
        method: "item/fileChange/requestApproval",
        params: {},
      }),
    ).toBeUndefined();
  });

  it("construit les textes de repli dans la langue active", () => {
    expect(
      approvalFromMessage(
        {
          id: 11,
          method: "item/fileChange/requestApproval",
          params: { grantRoot: "/outside" },
        },
        (key, params) => translate("en", key, params),
      ),
    ).toMatchObject({
      title: "Allow these changes?",
      description: "Codex wants to modify /outside.",
    });
  });
});
