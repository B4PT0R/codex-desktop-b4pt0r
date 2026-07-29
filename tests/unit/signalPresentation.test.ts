import { describe, expect, it } from "vitest";
import {
  completedSignal,
  signalFromItem,
  signalFromNotification,
} from "../../src/lib/signalPresentation";
import { translate } from "../../src/i18n/translate";

describe("signaux agent", () => {
  it.each([
    "reasoning",
    "plan",
    "subAgentActivity",
    "enteredReviewMode",
    "exitedReviewMode",
    "contextCompaction",
    "hookPrompt",
  ])("présente %s", (type) =>
    expect(
      signalFromItem({
        id: "1",
        type,
        summary: ["Analyse"],
        text: "Étapes",
        review: "diff",
        kind: "thinking",
      }),
    ).toBeDefined(),
  );

  it.each([
    "commandExecution",
    "fileChange",
    "mcpToolCall",
    "agentMessage",
    "userMessage",
  ])("ignore %s", (type) =>
    expect(signalFromItem({ id: "1", type })).toBeUndefined(),
  );

  it("ignore un raisonnement sans résumé visible", () => {
    expect(
      signalFromItem({ id: "reasoning-empty", type: "reasoning", summary: [] }),
    ).toBeUndefined();
  });

  it("présente les plans structurés", () =>
    expect(
      signalFromNotification({
        method: "turn/plan/updated",
        params: {
          turnId: "t",
          plan: [{ step: "Tester", status: "inProgress" }],
        },
      }),
    ).toMatchObject({
      kind: "plan",
      steps: [{ step: "Tester", status: "inProgress" }],
      status: "running",
    }));

  it("met à jour discrètement le cycle d’exécution des hooks", () => {
    const run = {
      id: "hook-1",
      eventName: "postToolUse",
      statusMessage: "Vérification du projet",
      entries: [],
    };
    expect(
      signalFromNotification({
        method: "hook/started",
        params: { threadId: "thread-1", run: { ...run, status: "running" } },
      }),
    ).toMatchObject({
      id: "hook-hook-1",
      kind: "agent",
      title: "Vérification du projet",
      status: "running",
    });
    expect(
      signalFromNotification({
        method: "hook/completed",
        params: {
          threadId: "thread-1",
          run: {
            ...run,
            status: "failed",
            entries: [{ kind: "error", text: "Lint en échec" }],
          },
        },
      }),
    ).toMatchObject({
      id: "hook-hook-1",
      kind: "warning",
      detail: "Lint en échec",
      status: "error",
    });
  });

  it("présente les vérifications de compte et le buffering de sécurité", () => {
    expect(
      signalFromNotification({
        method: "model/verification",
        params: {
          turnId: "turn-1",
          verifications: ["trustedAccessForCyber"],
        },
      }),
    ).toMatchObject({
      id: "verification-turn-1",
      title: "Vérification de compte requise",
      status: "error",
    });
    expect(
      signalFromNotification({
        method: "model/safetyBuffering/updated",
        params: {
          turnId: "turn-1",
          showBufferingUi: true,
          fasterModel: "gpt-5.4-mini",
        },
      }),
    ).toMatchObject({
      id: "safety-buffering-turn-1",
      title: "Vérification de sécurité en cours",
      detail: expect.stringContaining("gpt-5.4-mini"),
      status: "running",
    });
    expect(
      signalFromNotification({
        method: "model/safetyBuffering/updated",
        params: { turnId: "turn-1", showBufferingUi: false },
      }),
    ).toMatchObject({ status: "done" });
  });

  it("distingue les erreurs temporaires et terminales", () => {
    expect(
      signalFromNotification({
        method: "error",
        params: {
          turnId: "turn-1",
          willRetry: true,
          error: { message: "Connexion instable" },
        },
      }),
    ).toMatchObject({
      title: "Incident temporaire — nouvelle tentative",
      detail: "Connexion instable",
      status: "running",
    });
    expect(
      signalFromNotification({
        method: "error",
        params: {
          turnId: "turn-2",
          willRetry: false,
          error: {
            message: "Quota atteint",
            additionalDetails: "Réessayez après le reset.",
          },
        },
      }),
    ).toMatchObject({
      title: "Le tour s’est interrompu",
      detail: "Quota atteint\n\nRéessayez après le reset.",
      status: "error",
    });
  });

  it("ignore les étapes de plan mal formées", () =>
    expect(
      signalFromNotification({
        method: "turn/plan/updated",
        params: { turnId: "t", plan: [null, { step: 4 }, "invalid"] },
      }),
    ).toMatchObject({ steps: [], status: "running" }));

  it("présente une erreur protocole sans reprendre le contenu brut", () =>
    expect(
      signalFromNotification({ method: "client/protocol/error" }),
    ).toMatchObject({
      title: "Message App Server illisible",
      detail: expect.not.stringContaining("payload"),
      status: "error",
    }));

  it("finalise un raisonnement avec son résumé", () =>
    expect(
      completedSignal(
        {
          id: "1",
          kind: "reasoning",
          title: "Raisonnement",
          status: "running",
        },
        { type: "reasoning", summary: ["Résumé"] },
      ),
    ).toMatchObject({ detail: "Résumé", status: "done" }));

  it("distingue la compaction en cours de la compaction terminée", () => {
    const running = signalFromItem({ id: "compact-1", type: "contextCompaction" });
    expect(running).toMatchObject({
      title: "Compaction du contexte",
      status: "running",
    });
    expect(
      completedSignal(running!, {
        id: "compact-1",
        type: "contextCompaction",
      }),
    ).toMatchObject({
      title: "Contexte compacté",
      detail: undefined,
      status: "done",
    });
  });

  it("ignore un item sans identifiant ou de forme invalide", () => {
    expect(signalFromItem({ type: "reasoning" })).toBeUndefined();
    expect(signalFromItem("reasoning")).toBeUndefined();
  });

  it("présente les signaux de repli avec le pack anglais", () => {
    const t = (
      key: Parameters<typeof translate>[1],
      params?: Record<string, string | number>,
    ) => translate("en", key, params);
    expect(
      signalFromItem({ id: "1", type: "contextCompaction" }, t),
    ).toMatchObject({
      title: "Compacting context",
      detail: "The conversation is being summarized to free up context.",
      status: "running",
    });
    expect(
      signalFromNotification({ method: "warning", params: {} }, t),
    ).toMatchObject({ title: "Warning" });
  });
});
