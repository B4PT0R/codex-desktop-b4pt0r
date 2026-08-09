import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv from "ajv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appEnabledConfigWriteParams,
  appsConfigBatchWriteParams,
  appsInstalledParams,
  automationThreadResumeParams,
  subagentDescendantsListParams,
  threadReadParams,
  threadReadWithTurnsParams,
  automationThreadSecurityRestoreParams,
  automationThreadStartParams,
  automationTurnStartParams,
  accountReadParams,
  appsListParams,
  appsReadParams,
  backgroundTerminalsListParams,
  backgroundTerminalTerminateParams,
  collaborationModeListParams,
  configReadParams,
  configValueWriteParams,
  consumeRateLimitResetCreditParams,
  creditsNudgeParams,
  externalAgentDetectParams,
  externalAgentImportParams,
  fuzzyFileSearchSessionStartParams,
  fuzzyFileSearchSessionStopParams,
  fuzzyFileSearchSessionUpdateParams,
  cancelLoginParams,
  chatgptLoginParams,
  realtimeEphemeralThreadStartParams,
  realtimeStartParams,
  realtimeListVoicesParams,
  realtimeThreadForkParams,
  mcpServerStatusListParams,
  mcpServerOauthLoginParams,
  mcpServerConfigWriteParams,
  mcpServerConfigRemoveParams,
  hooksListParams,
  permissionProfileListParams,
  pluginEnabledWriteParams,
  pluginInstalledParams,
  skillsConfigWriteParams,
  skillsExtraRootsSetParams,
  skillsListParams,
  threadArchiveParams,
  threadBehaviorUpdateParams,
  threadApprovalPolicyUpdateParams,
  threadCompactParams,
  threadDeleteParams,
  threadCwdUpdateParams,
  threadForkParams,
  threadResumeParams,
  threadSearchParams,
  threadGoalClearParams,
  threadGoalGetParams,
  threadGoalSaveParams,
  threadGoalStatusParams,
  threadInjectTranscriptParams,
  threadInjectAutoReviewApprovalParams,
  threadPermissionUpdateParams,
  threadServiceTierUpdateParams,
  threadShellCommandParams,
  threadSetNameParams,
  threadSectionMoveParams,
  threadStartParams,
  threadUnsubscribeParams,
  threadTurnsListParams,
  threadUnarchiveParams,
  turnStartParams,
  turnSteerParams,
  fileOpenerConfigWriteParams,
  modelVerbosityConfigWriteParams,
  planReasoningEffortConfigWriteParams,
  reasoningSummaryConfigWriteParams,
  remoteControlClientRevokeParams,
  remoteControlClientsListParams,
  remoteControlDisableParams,
  remoteControlEnableParams,
  remoteControlPairingStartParams,
  remoteControlPairingStatusParams,
  webSearchConfigWriteParams,
} from "../../src/lib/protocol";
import { userInputResponse } from "../../src/lib/userInput";
import { mcpElicitationResponse } from "../../src/lib/mcpElicitation";
import { dynamicToolSuccess } from "../../src/lib/schedulerTools";
let directory = "";
const validators = new Map<string, ReturnType<Ajv["compile"]>>();
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "codex-desktop-schema-"));
  execFileSync("codex", [
    "app-server",
    "generate-json-schema",
    "--out",
    directory,
    "--experimental",
  ]);
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));
function validates(name: string, value: unknown) {
  let validate = validators.get(name);
  if (!validate) {
    const v2Path = join(directory, "v2", `${name}.json`);
    const schemaPath = existsSync(v2Path)
      ? v2Path
      : join(directory, `${name}.json`);
    validate = new Ajv({ strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, "utf8")),
    );
    validators.set(name, validate);
  }
  expect(validate(value), JSON.stringify(validate.errors, null, 2)).toBe(true);
}
function schema(name: string): Record<string, unknown> {
  const v2Path = join(directory, "v2", `${name}.json`);
  const schemaPath = existsSync(v2Path)
    ? v2Path
    : join(directory, `${name}.json`);
  return JSON.parse(readFileSync(schemaPath, "utf8")) as Record<
    string,
    unknown
  >;
}
describe("contrat Codex installé", () => {
  it("accepte les threads et tours utilisés par les tâches planifiées", () => {
    validates("ThreadStartParams", automationThreadStartParams("/tmp/project"));
    validates(
      "ThreadStartParams",
      automationThreadStartParams("/tmp/project", true),
    );
    validates(
      "ThreadResumeParams",
      automationThreadResumeParams("01900000-0000-7000-8000-000000000000"),
    );
    validates(
      "TurnStartParams",
      automationTurnStartParams(
        "01900000-0000-7000-8000-000000000000",
        "Repository review",
        "Inspect the repository",
      ),
    );
    validates(
      "TurnStartParams",
      automationTurnStartParams(
        "01900000-0000-7000-8000-000000000000",
        "Unattended review",
        "Inspect the repository",
        true,
      ),
    );
    validates(
      "ThreadSettingsUpdateParams",
      automationThreadSecurityRestoreParams(
        "01900000-0000-7000-8000-000000000000",
        ":workspace",
        "on-request",
      ),
    );
  });

  it("accepte la lecture sans tours des métadonnées d'un thread", () => {
    validates(
      "ThreadReadParams",
      threadReadParams("01900000-0000-7000-8000-000000000000"),
    );
  });
  it("accepte la découverte et le replay des threads de sous-agents", () => {
    const threadId = "01900000-0000-7000-8000-000000000000";
    validates("ThreadListParams", subagentDescendantsListParams(threadId));
    validates("ThreadReadParams", threadReadWithTurnsParams(threadId));
  });
  it("accepte la lecture de la configuration Codex effective", () =>
    validates("ConfigReadParams", configReadParams("/tmp/project")));
  it("accepte l'écriture du mode global de recherche web", () =>
    validates("ConfigValueWriteParams", webSearchConfigWriteParams("cached")));
  it("accepte l’écriture ciblée des options Codex globales", () => {
    validates("ConfigValueWriteParams", fileOpenerConfigWriteParams("cursor"));
    validates(
      "ConfigValueWriteParams",
      reasoningSummaryConfigWriteParams("concise"),
    );
    validates(
      "ConfigValueWriteParams",
      modelVerbosityConfigWriteParams("medium"),
    );
    validates(
      "ConfigValueWriteParams",
      planReasoningEffortConfigWriteParams("high"),
    );
  });
  it("accepte les contrôles globaux et la réinitialisation de la mémoire", () => {
    validates(
      "ConfigValueWriteParams",
      configValueWriteParams("features.memories", true),
    );
    validates(
      "ConfigValueWriteParams",
      configValueWriteParams("memories.use_memories", false),
    );
    expect(schema("MemoryResetResponse")).toBeDefined();
  });
  it("accepte le cycle de vie complet du contrôle à distance", () => {
    validates("NullableRemoteControlEnableParams", remoteControlEnableParams());
    validates(
      "NullableRemoteControlDisableParams",
      remoteControlDisableParams(),
    );
    validates(
      "RemoteControlPairingStartParams",
      remoteControlPairingStartParams(),
    );
    validates(
      "RemoteControlPairingStatusParams",
      remoteControlPairingStatusParams("pair-1"),
    );
    validates(
      "RemoteControlClientsListParams",
      remoteControlClientsListParams("env-1"),
    );
    validates(
      "RemoteControlClientsRevokeParams",
      remoteControlClientRevokeParams("env-1", "client-1"),
    );
    expect(schema("RemoteControlStatusReadResponse")).toBeDefined();
    expect(schema("RemoteControlStatusChangedNotification")).toBeDefined();
  });
  it("expose les contraintes administrées et le rechargement MCP", () => {
    expect(schema("ConfigRequirementsReadResponse")).toHaveProperty(
      "properties.requirements",
    );
    expect(schema("McpServerRefreshResponse")).toBeDefined();
    validates(
      "ConfigValueWriteParams",
      mcpServerConfigWriteParams({
        name: "docs",
        transport: "http",
        url: "https://mcp.example.test",
        startupTimeoutSec: 15,
        defaultToolsApprovalMode: "prompt",
        envHttpHeaders: { Authorization: "MCP_AUTH_HEADER" },
      }),
    );
    validates("ConfigValueWriteParams", mcpServerConfigRemoveParams("docs"));
  });
  it("accepte le démarrage et l’annulation du login ChatGPT", () => {
    validates("LoginAccountParams", chatgptLoginParams());
    validates("CancelLoginAccountParams", cancelLoginParams("login-1"));
  });
  it("accepte l’inventaire et l’activation globale des Apps", () => {
    validates("AppsListParams", appsListParams("thr_1"));
    validates("AppsInstalledParams", appsInstalledParams("thr_1"));
    validates("AppsReadParams", appsReadParams(["github"]));
    validates(
      "ConfigValueWriteParams",
      appEnabledConfigWriteParams("google.drive", false),
    );
    validates("ConfigBatchWriteParams", appsConfigBatchWriteParams({
      appId: "github",
      enabled: true,
      approvalsReviewer: null,
      destructiveEnabled: false,
      openWorldEnabled: true,
      defaultToolsApprovalMode: "prompt",
      defaultToolsEnabled: true,
      tools: { search: { enabled: true, approvalMode: "auto" } },
    }));
  });
  it("accepte la consommation d’un ticket de reset", () =>
    validates(
      "ConsumeAccountRateLimitResetCreditParams",
      consumeRateLimitResetCreditParams("attempt-1", "credit-1"),
    ));
  it("accepte l’alerte de crédits au propriétaire", () =>
    validates("SendAddCreditsNudgeEmailParams", creditsNudgeParams("credits")));
  it("accepte thread/start", () =>
    validates(
      "ThreadStartParams",
      threadStartParams(
        "/tmp/project",
        "gpt-5.4",
        ":workspace",
        undefined,
        undefined,
        undefined,
        "Desktop developer instructions",
      ),
    ));
  it("accepte les outils dynamiques du scheduler et leur réponse", () => {
    validates(
      "ThreadStartParams",
      threadStartParams("/tmp/project", "gpt-5.4", ":workspace"),
    );
    validates("DynamicToolCallResponse", dynamicToolSuccess({ queued: true }));
  });
  it("laisse Codex choisir le profil par défaut d'un nouveau thread", () =>
    validates(
      "ThreadStartParams",
      threadStartParams("/tmp/project", "gpt-5.4", undefined),
    ));
  it("accepte thread/archive", () =>
    validates("ThreadArchiveParams", threadArchiveParams("thr_1")));
  it("accepte le fork éphémère d’une conversation Realtime", () =>
    validates(
      "ThreadForkParams",
      realtimeThreadForkParams(
        "thr_1",
        "/tmp/project",
        "gpt-5.4",
        ":workspace",
      ),
    ));
  it("accepte un thread Realtime éphémère sans parent persistant", () =>
    validates(
      "ThreadStartParams",
      realtimeEphemeralThreadStartParams(
        "/tmp/project",
        "gpt-5.4",
        ":workspace",
      ),
    ));
  it("accepte thread/unarchive", () =>
    validates("ThreadUnarchiveParams", threadUnarchiveParams("thr_1")));
  it("accepte le désabonnement du fork Realtime", () =>
    validates(
      "ThreadUnsubscribeParams",
      threadUnsubscribeParams("thr_realtime"),
    ));
  it("accepte l’injection du transcript Realtime", () => {
    validates(
      "ThreadInjectItemsParams",
      threadInjectTranscriptParams(
        "thr_1",
        "user",
        "Question vocale",
        "msg_rtv_user_1",
      ),
    );
    validates(
      "ThreadInjectItemsParams",
      threadInjectTranscriptParams(
        "thr_1",
        "assistant",
        "Réponse vocale",
        "msg_rtv_assistant_1",
      ),
    );
  });
  it("accepte l’autorisation précise d’un refus de relecture automatique", () =>
    validates(
      "ThreadInjectItemsParams",
      threadInjectAutoReviewApprovalParams("thr_1", {
        type: "command",
        command: "git push",
        cwd: "/tmp/project",
        source: "shell",
      }),
    ));
  it("accepte la suppression définitive d’une conversation", () =>
    validates("ThreadDeleteParams", threadDeleteParams("thr_1")));
  it("accepte le renommage et la compaction", () => {
    validates(
      "ThreadSetNameParams",
      threadSetNameParams("thr_1", "Nouveau nom"),
    );
    validates("ThreadCompactStartParams", threadCompactParams("thr_1"));
  });
  it("accepte la mutation des conversations épinglées", () => {
    validates(
      "ThreadSectionMoveParams",
      threadSectionMoveParams(
        "thr_1",
        "01984de2-8f74-7c91-a3b2-5c5e937cf318",
      ),
    );
    validates("ThreadSectionMoveParams", threadSectionMoveParams("thr_1", null));
  });
  it("accepte la création d’une branche", () =>
    validates("ThreadForkParams", threadForkParams("thr_1")));
  it("accepte une reprise avec une page initiale récente", () =>
    validates(
      "ThreadResumeParams",
      threadResumeParams("thr_1", "Desktop developer instructions"),
    ));
  it("expose les réglages effectifs après création et reprise", () => {
    for (const name of ["ThreadStartResponse", "ThreadResumeResponse"]) {
      const properties = schema(name).properties as Record<string, unknown>;
      expect(properties).toHaveProperty("cwd");
      expect(properties).toHaveProperty("model");
      expect(properties).toHaveProperty("reasoningEffort");
      expect(properties).toHaveProperty("activePermissionProfile");
      expect(properties).toHaveProperty("serviceTier");
    }
  });
  it("annonce les tiers modèles et les relecteurs autorisés", () => {
    expect(JSON.stringify(schema("ModelListResponse"))).toContain(
      '"serviceTiers"',
    );
    expect(JSON.stringify(schema("ConfigRequirementsReadResponse"))).toContain(
      '"allowedApprovalsReviewers"',
    );
  });
  it("notifie les réglages effectifs complets d’un thread", () => {
    const properties = schema("ThreadSettingsUpdatedNotification")
      .properties as Record<string, unknown>;
    expect(properties).toHaveProperty("threadId");
    expect(properties).toHaveProperty("threadSettings");
  });
  it("accepte la pagination des tours précédents", () =>
    validates(
      "ThreadTurnsListParams",
      threadTurnsListParams("thr_1", "cursor-1"),
    ));
  it("accepte le cycle de vie d’un objectif persistant", () => {
    validates("ThreadGoalGetParams", threadGoalGetParams("thr_1"));
    validates("ThreadGoalClearParams", threadGoalClearParams("thr_1"));
    validates(
      "ThreadGoalSetParams",
      threadGoalSaveParams("thr_1", "Livrer une interface stable", 50_000),
    );
    validates("ThreadGoalSetParams", threadGoalStatusParams("thr_1", "paused"));
  });
  it("accepte la recherche globale de conversations", () =>
    validates("ThreadSearchParams", threadSearchParams("navigation")));
  it("accepte une commande shell locale de thread", () =>
    validates(
      "ThreadShellCommandParams",
      threadShellCommandParams("thr_1", "git status"),
    ));
  it("accepte le cwd dans thread/settings/update", () =>
    validates(
      "ThreadSettingsUpdateParams",
      threadCwdUpdateParams("thr_1", "/tmp/autre"),
    ));
  it("accepte le comportement dans thread/settings/update", () =>
    validates(
      "ThreadSettingsUpdateParams",
      threadBehaviorUpdateParams(
        "thr_1",
        "gpt-5.4",
        "medium",
        "pragmatic",
        "default",
        ":workspace",
        "never",
      ),
    ));
  it("accepte des mises à jour indépendantes de permission et d’approbation", () => {
    validates(
      "ThreadSettingsUpdateParams",
      threadPermissionUpdateParams("thr_1", ":danger-full-access"),
    );
    validates(
      "ThreadSettingsUpdateParams",
      threadApprovalPolicyUpdateParams("thr_1", "never"),
    );
    validates(
      "ThreadSettingsUpdateParams",
      threadServiceTierUpdateParams("thr_1", "fast"),
    );
  });
  it("accepte turn/start", () =>
    validates(
      "TurnStartParams",
      turnStartParams(
        "thr_1",
        "gpt-5.4",
        "bonjour",
        [
          { type: "localImage", path: "/tmp/image.png" },
          {
            type: "skill",
            name: "use-shared-browser",
            path: "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md",
          },
        ],
        {
          effort: "high",
          personality: "friendly",
          mode: "plan",
          serviceTier: "fast",
        },
      ),
    ));
  it("accepte l’inventaire et le toggle des plugins installés", () => {
    validates("PluginInstalledParams", pluginInstalledParams("/tmp/project"));
    validates(
      "ConfigValueWriteParams",
      pluginEnabledWriteParams("drive@openai", false),
    );
  });
  it("accepte turn/steer", () =>
    validates(
      "TurnSteerParams",
      turnSteerParams("thr_1", "turn_1", "Continue", [
        { type: "localImage", path: "/tmp/image.png" },
      ]),
    ));
  it("accepte Realtime WebSocket", () =>
    validates(
      "ThreadRealtimeStartParams",
      realtimeStartParams(
        "thr_1",
        { type: "websocket" },
        "juniper",
        "conversation",
        [{ role: "developer", text: "Effective AGENTS.md instructions" }],
      ),
    ));
  it("accepte Realtime WebRTC", () =>
    validates(
      "ThreadRealtimeStartParams",
      realtimeStartParams("thr_1", { type: "webrtc", sdp: "v=0" }, "maple"),
    ));
  it("accepte Realtime v2 texte en mode dictée sans handoff", () =>
    validates(
      "ThreadRealtimeStartParams",
      realtimeStartParams(
        "thr_1",
        { type: "websocket" },
        "juniper",
        "dictation",
      ),
    ));
  it("accepte l’inventaire vocal Realtime v3", () =>
    validates("ThreadRealtimeListVoicesParams", realtimeListVoicesParams()));
  it("accepte une réponse à request_user_input", () =>
    validates(
      "ToolRequestUserInputResponse",
      userInputResponse({ scope: "Ciblée" }),
    ));
  it("accepte les demandes et réponses d’elicitation MCP", () => {
    validates("McpServerElicitationRequestParams", {
      threadId: "thr_1",
      turnId: "turn_1",
      serverName: "calendar",
      mode: "form",
      _meta: null,
      message: "Choisissez une couleur",
      requestedSchema: {
        type: "object",
        properties: {
          color: { type: "string", enum: ["blue", "green"] },
        },
        required: ["color"],
      },
    });
    validates(
      "McpServerElicitationRequestResponse",
      mcpElicitationResponse("accept", { color: "blue" }),
    );
  });
  it("accepte la gestion des terminaux en arrière-plan", () => {
    validates(
      "ThreadBackgroundTerminalsListParams",
      backgroundTerminalsListParams("thr_1"),
    );
    validates(
      "ThreadBackgroundTerminalsTerminateParams",
      backgroundTerminalTerminateParams("thr_1", "42"),
    );
  });
  it("accepte les sessions de recherche fuzzy de fichiers", () => {
    validates(
      "FuzzyFileSearchSessionStartParams",
      fuzzyFileSearchSessionStartParams("search-1", "/tmp/project"),
    );
    validates(
      "FuzzyFileSearchSessionUpdateParams",
      fuzzyFileSearchSessionUpdateParams("search-1", "composer"),
    );
    validates(
      "FuzzyFileSearchSessionStopParams",
      fuzzyFileSearchSessionStopParams("search-1"),
    );
  });
  it("accepte l’inventaire et la configuration des intégrations", () => {
    validates("HooksListParams", hooksListParams("/tmp/project"));
    validates("SkillsListParams", skillsListParams("/tmp/project", true));
    validates(
      "SkillsExtraRootsSetParams",
      skillsExtraRootsSetParams("/opt/Codex Desktop/resources/skills"),
    );
    validates(
      "SkillsConfigWriteParams",
      skillsConfigWriteParams("/tmp/skills/review/SKILL.md", false),
    );
    validates(
      "ListMcpServerStatusParams",
      mcpServerStatusListParams("thr_1", "cursor-1"),
    );
    validates("McpServerStatusUpdatedNotification", {
      threadId: "thr_1",
      name: "github",
      status: "failed",
      error: "token expired",
      failureReason: "reauthenticationRequired",
    });
  });
  it("accepte la détection, l’import et l’historique d’agents externes", () => {
    validates(
      "ExternalAgentConfigDetectParams",
      externalAgentDetectParams("/tmp/project", "cursor"),
    );
    validates(
      "ExternalAgentConfigImportParams",
      externalAgentImportParams(
        [
          {
            itemType: "SKILLS",
            description: "Skills détectés",
            cwd: "/tmp/project",
            details: { skills: [{ name: "review" }] },
          },
        ],
        "cursor",
      ),
    );
  });
  it("accepte le démarrage OAuth d’un serveur MCP", () =>
    validates(
      "McpServerOauthLoginParams",
      mcpServerOauthLoginParams("github", "thr_1"),
    ));
  it("accepte les catalogues de capacités et la lecture du compte", () => {
    validates(
      "PermissionProfileListParams",
      permissionProfileListParams("/tmp/project", "cursor-1"),
    );
    validates("CollaborationModeListParams", collaborationModeListParams());
    validates("GetAccountParams", accountReadParams());
  });
});
