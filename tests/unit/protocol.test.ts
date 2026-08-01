import { describe, expect, it } from "vitest";
import {
  appEnabledConfigWriteParams,
  automationThreadResumeParams,
  automationThreadSecurityRestoreParams,
  automationThreadStartParams,
  automationTurnStartParams,
  backgroundTerminalsListParams,
  backgroundTerminalTerminateParams,
  fuzzyFileSearchSessionStartParams,
  fuzzyFileSearchSessionStopParams,
  fuzzyFileSearchSessionUpdateParams,
  mcpServerOauthLoginParams,
  hooksListParams,
  quotasFromRateLimits,
  consumeRateLimitResetCreditParams,
  configReadParams,
  creditsNudgeParams,
  externalAgentDetectParams,
  externalAgentImportHistoriesReadParams,
  externalAgentImportParams,
  cancelLoginParams,
  chatgptLoginParams,
  realtimeStartParams,
  realtimeListVoicesParams,
  realtimeEphemeralThreadStartParams,
  realtimeThreadForkParams,
  threadBehaviorUpdateParams,
  threadApprovalPolicyUpdateParams,
  threadSearchParams,
  threadGoalClearParams,
  threadGoalGetParams,
  threadGoalSaveParams,
  threadGoalStatusParams,
  threadInjectTranscriptParams,
  threadPermissionUpdateParams,
  threadServiceTierUpdateParams,
  threadShellCommandParams,
  threadCompactParams,
  threadCwdUpdateParams,
  threadForkParams,
  threadResumeParams,
  threadSetNameParams,
  threadStartParams,
  threadUnsubscribeParams,
  threadTurnsListParams,
  threadReadParams,
  turnStartParams,
  turnSteerParams,
  scheduledTaskPrompt,
} from "../../src/lib/protocol";
describe("constructeurs JSON-RPC", () => {
  it("échappe l’identifiant d’une App dans sa clé de configuration", () => {
    expect(appEnabledConfigWriteParams('drive.team"one\\two', false)).toEqual({
      keyPath: 'apps."drive.team\\"one\\\\two".enabled',
      value: false,
      mergeStrategy: "upsert",
    });
  });
  it("lit les métadonnées d'un thread sans charger ni modifier son état", () => {
    expect(threadReadParams("thread-1")).toEqual({
      threadId: "thread-1",
      includeTurns: false,
    });
  });

  it("construit une exécution planifiée sans figer les réglages globaux", () => {
    expect(automationThreadStartParams("/project")).toEqual({
      cwd: "/project",
    });
    expect(automationThreadStartParams()).toEqual({});
    expect(automationThreadStartParams("/project", true)).toEqual({
      cwd: "/project",
      ephemeral: true,
    });
    expect(automationThreadResumeParams("thread-1")).toEqual({
      threadId: "thread-1",
      excludeTurns: true,
    });
    expect(
      automationTurnStartParams("thread-1", "Veille", "Inspecte le dépôt"),
    ).toEqual({
      threadId: "thread-1",
      input: [
        {
          type: "text",
          text: scheduledTaskPrompt("Veille", "Inspecte le dépôt"),
        },
      ],
    });
    expect(
      automationTurnStartParams("thread-1", "Veille", "Inspecte", true),
    ).toMatchObject({
      permissions: ":danger-full-access",
      approvalPolicy: "never",
    });
    expect(
      automationThreadSecurityRestoreParams(
        "thread-1",
        ":workspace",
        "on-request",
      ),
    ).toEqual({
      threadId: "thread-1",
      permissions: ":workspace",
      approvalPolicy: "on-request",
    });
  });
  it("lit la configuration effective du workspace", () => {
    expect(configReadParams("/tmp/project")).toEqual({
      cwd: "/tmp/project",
      includeLayers: false,
    });
  });
  it("construit le workflow d’import externe sans paramètres superflus", () => {
    const item = {
      itemType: "CONFIG" as const,
      description: "Configuration détectée",
      cwd: null,
    };
    expect(externalAgentDetectParams("/project", "cursor")).toEqual({
      includeHome: true,
      cwds: ["/project"],
      source: null,
      migrationSource: "cursor",
    });
    expect(externalAgentImportParams([item], "cursor")).toEqual({
      migrationItems: [item],
      source: "codex-desktop-linux",
      migrationSource: "cursor",
    });
    expect(externalAgentImportHistoriesReadParams()).toBeUndefined();
  });
  it("construit le cycle de vie d’un objectif de thread", () => {
    expect(threadGoalGetParams("thread-1")).toEqual({ threadId: "thread-1" });
    expect(threadGoalClearParams("thread-1")).toEqual({ threadId: "thread-1" });
    expect(threadGoalSaveParams("thread-1", "Ship it", 20_000)).toEqual({
      threadId: "thread-1",
      objective: "Ship it",
      tokenBudget: 20_000,
    });
    expect(threadGoalStatusParams("thread-1", "paused")).toEqual({
      threadId: "thread-1",
      status: "paused",
    });
  });
  it("construit l’inventaire des hooks pour le projet courant", () => {
    expect(hooksListParams("/project")).toEqual({ cwds: ["/project"] });
    expect(hooksListParams("")).toEqual({ cwds: [] });
  });
  it("construit une commande shell de thread", () => {
    expect(threadShellCommandParams("thread-1", "git status")).toEqual({
      threadId: "thread-1",
      command: "git status",
    });
  });
  it("construit une connexion OAuth MCP liée au thread", () => {
    expect(mcpServerOauthLoginParams("github", "thread-1")).toEqual({
      name: "github",
      threadId: "thread-1",
      scopes: null,
      timeoutSecs: null,
    });
  });
  it("construit une recherche paginée dans l’historique", () => {
    expect(threadSearchParams("navigation", "next")).toEqual({
      searchTerm: "navigation",
      cursor: "next",
      limit: 50,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
  });
  it("construit les sessions de recherche de fichiers", () => {
    expect(fuzzyFileSearchSessionStartParams("search-1", "/work")).toEqual({
      sessionId: "search-1",
      roots: ["/work"],
    });
    expect(fuzzyFileSearchSessionUpdateParams("search-1", "app")).toEqual({
      sessionId: "search-1",
      query: "app",
    });
    expect(fuzzyFileSearchSessionStopParams("search-1")).toEqual({
      sessionId: "search-1",
    });
  });
  it("construit la gestion des terminaux en arrière-plan", () => {
    expect(backgroundTerminalsListParams("thr", "cursor")).toEqual({
      threadId: "thr",
      cursor: "cursor",
      limit: 50,
    });
    expect(backgroundTerminalTerminateParams("thr", "42")).toEqual({
      threadId: "thr",
      processId: "42",
    });
  });
  it("construit le flux ChatGPT hébergé et son annulation", () => {
    expect(chatgptLoginParams()).toEqual({
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "codex",
    });
    expect(cancelLoginParams("login-1")).toEqual({ loginId: "login-1" });
  });
  it("construit une consommation de ticket idempotente", () =>
    expect(consumeRateLimitResetCreditParams("attempt", "credit")).toEqual({
      idempotencyKey: "attempt",
      creditId: "credit",
    }));
  it("construit une alerte de crédits au propriétaire", () =>
    expect(creditsNudgeParams("credits")).toEqual({ creditType: "credits" }));
  it.each([":read-only", ":workspace", ":danger-full-access"] as const)(
    "sérialise %s",
    (permission) =>
      expect(
        threadStartParams("/tmp/project", "gpt-test", permission).permissions,
      ).toBe(permission),
  );
  it("expose les outils du scheduler aux nouveaux threads ordinaires", () => {
    expect(
      threadStartParams("/tmp/project", "gpt-test", ":workspace").dynamicTools,
    ).toEqual([
      expect.objectContaining({
        type: "namespace",
        name: "scheduler",
      }),
    ]);
  });
  it("laisse App Server choisir le profil sans sélection explicite", () =>
    expect(
      threadStartParams("/tmp/project", "gpt-test", undefined),
    ).not.toHaveProperty("permissions"));
  it("omet la personnalité lorsqu’elle n’est pas prise en charge", () => {
    expect(
      threadStartParams("/tmp/project", "gpt-test", ":workspace", undefined),
    ).not.toHaveProperty("personality");
    expect(
      turnStartParams("thr", "gpt-test", "go", [], {
        effort: "high",
        personality: undefined,
        mode: "default",
      }),
    ).not.toHaveProperty("personality");
    expect(
      threadBehaviorUpdateParams(
        "thr",
        "gpt-test",
        "high",
        undefined,
        "default",
        ":workspace",
        "on-request",
      ),
    ).not.toHaveProperty("personality");
  });
  it("transmet explicitement une politique d’approbation sélectionnée", () =>
    expect(
      threadStartParams(
        "/tmp/project",
        "gpt-test",
        ":danger-full-access",
        "pragmatic",
        "never",
      ),
    ).toMatchObject({
      permissions: ":danger-full-access",
      approvalPolicy: "never",
    }));
  it("transmet un tier explicite au thread et au tour", () => {
    expect(
      threadStartParams(
        "/tmp/project",
        "gpt-test",
        ":workspace",
        "pragmatic",
        "on-request",
        "fast",
      ),
    ).toMatchObject({ serviceTier: "fast" });
    expect(
      turnStartParams("thr", "gpt-test", "go", [], {
        effort: "high",
        serviceTier: "fast",
      }),
    ).toMatchObject({ serviceTier: "fast" });
    expect(threadServiceTierUpdateParams("thr", null)).toEqual({
      threadId: "thr",
      serviceTier: null,
    });
  });
  it("isole les changements rapides de permission et d’approbation", () => {
    expect(threadPermissionUpdateParams("thr", ":danger-full-access")).toEqual({
      threadId: "thr",
      permissions: ":danger-full-access",
    });
    expect(
      threadPermissionUpdateParams("thr", ":danger-full-access"),
    ).not.toHaveProperty("approvalPolicy");
    expect(threadApprovalPolicyUpdateParams("thr", "never")).toEqual({
      threadId: "thr",
      approvalPolicy: "never",
    });
    expect(threadApprovalPolicyUpdateParams("thr", "never")).not.toHaveProperty(
      "permissions",
    );
  });
  it("laisse App Server choisir le cwd par défaut", () =>
    expect(
      threadStartParams(undefined, "gpt-test", ":workspace"),
    ).not.toHaveProperty("cwd"));
  it("exclut les anciens noms camelCase", () =>
    expect(
      JSON.stringify(threadStartParams("/tmp", "gpt-test", ":workspace")),
    ).not.toContain("workspaceWrite"));
  it("transforme les pièces jointes", () =>
    expect(
      turnStartParams("thr", "gpt-test", "bonjour", [
        { type: "localImage", path: "/tmp/a.png" },
      ]).input,
    ).toEqual([
      { type: "text", text: "bonjour" },
      { type: "localImage", path: "/tmp/a.png" },
    ]));
  it("conserve une invocation de skill explicite", () =>
    expect(
      turnStartParams("thr", "gpt-test", "$review vérifie", [
        {
          type: "skill",
          name: "review",
          path: "/tmp/skills/review/SKILL.md",
        },
      ]).input,
    ).toEqual([
      { type: "text", text: "$review vérifie" },
      {
        type: "skill",
        name: "review",
        path: "/tmp/skills/review/SKILL.md",
      },
    ]));
  it("applique le comportement au tour", () =>
    expect(
      turnStartParams("thr", "gpt-test", "go", [], {
        effort: "high",
        personality: "friendly",
        mode: "plan",
      }),
    ).toMatchObject({
      effort: "high",
      personality: "friendly",
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-test",
          reasoning_effort: "high",
          developer_instructions: null,
        },
      },
    }));
  it("ajoute une instruction au tour actif", () =>
    expect(
      turnSteerParams("thr", "turn", "Précision", [
        { type: "localImage", path: "/tmp/a.png" },
      ]),
    ).toEqual({
      threadId: "thr",
      expectedTurnId: "turn",
      input: [
        { type: "text", text: "Précision" },
        { type: "localImage", path: "/tmp/a.png" },
      ],
    }));
  it("conserve les mentions d’app structurées", () =>
    expect(
      turnStartParams("thr", "gpt-test", "$github cherche", [
        { type: "mention", name: "GitHub", path: "app://github" },
      ]).input,
    ).toEqual([
      { type: "text", text: "$github cherche" },
      { type: "mention", name: "GitHub", path: "app://github" },
    ]));
  it("modifie le comportement du thread chargé", () =>
    expect(
      threadBehaviorUpdateParams(
        "thr",
        "gpt-test",
        "medium",
        "pragmatic",
        "default",
        ":workspace",
        "never",
      ),
    ).toMatchObject({
      threadId: "thr",
      model: "gpt-test",
      effort: "medium",
      personality: "pragmatic",
      collaborationMode: { mode: "default" },
      permissions: ":workspace",
      approvalPolicy: "never",
    }));
  it("modifie le cwd du thread chargé", () =>
    expect(threadCwdUpdateParams("thr", "/tmp/autre")).toEqual({
      threadId: "thr",
      cwd: "/tmp/autre",
    }));
  it("construit les actions de cycle de vie du thread", () => {
    expect(threadSetNameParams("thr", "Nouveau nom")).toEqual({
      threadId: "thr",
      name: "Nouveau nom",
    });
    expect(threadCompactParams("thr")).toEqual({ threadId: "thr" });
    expect(threadForkParams("thr")).toEqual({ threadId: "thr" });
    expect(threadUnsubscribeParams("thr")).toEqual({ threadId: "thr" });
  });
  it("borne la reprise aux tours récents complets", () =>
    expect(threadResumeParams("thr")).toEqual({
      threadId: "thr",
      initialTurnsPage: {
        limit: 30,
        sortDirection: "desc",
        itemsView: "full",
      },
    }));
  it("pagine les tours précédents avec le curseur opaque", () =>
    expect(threadTurnsListParams("thr", "next-page")).toEqual({
      threadId: "thr",
      cursor: "next-page",
      limit: 30,
      sortDirection: "desc",
      itemsView: "full",
    }));
  it("construit les transports realtime", () => {
    expect(realtimeListVoicesParams()).toEqual({});
    expect(
      realtimeStartParams("thr", { type: "websocket" }, "juniper"),
    ).toMatchObject({
      transport: { type: "websocket" },
      version: "v3",
      model: "gpt-live-1-codex",
      voice: "juniper",
      includeStartupContext: true,
      outputModality: "audio",
      codexResponsesAsItems: false,
      initialItems: [],
    });
    const dictation = realtimeStartParams(
      "thr",
      { type: "websocket" },
      "juniper",
      "dictation",
    );
    expect(dictation).toMatchObject({
      version: "v2",
      outputModality: "text",
      includeStartupContext: false,
      flushTranscriptTailOnSessionEnd: false,
      clientManagedHandoffs: true,
    });
    expect(dictation).not.toHaveProperty("voice");
    expect(
      realtimeStartParams("thr", { type: "webrtc", sdp: "v=0" }, "maple")
        .transport,
    ).toEqual({ type: "webrtc", sdp: "v=0" });
    expect(
      realtimeStartParams(
        "thr",
        { type: "websocket" },
        "juniper",
        "conversation",
        [{ role: "developer", text: "Workspace instructions" }],
      ).initialItems,
    ).toEqual([{ role: "developer", text: "Workspace instructions" }]);
  });
  it("isole les conversations vocales dans un fork éphémère du parent", () => {
    expect(
      realtimeThreadForkParams("parent", "/work", "gpt-5.4", ":workspace"),
    ).toMatchObject({
      threadId: "parent",
      cwd: "/work",
      model: "gpt-5.4",
      permissions: ":workspace",
      ephemeral: true,
      excludeTurns: true,
    });
  });
  it("démarre un thread vocal éphémère quand le parent n’a pas encore de rollout", () => {
    expect(
      realtimeEphemeralThreadStartParams(
        "/work",
        "gpt-5.4",
        ":workspace",
        "friendly",
        "on-request",
      ),
    ).toEqual({
      cwd: "/work",
      model: "gpt-5.4",
      permissions: ":workspace",
      personality: "friendly",
      approvalPolicy: "on-request",
      ephemeral: true,
    });
    expect(
      realtimeEphemeralThreadStartParams(
        "/work",
        "gpt-5.4",
        ":workspace",
      ),
    ).not.toHaveProperty("dynamicTools");
  });
  it("construit les items de transcript à injecter dans le thread principal", () => {
    expect(
      threadInjectTranscriptParams(
        "thr",
        "user",
        "Question vocale",
        "realtime_voice_user_1",
      ),
    ).toEqual({
      threadId: "thr",
      items: [
        {
          id: "realtime_voice_user_1",
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Question vocale" }],
        },
      ],
    });
    expect(
      threadInjectTranscriptParams(
        "thr",
        "assistant",
        "Réponse vocale",
        "realtime_voice_assistant_1",
      ),
    ).toEqual({
      threadId: "thr",
      items: [
        {
          id: "realtime_voice_assistant_1",
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Réponse vocale" }],
        },
      ],
    });
  });
});
describe("quotas", () => {
  it("normalise les fenêtres", () =>
    expect(
      quotasFromRateLimits({
        primary: { usedPercent: 31.6, windowDurationMins: 300, resetsAt: 10 },
        secondary: { usedPercent: 12, windowDurationMins: 10080, resetsAt: 20 },
      }),
    ).toEqual([
      { used: 32, durationMinutes: 300, resetsAt: 10 },
      { used: 12, durationMinutes: 10080, resetsAt: 20 },
    ]));
});
