import { describe, expect, it } from "vitest";
import {
  appEnabledConfigWriteParams,
  appsConfigBatchWriteParams,
  appsInstalledParams,
  appsListParams,
  appsReadParams,
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
  mcpServerConfigWriteParams,
  mcpServerConfigRemoveParams,
  pluginEnabledWriteParams,
  pluginInstalledParams,
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
import {
  codexDesktopContext,
  codexDesktopDeveloperInstructions,
} from "../../src/lib/clientContext";
describe("constructeurs JSON-RPC", () => {
  it("construit l’inventaire et le toggle des plugins installés", () => {
    expect(pluginInstalledParams("/project")).toEqual({
      cwds: ["/project"],
      installSuggestionPluginNames: null,
    });
    expect(pluginEnabledWriteParams("drive@openai", false)).toEqual({
      keyPath: "plugins.drive@openai",
      value: { enabled: false },
      mergeStrategy: "upsert",
    });
  });
  it("identifie Codex Desktop dans les instructions de session", () => {
    const expected = codexDesktopDeveloperInstructions("Global instructions");
    expect(
      threadStartParams(undefined, "gpt-test", undefined, undefined, undefined, undefined, expected),
    ).toMatchObject({ developerInstructions: expected });
    expect(threadResumeParams("thr", expected)).toMatchObject({
      developerInstructions: expected,
    });
    expect(expected).toContain("Global instructions");
    expect(expected).toContain("<codex_desktop_context>");
  });
  it("précise les versions natives du client et du backend", () => {
    const context = codexDesktopContext({
      clientVersion: "0.5.1",
      codexVersion: "codex-cli 0.145.0",
    });
    expect(context).toContain(
      "Codex Desktop Linux client version: 0.5.1. Codex CLI backend version: codex-cli 0.145.0.",
    );
    expect(context).toContain(
      "Codex Desktop Linux project repository: https://github.com/B4PT0R/codex-desktop-b4pt0r.",
    );
  });
  it("construit la lecture et l'écriture atomique de la configuration Apps", () => {
    expect(appsInstalledParams("thread-1", true)).toEqual({ threadId: "thread-1", forceRefresh: true });
    expect(appsListParams("thread-1", true, "next-page")).toEqual({ cursor: "next-page", limit: 200, threadId: "thread-1", forceRefetch: true });
    expect(appsReadParams(["github"])).toEqual({ appIds: ["github"], includeTools: true });
    expect(appsConfigBatchWriteParams({
      appId: 'drive.team"one',
      enabled: true,
      approvalsReviewer: "user",
      destructiveEnabled: false,
      openWorldEnabled: true,
      defaultToolsApprovalMode: "prompt",
      defaultToolsEnabled: true,
      tools: { 'search"repos': { enabled: false, approvalMode: "approve" } },
    })).toEqual({
      edits: [
        { keyPath: 'apps."drive.team\\"one".enabled', value: true, mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".approvals_reviewer', value: "user", mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".destructive_enabled', value: false, mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".open_world_enabled', value: true, mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".default_tools_approval_mode', value: "prompt", mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".default_tools_enabled', value: true, mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".tools."search\\"repos".enabled', value: false, mergeStrategy: "replace" },
        { keyPath: 'apps."drive.team\\"one".tools."search\\"repos".approval_mode', value: "approve", mergeStrategy: "replace" },
      ],
      filePath: null,
      expectedVersion: null,
      reloadUserConfig: true,
    });
  });
  it("échappe l’identifiant d’une App dans sa clé de configuration", () => {
    expect(appEnabledConfigWriteParams('drive.team"one\\two', false)).toEqual({
      keyPath: 'apps."drive.team\\"one\\\\two".enabled',
      value: false,
      mergeStrategy: "upsert",
    });
  });
  it("construit les configurations MCP usuelles sans options expertes", () => {
    expect(mcpServerConfigWriteParams({
      name: "docs-local",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@acme/docs"],
      cwd: "/project",
      env: { DOCS_TOKEN: "value" },
    })).toEqual({
      keyPath: 'mcp_servers."docs-local"',
      value: {
        command: "npx",
        args: ["-y", "@acme/docs"],
        cwd: "/project",
        env: { DOCS_TOKEN: "value" },
      },
      mergeStrategy: "upsert",
    });
    expect(mcpServerConfigWriteParams({
      name: "remote",
      transport: "http",
      url: "https://mcp.example.test",
      bearerTokenEnvVar: "MCP_TOKEN",
    }).value).toEqual({
      url: "https://mcp.example.test",
      bearer_token_env_var: "MCP_TOKEN",
    });
  });
  it("traduit les réglages MCP avancés vers les noms natifs de config.toml", () => {
    expect(mcpServerConfigWriteParams({
      name: "remote",
      transport: "http",
      url: "https://mcp.example.test",
      startupTimeoutSec: 15,
      toolTimeoutSec: 90,
      defaultToolsApprovalMode: "writes",
      enabledTools: ["search", "read"],
      disabledTools: ["delete"],
      httpHeaders: { "X-Client": "desktop" },
      envHttpHeaders: { Authorization: "MCP_AUTH_HEADER" },
    }).value).toEqual({
      url: "https://mcp.example.test",
      startup_timeout_sec: 15,
      tool_timeout_sec: 90,
      default_tools_approval_mode: "writes",
      enabled_tools: ["search", "read"],
      disabled_tools: ["delete"],
      http_headers: { "X-Client": "desktop" },
      env_http_headers: { Authorization: "MCP_AUTH_HEADER" },
    });
  });
  it("supprime une table MCP avec la sémantique null documentée", () => {
    expect(mcpServerConfigRemoveParams('docs"local')).toEqual({
      keyPath: 'mcp_servers."docs\\"local"',
      value: null,
      mergeStrategy: "replace",
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
      automationThreadResumeParams("thread-1", "Adult developer instructions"),
    ).toEqual({
      threadId: "thread-1",
      excludeTurns: true,
      developerInstructions: "Adult developer instructions",
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
    ).toEqual({
      threadId: "thr",
      transport: { type: "websocket" },
      version: "v3",
      model: "gpt-live-1-codex",
      voice: "juniper",
      includeStartupContext: true,
      outputModality: "audio",
      flushTranscriptTailOnSessionEnd: true,
      codexResponseHandoffMode: "bemTags",
      codexResponseItemPrefix: null,
      codexResponsesAsItems: false,
      initialItems: [],
      realtimeSessionId: null,
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
    expect(
      realtimeThreadForkParams(
        "parent",
        "/work",
        "gpt-5.4",
        ":workspace",
        "on-request",
        "Adult developer instructions",
      ),
    ).toMatchObject({
      developerInstructions: "Adult developer instructions",
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
        "Adult developer instructions",
      ),
    ).toEqual({
      cwd: "/work",
      model: "gpt-5.4",
      permissions: ":workspace",
      personality: "friendly",
      approvalPolicy: "on-request",
      developerInstructions: "Adult developer instructions",
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
        "msg_rtv_user_1",
      ),
    ).toEqual({
      threadId: "thr",
      items: [
        {
          id: "msg_rtv_user_1",
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
        "msg_rtv_assistant_1",
      ),
    ).toEqual({
      threadId: "thr",
      items: [
        {
          id: "msg_rtv_assistant_1",
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
