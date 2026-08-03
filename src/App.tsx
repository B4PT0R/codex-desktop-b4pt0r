import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, openDialog as open } from "./lib/nativeBridge";
import { ApprovalDialog } from "./components/ApprovalDialog";
import { ArchiveNotice } from "./components/ArchiveNotice";
import { ChatFooter } from "./components/ChatFooter";
import { ChatHeader } from "./components/ChatHeader";
import { Conversation } from "./components/Conversation";
import { SettingsLoader } from "./components/SettingsLoader";
import { ShellCommandDialog } from "./components/ShellCommandDialog";
import { SchedulerToolConfirmationDialog } from "./components/SchedulerToolConfirmationDialog";
import { Sidebar } from "./components/Sidebar";
import { UserInputDialog } from "./components/UserInputDialog";
import { McpElicitationLoader } from "./components/McpElicitationLoader";
import { WorkPanel } from "./components/WorkPanel";
import {
  configureCodexTranslation,
  isDesktopApp,
  request,
  type AppServerMessage,
} from "./lib/codex";
import type {
  AppInfo,
  ConfigReadResponse,
  ThreadListResponse,
  ThreadStartResponse,
} from "./lib/appServerTypes";
import { finishDictationCapture, startDictationCapture } from "./lib/dictation";
import {
  configReadParams,
  threadCwdUpdateParams,
  threadStartParams,
  turnStartParams,
  turnSteerParams,
  type TurnContextItem,
} from "./lib/protocol";
import { appServerRecord, appServerString } from "./lib/appServerValues";
import type { AgentActivity } from "./lib/activity";
import {
  demoTelemetry,
  demoApps,
  demoQuotas,
  demoResetCredits,
  demoSkills,
  demoSubagentTranscripts,
  previewDemoThreads,
  initialPreviewMessages,
  browserPreviewResponse,
  isDemoPreview,
  isReadmeDemoPreview,
  isUpdateDemoPreview,
} from "./lib/demoConversation";
import { useThreadHistory } from "./lib/useThreadHistory";
import { useDemoPlayback } from "./lib/useDemoPlayback";
import { useInteractiveRequests } from "./lib/useInteractiveRequests";
import { useThreadActions } from "./lib/useThreadActions";
import {
  useIntegrations,
  type IntegrationsController,
} from "./lib/useIntegrations";
import { useCapabilityCatalog } from "./lib/useCapabilityCatalog";
import { useAccount } from "./lib/useAccount";
import { useAppUpdate } from "./lib/useAppUpdate";
import { codexDesktopDeveloperInstructions } from "./lib/clientContext";
import { useApps } from "./lib/useApps";
import { useAutomations } from "./lib/useAutomations";
import { useSchedulerTools } from "./lib/useSchedulerTools";
import { useRateLimits } from "./lib/useRateLimits";
import {
  removeDeletedThread,
  removeDeletedThreadTelemetry,
} from "./lib/threadDeletion";
import type { SettingsSectionId } from "./lib/settingsSections";
import { commandFromText } from "./lib/commands";
import { useComposerCommands } from "./lib/useComposerCommands";
import type { ThreadTelemetry } from "./lib/sessionTelemetry";
import type {
  ChatMessage,
  Model,
  ThreadSummary,
  ToolCall,
} from "./types";
import { useI18n } from "./i18n/I18nProvider";
import { useAppServerConnection } from "./lib/useAppServerConnection";
import { useThreadSearch } from "./lib/useThreadSearch";
import { useShellCommand } from "./lib/useShellCommand";
import { useExternalAgentImport } from "./lib/useExternalAgentImport";
import { useRealtimeSettings } from "./lib/useRealtimeSettings";
import { useDefaultThreadSettings } from "./lib/useDefaultThreadSettings";
import {
  readDefaultThreadCatalogEntry,
  useDefaultThreadCatalogEntry,
} from "./lib/useDefaultThreadCatalogEntry";
import { useTrayRealtimeConversation } from "./lib/useTrayRealtimeConversation";
import { ThreadViewStateGuard } from "./lib/threadViewStateGuard";
import { useCodexDefaults } from "./lib/useCodexDefaults";
import { useCodexGlobalSettings } from "./lib/useCodexGlobalSettings";
import { useChatPresentationSettings } from "./lib/useChatPresentationSettings";
import { useBackgroundTerminals } from "./lib/useBackgroundTerminals";
import { useMemorySettings } from "./lib/useMemorySettings";
import { useRemoteControl } from "./lib/useRemoteControl";
import { ThreadTurnCoordinator } from "./lib/threadTurnCoordinator";
import {
  threadRuntimeSettings,
  type ThreadRuntimeSettings,
} from "./lib/threadRuntimeSettings";
import { threadSummary } from "./lib/threadSummary";
import { useConfigRequirements } from "./lib/useConfigRequirements";
import {
  markThreadClosed,
  removeThread,
  restoreThread,
} from "./lib/threadReconciliation";
import { routeAppNotification } from "./lib/appNotificationRouting";
import { useRealtimeConversation } from "./lib/useRealtimeConversation";
import { useConversationEventQueue } from "./lib/useConversationEventQueue";
import { useThreadRuntimeState } from "./lib/useThreadRuntimeState";
import { useThreadRuntimeMutations } from "./lib/useThreadRuntimeMutations";
import { useSubagentTranscripts } from "./lib/useSubagentTranscripts";
import { ThreadNavigationGuard } from "./lib/threadNavigationGuard";
import "./styles.css";
import "./primitives.css";
import "./realtime.css";
import "./activity.css";
import "./empty.css";
import "./signals.css";
import "./tools.css";
import "./telemetry.css";
import "./settings.css";
import "./automation-settings.css";
import "./composer-menus.css";
import "./work-panel.css";
import "./appearance.css";
import "./elicitation.css";
import "./background-terminals.css";
import "./shell-command.css";
const fallbackModels: Model[] = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium", "high", "xhigh"].map(
      (reasoningEffort) => ({ reasoningEffort, description: "" }),
    ),
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium", "high", "xhigh"].map(
      (reasoningEffort) => ({ reasoningEffort, description: "" }),
    ),
  },
  {
    id: "gpt-5.2-codex",
    label: "GPT-5.2 Codex",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium", "high"].map(
      (reasoningEffort) => ({ reasoningEffort, description: "" }),
    ),
  },
];

export default function App() {
  const { t } = useI18n();
  configureCodexTranslation(t);
  const activeThreadRef = useRef<string | undefined>(undefined);
  const workspaceChanged = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
      initialPreviewMessages,
    ),
    [models, setModels] = useState(fallbackModels),
    [busy, setBusy] = useState(false),
    [activity, setActivity] = useState<AgentActivity>(null),
    [dictating, setDictating] = useState(false),
    [dictationProcessing, setDictationProcessing] = useState(false),
    [dictationInsertion, setDictationInsertion] = useState<{
      id: number;
      text: string;
    }>(),
    [threadId, setThreadId] = useState<string>(),
    [turnId, setTurnId] = useState<string>(),
    [threads, setThreads] = useState<ThreadSummary[]>(() =>
      isDemoPreview() ? previewDemoThreads() : [],
    ),
    [threadTelemetry, setThreadTelemetry] = useState<
      Record<string, ThreadTelemetry>
    >({}),
    [sidebar, setSidebar] = useState(true),
    [sidebarWidth, setSidebarWidth] = useState(260),
    [settings, setSettings] = useState<SettingsSectionId | null>(null),
    [appsEnabled, setAppsEnabled] = useState(false),
    [workPanel, setWorkPanel] = useState<ToolCall>();
  const [turnCoordinator] = useState(() => new ThreadTurnCoordinator());
  const [viewStateGuard] = useState(() => new ThreadViewStateGuard());
  const [threadNavigationGuard] = useState(() => new ThreadNavigationGuard());
  const runtime = useThreadRuntimeState({
    model: fallbackModels[0].id,
    effort: "medium",
    personality: "pragmatic",
    collaborationMode: "default",
    permission: ":workspace",
    approvalPolicy: "on-request",
    serviceTier: null,
  });
  const {
    approvalPolicy,
    collaborationMode,
    effort,
    model,
    permission,
    serviceTier,
    setEffort,
    setModel,
  } = runtime;
  const dictationSequence = useRef(0);
  const realtimeStartGeneration = useRef(0);
  const realtimeStartPending = useRef(false);
  const [cwd, setCwd] = useState(
    () => localStorage.getItem("codex-desktop.cwd") ?? "",
  );
  const showError = useCallback((title: string, error: unknown) => {
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        modality: "applicationError",
        title,
        content: String(error),
      },
    ]);
  }, []);
  const demoPlayback = useDemoPlayback({
    enabled: isDemoPreview(),
    scopeKey: threadId,
    setActivity,
    setMessages,
  });
  useEffect(() => {
    let disposed = false;
    void import("./lib/desktopSettings")
      .then(({ loadDesktopSettings }) => loadDesktopSettings())
      .then((settings) => {
        if (!disposed && !workspaceChanged.current && settings.lastWorkspace) {
          setCwd(settings.lastWorkspace);
        }
        if (!disposed && settings.sidebarWidth) {
          setSidebarWidth(settings.sidebarWidth);
        }
      })
      .catch((error) => {
        if (!disposed) showError(t("desktopSettings.loadError"), error);
      });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!isDesktopApp()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen("open-scheduler-settings", () => setSettings("automations"))
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  const integrations = useIntegrations({
    cwd,
    enabled: settings === "skills" || settings === "mcp",
    hooksEnabled: settings === "hooks",
    pluginsEnabled: settings === "plugins",
    threadId,
  });
  const capabilities = useCapabilityCatalog({
    cwd,
    enabled: settings === "agent" || settings === "permissions",
  });
  const account = useAccount(settings === "account");
  const appUpdate = useAppUpdate(true, true);
  const clientVersions = {
    clientVersion: appUpdate.versions?.clientVersion ?? __APP_VERSION__,
    codexVersion: appUpdate.versions?.codexVersion,
  };
  const externalAgentImport = useExternalAgentImport({
    cwd,
    enabled: settings === "advanced",
  });
  const realtime = useRealtimeSettings(settings === "voice");
  const defaultThread = useDefaultThreadSettings(threads);
  const realtimeConversation = useRealtimeConversation({
    activeParentThreadId: threadId,
    setActivity,
    setMessages,
    showError,
    translate: t,
  });
  const recording = realtimeConversation.recording;
  const conversationEvents = useConversationEventQueue({
    captureMessageDecorator: realtimeConversation.captureMessageDecorator,
    setMessages,
    scopeKey: threadId,
    translate: t,
  });
  const connection = useAppServerConnection({
    onDisconnected: () => setBusy(false),
    onError: showError,
    onInitialized: (availableModels, history) => {
      if (availableModels.length) {
        const initialModel = availableModels[0];
        setModels(availableModels);
        setModel(initialModel.id);
        setEffort(
          initialModel.defaultReasoningEffort ??
            initialModel.supportedReasoningEfforts?.[0]?.reasoningEffort ??
            "medium",
        );
      }
      for (const thread of history) {
        turnCoordinator.observeStatus(thread.id, thread.status);
      }
      setThreads(history);
    },
    onMessage: handle,
    onNewChat: newChat,
    onRecovered: async () => {
      const activeThreadId = activeThreadRef.current;
      if (activeThreadId) await threadHistory.resume(activeThreadId);
    },
  });
  const subagents = useSubagentTranscripts({
    enabled: connection.connected && !isDemoPreview(),
    parentThreadId: threadId,
    translate: t,
  });
  useDefaultThreadCatalogEntry({
    connected: connection.connected,
    defaultThreadId: defaultThread.defaultThreadId,
    setThreads,
    threads,
  });
  const automations = useAutomations({
    connected: connection.connected,
    defaultThreadId: defaultThread.defaultThreadId,
    preferencesReady: !defaultThread.loading,
    onError: (error) => showError(t("automations.error"), error),
    onThreadCreated: (thread) =>
      setThreads((items) => [
        thread,
        ...items.filter((item) => item.id !== thread.id),
      ]),
    turnCoordinator,
  });
  const schedulerTools = useSchedulerTools({
    automations,
    onError: (error) => showError(t("schedulerTool.error"), error),
  });
  const configRequirements = useConfigRequirements(connection.connected);
  const webSearch = useCodexGlobalSettings(
    connection.connected,
    configRequirements.allowedWebSearchModes,
  );
  const chatPresentation = useChatPresentationSettings();
  const backgroundTerminals = useBackgroundTerminals({
    busy,
    connected: connection.connected,
    threadId,
  });
  const backgroundToolIds = useMemo(
    () => {
      const ids = new Set(
        backgroundTerminals.terminals.map((terminal) => terminal.itemId),
      );
      if (isDemoPreview()) ids.add("demo-live-dev-server");
      return ids;
    },
    [backgroundTerminals.terminals],
  );
  const personalityForModel =
    models.find((candidate) => candidate.id === model)?.supportsPersonality ===
    false
      ? undefined
      : (webSearch.advanced.personality ?? undefined);
  const runtimeMutations = useThreadRuntimeMutations({
    onError: (error) => showError(t("app.saveSettingsError"), error),
    personality: personalityForModel,
    runtime,
    threadId,
  });
  const memory = useMemorySettings(connection.connected);
  const remoteControl = useRemoteControl(
    connection.connected,
    configRequirements.allowRemoteControl !== false,
  );
  useCodexDefaults({
    connected: connection.connected,
    cwd,
    enabled: !threadId,
    refreshKey: [
      webSearch.advanced.model,
      webSearch.advanced.modelReasoningEffort,
      webSearch.advanced.approvalPolicy,
      webSearch.advanced.serviceTier,
    ].join("|"),
    onDefaults: (defaults) => {
      runtime.applyServerDefaults(defaults);
    },
    onError: (error) => showError(t("app.initializationIncomplete"), error),
  });
  const threadSearch = useThreadSearch(connection.connected);
  const rateLimits = useRateLimits(connection.connected);
  const apps = useApps({
    enabled: appsEnabled || settings === "apps",
    threadId,
  });
  useEffect(() => setWorkPanel(undefined), [threadId]);
  const threadHistory = useThreadHistory({
    activeThreadId: threadId,
    onError: showError,
    onMessagesPrepended: (older) =>
      setMessages((items) => [...older, ...items]),
    onMessagesReplaced: setMessages,
    onThreadResumeFailed: (id) => {
      conversationEvents.completeScopeTransition(id);
      viewStateGuard.failResume(id);
    },
    onThreadResumeStarted: (id) => {
      threadNavigationGuard.navigate();
      activeThreadRef.current = id;
      realtimeConversation.detachVisibleTranscript(id);
      conversationEvents.beginScopeTransition(id);
      viewStateGuard.beginResume(id);
      setThreadId(id);
      setMessages([]);
      setActivity(null);
      setBusy(false);
      setTurnId(undefined);
    },
    resolveDeveloperInstructions: async (id) => {
      const targetCwd = threads.find((item) => item.id === id)?.cwd;
      return readDesktopDeveloperInstructions(targetCwd);
    },
    onThreadResumed: (id, runtimeSettings, runState, summary) => {
      conversationEvents.completeScopeTransition(id);
      turnCoordinator.observeStatus(id, runState.status);
      setThreads((items) => restoreThread(items, summary));
      if (id === defaultThread.defaultThreadId) {
        void readDefaultThreadCatalogEntry(id)
          .then((authoritative) =>
            setThreads((items) => restoreThread(items, authoritative)),
          )
          .catch(() => undefined);
      }
      const patch = viewStateGuard.reconcileResume(id, runState);
      if (Object.hasOwn(patch, "activity")) setActivity(patch.activity ?? null);
      if (Object.hasOwn(patch, "busy")) setBusy(patch.busy ?? false);
      if (Object.hasOwn(patch, "turnId")) setTurnId(patch.turnId);
      applyThreadRuntimeSettings(runtimeSettings);
      realtimeConversation.attachVisibleTranscript(id);
    },
  });
  useTrayRealtimeConversation({
    activeThreadId: threadId,
    connected: connection.connected,
    defaultThread,
    dictationActive: dictating || dictationProcessing,
    model,
    openThread: threadHistory.resume,
    realtimeConversation,
    setThreads,
    translate: t,
    voice: realtime.voice,
  });
  const interactiveRequests = useInteractiveRequests({ onError: showError });
  const threadActions = useThreadActions({
    activeThreadId: threadId,
    busy,
    threads,
    setBusy,
    setThreads,
    onActiveThreadRemoved: newChat,
    onError: showError,
    onForked: threadHistory.resume,
    turnCoordinator,
  });
  const composerCommands = useComposerCommands({
    allowedApprovalPolicies: configRequirements.allowedApprovalPolicies,
    approvalPolicy,
    backgroundTerminals,
    busy,
    connected: connection.connected,
    effort,
    messages,
    model,
    models,
    permission,
    permissionProfiles: capabilities.permissionProfiles.data,
    runtimeMutations,
    serviceTier,
    threadId,
    translate: t,
    onAppendResult: appendCommandResult,
    onClear: () => {
      conversationEvents.replaceScope(threadId);
      setMessages([]);
    },
    onCompact: threadActions.compact,
    onReview: reviewCurrentThread,
    onSetEffort: setEffort,
    onSetModel: setModel,
    onShowError: showError,
  });
  const shellCommand = useShellCommand({
    busy,
    threadId,
    createThread,
    onError: (title, error, commandThreadId) => {
      if (activeThreadRef.current !== commandThreadId) return;
      setBusy(false);
      showError(title, error);
    },
    onStarted: (command, commandThreadId) => {
      if (activeThreadRef.current !== commandThreadId) return;
      setBusy(true);
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "user", content: `! ${command}` },
      ]);
    },
  });
  function newChat() {
    threadNavigationGuard.navigate();
    realtimeStartGeneration.current += 1;
    realtimeStartPending.current = false;
    realtimeConversation.reset();
    activeThreadRef.current = undefined;
    viewStateGuard.reset();
    conversationEvents.replaceScope(undefined);
    setDictating(false);
    setMessages([]);
    setThreadId(undefined);
    setTurnId(undefined);
    threadHistory.reset();
    setBusy(false);
    runtime.resetForNewThread();
  }
  activeThreadRef.current = threadId;
  async function selectDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
      ...(cwd ? { defaultPath: cwd } : {}),
    });
    if (typeof selected === "string" && selected !== cwd) {
      if (threadId) {
        try {
          await request(
            "thread/settings/update",
            threadCwdUpdateParams(threadId, selected),
          );
          setThreads((items) =>
            items.map((item) =>
              item.id === threadId ? { ...item, cwd: selected } : item,
            ),
          );
        } catch (error) {
          showError(t("app.changeDirectoryError"), error);
          return;
        }
      }
      persistWorkspace(selected);
      setCwd(selected);
    }
  }
  function handle(msg: AppServerMessage) {
    const routed = routeAppNotification(msg);
    subagents.handleMessage(msg);
    turnCoordinator.handleMessage(msg);
    automations.handleMessage(msg);
    const affectsActiveThread =
      !routed.threadId || routed.threadId === activeThreadRef.current;
    if (affectsActiveThread && routed.activity !== undefined) {
      viewStateGuard.observe("activity");
      setActivity(routed.activity);
    }
    if (schedulerTools.handleMessage(msg)) return;
    if (interactiveRequests.handleMessage(msg)) return;
    if (affectsActiveThread && routed.conversationEvent) {
      conversationEvents.enqueue(
        msg,
        routed.threadId ?? activeThreadRef.current,
      );
    }
    if (affectsActiveThread && routed.startsTurn) {
      viewStateGuard.observe("busy", "turn");
      setBusy(true);
      setTurnId(routed.turnId);
    }
    if (affectsActiveThread && routed.completesTurn) {
      viewStateGuard.observe("busy", "turn");
      setBusy(false);
      setTurnId(undefined);
    }
    if (affectsActiveThread && routed.clearsActivity) {
      viewStateGuard.observe("activity");
      setActivity(null);
    }

    const threadEvent = routed.thread;
    if (threadEvent) {
      if (threadEvent.type === "nameUpdated") {
        setThreads((items) =>
          items.map((thread) =>
            thread.id === threadEvent.threadId
              ? { ...thread, name: threadEvent.name }
              : thread,
          ),
        );
      } else if (threadEvent.type === "statusChanged") {
        setThreads((items) =>
          items.map((thread) =>
            thread.id === threadEvent.threadId
              ? { ...thread, status: threadEvent.status }
              : thread,
          ),
        );
      } else if (
        threadEvent.type === "settingsUpdated" &&
        threadEvent.threadId === activeThreadRef.current
      ) {
        applyThreadRuntimeSettings(threadEvent.settings);
      } else if (threadEvent.type === "archived") {
        setThreads((items) => removeThread(items, threadEvent.threadId));
        threadSearch.remove(threadEvent.threadId);
        if (activeThreadRef.current === threadEvent.threadId) newChat();
      } else if (threadEvent.type === "unarchived") {
        void reconcileUnarchivedThread(threadEvent.threadId);
      } else if (threadEvent.type === "closed") {
        setThreads((items) => markThreadClosed(items, threadEvent.threadId));
      } else if (threadEvent.type === "deleted") {
        setThreads((items) => removeDeletedThread(items, threadEvent.threadId));
        setThreadTelemetry((items) =>
          removeDeletedThreadTelemetry(items, threadEvent.threadId),
        );
        if (activeThreadRef.current === threadEvent.threadId) newChat();
        threadSearch.remove(threadEvent.threadId);
      }
    }

    const telemetryEvent = routed.telemetry;
    if (telemetryEvent) {
      if (telemetryEvent.type === "contextUpdated") {
        setThreadTelemetry((items) => ({
          ...items,
          [telemetryEvent.threadId]: {
            ...items[telemetryEvent.threadId],
            context: telemetryEvent.context,
          },
        }));
      } else if (telemetryEvent.type === "modelRerouted") {
        setThreadTelemetry((items) => ({
          ...items,
          [telemetryEvent.threadId]: {
            ...items[telemetryEvent.threadId],
            reroute: telemetryEvent.reroute,
          },
        }));
      } else {
        setThreadTelemetry((items) => ({
          ...items,
          [telemetryEvent.threadId]: {
            ...items[telemetryEvent.threadId],
            reroute: undefined,
          },
        }));
      }
    }
    realtimeConversation.handleMessage(msg);
  }
  async function createThread() {
    const creationGeneration = threadNavigationGuard.beginCreation();
    const developerInstructions = await readDesktopDeveloperInstructions(
      cwd || undefined,
    );
    const r = await request<ThreadStartResponse>(
      "thread/start",
      threadStartParams(
        cwd || undefined,
        model,
        runtime.permissionForStart,
        personalityForModel,
        runtime.approvalPolicyForStart,
        runtime.serviceTierForStart,
        developerInstructions,
      ),
    );
    const id = r.thread.id as string;
    const runtimeSettings = threadRuntimeSettings(r);
    const resolvedCwd = runtimeSettings.cwd ?? cwd;
    turnCoordinator.observeStatus(id, threadSummary(r.thread).status ?? "idle");
    setThreads((x) => [{ id, name: t("app.newChat"), cwd: resolvedCwd }, ...x]);
    const activated = threadNavigationGuard.shouldActivate(creationGeneration);
    if (activated) {
      applyThreadRuntimeSettings(runtimeSettings);
      activeThreadRef.current = id;
      conversationEvents.replaceScope(id);
      setThreadId(id);
    }
    return { id, activated };
  }

  async function readDesktopDeveloperInstructions(targetCwd?: string) {
    const response = await request<ConfigReadResponse>(
      "config/read",
      configReadParams(targetCwd),
    );
    const config = appServerRecord(response.config);
    return codexDesktopDeveloperInstructions(
      appServerString(config?.developer_instructions),
      clientVersions,
    );
  }

  async function send(text: string, context: TurnContextItem[]) {
    if (threadHistory.resuming) return;
    if (text.trimStart().startsWith("!")) {
      shellCommand.requestExecution(text.trimStart().slice(1));
      return;
    }
    const command = commandFromText(text);
    if (command) {
      await composerCommands.execute(command);
      return;
    }
    if (busy) {
      if (!threadId || !turnId) {
        showError(t("app.steerError"), t("app.noActiveTurn"));
        return;
      }
      const steeringThreadId = threadId;
      try {
        await request(
          "turn/steer",
          turnSteerParams(steeringThreadId, turnId, text, context),
        );
      } catch (error) {
        if (activeThreadRef.current !== steeringThreadId) return;
        showError(t("app.steerError"), error);
      }
      return;
    }
    setBusy(true);
    if (!isDesktopApp()) {
      const previewThreadId = threadId ?? "browser-preview";
      if (!threadId) {
        const previewThread: ThreadSummary = {
          id: previewThreadId,
          name: text || t("app.newChat"),
          preview: text,
          cwd: cwd || undefined,
        };
        activeThreadRef.current = previewThreadId;
        conversationEvents.replaceScope(previewThreadId);
        setThreadId(previewThread.id);
        setThreads((items) => [
          previewThread,
          ...items.filter((item) => item.id !== previewThread.id),
        ]);
      }
      demoPlayback.submitPreview({
        message: browserPreviewResponse(t),
        onComplete: () => {
          if (activeThreadRef.current === previewThreadId) setBusy(false);
        },
        threadId: previewThreadId,
      });
      return;
    }
    let targetThreadId = threadId;
    try {
      const created = targetThreadId ? undefined : await createThread();
      if (created && !created.activated) return;
      const id = targetThreadId ?? created?.id;
      if (!id) return;
      targetThreadId = id;
      turnCoordinator.observeStatus(
        id,
        busy
          ? "active"
          : (threads.find((thread) => thread.id === id)?.status ?? "idle"),
      );
      await turnCoordinator.runWhenIdle(
        id,
        () =>
          request<{ turn: { id: string } }>(
            "turn/start",
            turnStartParams(id, model, text, context, {
              effort,
              personality: personalityForModel,
              mode: collaborationMode,
              serviceTier,
            }),
          ),
        (result) => result.turn.id,
      );
    } catch (e) {
      if (activeThreadRef.current !== targetThreadId) return;
      showError(t("app.connectionError"), e);
      setBusy(false);
    }
  }

  async function reviewCurrentThread() {
    if (!threadId) {
      showError(t("app.reviewUnavailable"), t("app.reviewNeedsThread"));
      return false;
    }
    const reviewThreadId = threadId;
    setBusy(true);
    try {
      await turnCoordinator.runWhenIdle(reviewThreadId, () =>
        request("review/start", {
          threadId: reviewThreadId,
          delivery: "inline",
          target: { type: "uncommittedChanges" },
        }),
      );
      return true;
    } catch (error) {
      if (activeThreadRef.current !== reviewThreadId) return false;
      setBusy(false);
      showError(t("app.reviewUnavailable"), error);
      return false;
    }
  }
  function appendCommandResult(title: string, content: string) {
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        modality: "commandResult",
        title,
        content,
      },
    ]);
  }
  async function toggleVoice() {
    if (threadHistory.resuming) return;
    if (recording || realtimeConversation.starting) {
      await realtimeConversation.stop();
      return;
    }
    if (dictating || realtimeStartPending.current) return;
    const generation = realtimeStartGeneration.current + 1;
    realtimeStartGeneration.current = generation;
    realtimeStartPending.current = true;
    try {
      const created = threadId ? undefined : await createThread();
      if (created && !created.activated) return;
      const parentThreadId = threadId ?? created?.id;
      if (!parentThreadId) return;
      if (realtimeStartGeneration.current !== generation) return;
      await realtimeConversation.start({
        parentThreadId,
        cwd: cwd || undefined,
        model,
        permission: runtime.permissionForStart,
        personality: personalityForModel,
        approvalPolicy: runtime.approvalPolicyForStart,
        voice: realtime.voice,
      });
    } catch (e) {
      showError(t("app.realtimeUnavailable"), e);
    } finally {
      if (realtimeStartGeneration.current === generation) {
        realtimeStartPending.current = false;
      }
    }
  }
  async function toggleDictation() {
    if (dictationProcessing) return;
    if (dictating) {
      setDictationProcessing(true);
      try {
        const text = await finishDictationCapture();
        if (text.trim())
          setDictationInsertion({
            id: ++dictationSequence.current,
            text,
          });
      } catch (error) {
        showError(t("app.dictationInterrupted"), error);
      } finally {
        setDictating(false);
        setDictationProcessing(false);
      }
      return;
    }
    if (recording) return;
    try {
      await startDictationCapture();
      setDictating(true);
    } catch (error) {
      setDictating(false);
      showError(t("app.dictationUnavailable"), error);
    }
  }
  const consumeDictationInsertion = useCallback((id: number) => {
    setDictationInsertion((current) =>
      current?.id === id ? undefined : current,
    );
  }, []);
  async function interrupt() {
    try {
      if (threadId && turnId)
        await request("turn/interrupt", { threadId, turnId });
      setBusy(false);
    } catch (error) {
      showError(t("app.interruptError"), error);
    }
  }
  function changeModel(id: string) {
    setModel(id);
    const selected = models.find((candidate) => candidate.id === id);
    setEffort(
      selected?.defaultReasoningEffort ??
        selected?.supportedReasoningEfforts?.[0]?.reasoningEffort ??
        "medium",
    );
  }
  function applyThreadRuntimeSettings(settings: ThreadRuntimeSettings) {
    if (settings.cwd) {
      setCwd(settings.cwd);
      persistWorkspace(settings.cwd);
    }
    runtime.applyServerSettings(settings);
  }
  async function reconcileUnarchivedThread(unarchivedThreadId: string) {
    try {
      const response = await request<ThreadListResponse>("thread/list", {
        limit: 30,
        sortKey: "updated_at",
      });
      const restored = response.data?.find(
        (thread) => thread.id === unarchivedThreadId,
      );
      if (!restored) return;
      setThreads((items) => restoreThread(items, threadSummary(restored)));
    } catch (error) {
      showError(t("app.threadSyncError"), error);
    }
  }
  function persistWorkspace(path: string) {
    workspaceChanged.current = true;
    void import("./lib/desktopSettings")
      .then(({ updateDesktopSettings }) =>
        updateDesktopSettings({ lastWorkspace: path }),
      )
      .catch((error) => showError(t("desktopSettings.saveError"), error));
  }
  async function restartCodexAppServer() {
    if (busy || recording || dictating || dictationProcessing) return false;
    const restarted = await connection.restart();
    if (!restarted || !threadId) return restarted;
    return threadHistory.resume(threadId);
  }
  const currentThread = threads.find((thread) => thread.id === threadId);
  const displayedAutomations = isDemoPreview()
    ? {
        ...automations,
        automations: [
          {
            id: "preview-paused-maintenance",
            name: "Sanitary maintenance pass",
            prompt: "Inspect one bounded sector and address the strongest findings.",
            cwd: "/home/baptiste/dev/codex-desktop-linux",
            enabled: false,
            schedule: {
              type: "interval" as const,
              intervalMinutes: 30,
            },
            target: { type: "defaultThread" as const },
          },
          {
            id: "preview-completed-one-shot",
            name: "Release follow-up",
            prompt: "Check the release health after installation.",
            enabled: false,
            schedule: {
              type: "once" as const,
              at: Date.UTC(2026, 7, 1, 10, 0),
            },
            target: { type: "newThread" as const },
            lastRunAt: Date.UTC(2026, 7, 1, 10, 0),
            lastStatus: "succeeded" as const,
          },
        ],
        error: undefined,
        loading: false,
      }
    : automations;
  const displayedApps = isDemoPreview()
    ? {
        ...apps,
        apps: demoApps.filter((app) => app.isEnabled),
        catalogApps: demoApps,
        configurableApps: demoApps.filter((app) => app.isAccessible),
        error: undefined,
        installedApps: {
          github: { id: "github", runtimeName: "GitHub", enabled: true, callable: true },
          google_drive: { id: "google_drive", runtimeName: "Google Drive", enabled: false, callable: false },
        },
        loading: false,
        savingConfigurations: [],
        updatingApps: [],
        readConfiguration: async (app?: AppInfo) => ({
          ...(app ? { app } : {}),
          config: app ? {
            enabled: app.isEnabled,
            approvals_reviewer: null,
            destructive_enabled: null,
            open_world_enabled: null,
            default_tools_approval_mode: null,
            default_tools_enabled: null,
            tools: {},
          } : {
            enabled: true,
            approvals_reviewer: null,
            destructive_enabled: true,
            open_world_enabled: true,
            default_tools_approval_mode: null,
          },
          defaults: {
            enabled: true,
            approvals_reviewer: null,
            destructive_enabled: true,
            open_world_enabled: true,
            default_tools_approval_mode: null,
          },
          tools: app?.id === "github" ? [
            { name: "search", title: "Search repositories", description: "Search repositories, issues, and pull requests.", isEnabled: true, disabledReason: null, isReadOnly: true },
            { name: "create_issue", title: "Create issue", description: "Create a new issue in a repository.", isEnabled: true, disabledReason: null, isReadOnly: false },
          ] : [
            { name: "search_files", title: "Search files", description: "Find files in connected drives.", isEnabled: true, disabledReason: null, isReadOnly: true },
          ],
        }),
        saveConfiguration: async () => true,
        openInstall: async () => true,
        setEnabled: async () => undefined,
      }
    : apps;
  const displayedIntegrations: IntegrationsController = isDemoPreview()
    ? {
        ...integrations,
        mcpServers: {
          data: [
            {
              name: "github",
              serverInfo: {
                name: "github",
                title: "GitHub",
                version: "1.4.0",
                description: null,
              },
              tools: { search: {}, read: {} },
              resources: [],
              resourceTemplates: [],
              authStatus: "oAuth",
            },
            {
              name: "project_docs",
              serverInfo: null,
              tools: {},
              resources: [],
              resourceTemplates: [],
              authStatus: "notLoggedIn",
            },
          ],
          loading: false,
        },
        mcpStartup: {
          github: { status: "ready" },
          project_docs: {
            status: "failed",
            error: "Authentication must be renewed before this server can start.",
            failureReason: "reauthenticationRequired",
          },
        },
        plugins: {
          data: [
            {
              id: "google-drive@openai-curated-remote",
              name: "google-drive",
              displayName: "Google Drive",
              description: "Work with Drive, Docs, Sheets, and Slides.",
              marketplaceName: "openai-curated-remote",
              marketplaceDisplayName: "OpenAI",
              installed: true,
              enabled: true,
              availability: "AVAILABLE",
              localVersion: "0.1.11",
            },
            {
              id: "spreadsheets@openai-primary-runtime",
              name: "spreadsheets",
              displayName: "Spreadsheets",
              description: "Create, edit, analyze, and verify spreadsheet files.",
              marketplaceName: "openai-primary-runtime",
              marketplaceDisplayName: "OpenAI runtime",
              installed: true,
              enabled: true,
              availability: "AVAILABLE",
              localVersion: "26.715.12143",
            },
          ],
          loading: false,
        },
        removableMcpServers: ["github", "project_docs"],
        removingMcpServers: [],
        removeMcpServer: async () => true,
      }
    : integrations;
  if (settings) {
    return (
      <SettingsLoader
        account={account}
        appUpdate={appUpdate}
        apps={displayedApps}
        automations={displayedAutomations}
        capabilities={capabilities}
        configRequirements={configRequirements}
        defaultThread={defaultThread}
        externalAgentImport={externalAgentImport}
        integrations={displayedIntegrations}
        models={models}
        rateLimits={rateLimits}
        realtime={realtime}
        memory={memory}
        remoteControl={remoteControl}
        currentThreadId={threadId}
        currentWorkspace={cwd || undefined}
        chatPresentation={chatPresentation}
        webSearch={webSearch}
        appServerRestart={{
          available:
            isDesktopApp() &&
            connection.connected &&
            !busy &&
            !recording &&
            !dictating &&
            !dictationProcessing,
          error: connection.restartError,
          restart: restartCodexAppServer,
          restarting: connection.restarting,
        }}
        section={settings}
        onClose={() => setSettings(null)}
        onSelectSection={setSettings}
      />
    );
  }
  return (
    <div className="app">
      <Sidebar
        cwd={cwd}
        defaultThreadId={defaultThread.defaultThreadId}
        open={sidebar}
        width={sidebarWidth}
        selectedThreadId={
          threadId ??
          (isDemoPreview() ? previewDemoThreads()[0]?.id : undefined)
        }
        threads={threads}
        search={threadSearch}
        onArchive={(thread) => {
          void threadActions.archive(thread.id, thread).then((archived) => {
            if (archived) threadSearch.remove(thread.id);
          });
        }}
        onDelete={async (thread) => {
          if (isDemoPreview()) {
            setThreads((items) =>
              items.filter((item) => item.id !== thread.id),
            );
            return true;
          }
          const deleted = await threadActions.deleteThread(thread.id);
          if (deleted) {
            threadSearch.remove(thread.id);
            if (thread.id === defaultThread.defaultThreadId) {
              const cleared =
                await defaultThread.setDefaultThreadId(undefined);
              if (!cleared) {
                showError(
                  t("settings.defaultThread.saveError"),
                  defaultThread.error ?? t("settings.persistence.error"),
                );
              }
            }
          }
          return deleted;
        }}
        onPin={(thread, isPinned) => {
          if (isDemoPreview()) {
            setThreads((items) =>
              items.map((item) =>
                item.id === thread.id ? { ...item, isPinned } : item,
              ),
            );
            return;
          }
          void threadActions.setPinned(thread, isPinned);
        }}
        onClose={() => setSidebar(false)}
        onNewChat={newChat}
        onOpenSettings={() => setSettings("general")}
        onResume={threadHistory.resume}
        onSelectDirectory={selectDirectory}
        onWidthChange={setSidebarWidth}
        onWidthCommit={(width) => {
          void import("./lib/desktopSettings")
            .then(({ updateDesktopSettings }) =>
              updateDesktopSettings({ sidebarWidth: width }),
            )
            .catch((error) =>
              showError(t("desktopSettings.sidebarWidthError"), error),
            );
        }}
      />
      <main>
        <ChatHeader
          backgroundTerminals={backgroundTerminals}
          busy={busy}
          connected={connection.connected}
          cwd={cwd}
          nativeApp={isDesktopApp()}
          reconnecting={connection.reconnecting}
          sidebarOpen={sidebar}
          threadId={threadId}
          title={
            currentThread?.name ?? currentThread?.preview ?? t("app.newChat")
          }
          update={
            isUpdateDemoPreview()
              ? {
                  installing: false,
                  latestVersion: "0.5.3",
                  onActivate: () => undefined,
                }
              : appUpdate.status?.updateAvailable && !appUpdate.updateInstalled
                ? {
                    installing: appUpdate.installing,
                    latestVersion: appUpdate.status.latestVersion,
                    onActivate: () => {
                      const canInstall =
                        appUpdate.status?.assetAvailable === true &&
                        appUpdate.status.installMode === "automatic";
                      void (async () => {
                        if (canInstall) {
                          await appUpdate.install();
                          setSettings("general");
                          return;
                        }
                        if (!(await appUpdate.openRelease())) {
                          setSettings("general");
                        }
                      })();
                    },
                  }
                : undefined
          }
          codexUpdate={
            isUpdateDemoPreview()
              ? {
                  installing: false,
                  latestVersion: "0.146.0",
                  onActivate: () => undefined,
                }
              : appUpdate.status?.codexUpdate.updateAvailable &&
                  appUpdate.status.codexUpdate.latestVersion &&
                  !appUpdate.codexUpdateInstalled
                ? {
                  installing: appUpdate.codexUpdating,
                  latestVersion: appUpdate.status.codexUpdate.latestVersion,
                  onActivate: () => {
                    void (async () => {
                      await appUpdate.updateCodex();
                      setSettings("general");
                    })();
                  },
                  }
                : undefined
          }
          commandRequest={composerCommands.headerRequest}
          defaultThread={defaultThread.defaultThreadId === threadId}
          demoPlayback={
            demoPlayback.enabled && !isReadmeDemoPreview()
              ? {
                  hasPlayed: demoPlayback.hasPlayed,
                  loadingThread: demoPlayback.loadingThread,
                  running: demoPlayback.running,
                  onPlay: demoPlayback.play,
                  onPreviewThreadLoading:
                    demoPlayback.previewThreadLoading,
                  onStop: demoPlayback.stop,
                }
              : undefined
          }
          onCompact={threadActions.compact}
          onDelete={threadActions.deleteThread}
          onFork={threadActions.fork}
          onOpenSidebar={() => setSidebar(true)}
          onReconnect={() => void connection.reconnect()}
          onReload={() => threadHistory.resume(threadId!)}
          onRename={threadActions.rename}
          onSetDefaultThread={async () => {
            if (!threadId) return false;
            const saved = await defaultThread.setDefaultThreadId(threadId);
            if (!saved && defaultThread.defaultThreadId !== threadId) {
              showError(
                t("settings.defaultThread.saveError"),
                defaultThread.error ?? t("settings.persistence.error"),
              );
            }
            return saved;
          }}
        />
        <Conversation
          activity={activity}
          backgroundToolIds={backgroundToolIds}
          canLoadOlder={threadHistory.canLoadOlder}
          cwd={cwd}
          fileOpener={webSearch.fileOpener}
          loadingThread={
            threadHistory.resuming || demoPlayback.loadingThread
          }
          loadingOlder={threadHistory.loadingOlder}
          keepActionGroupsCollapsed={
            chatPresentation.keepActionGroupsCollapsed
          }
          maxVisibleActions={chatPresentation.maxVisibleActions}
          messages={messages}
          onLinkError={(error) => showError(t("link.openError"), error)}
          onLoadOlder={threadHistory.loadOlder}
          onReviewDiff={setWorkPanel}
          subagentError={subagents.error}
          showReasoningItems={chatPresentation.showReasoningItems}
          subagentTranscripts={
            isDemoPreview() ? demoSubagentTranscripts : subagents.transcripts
          }
        />
        <ChatFooter
          apps={displayedApps}
          skills={isDemoPreview() ? demoSkills : integrations.skills.data}
          skillsError={isDemoPreview() ? undefined : integrations.skills.error}
          skillsLoading={isDemoPreview() ? false : integrations.skills.loading}
          busy={busy}
          canSteer={Boolean(threadId && turnId)}
          cwd={cwd}
          model={model}
          collaborationMode={collaborationMode}
          effort={effort}
          models={models}
          permission={permission}
          serviceTier={serviceTier}
          approvalPolicy={approvalPolicy}
          allowedApprovalPolicies={configRequirements.allowedApprovalPolicies}
          permissionProfiles={capabilities.permissionProfiles.data}
          quotas={isDemoPreview() ? demoQuotas : rateLimits.quotas}
          quotaConsuming={rateLimits.consuming}
          quotaError={rateLimits.error}
          quotaResetCredits={
            isDemoPreview() ? demoResetCredits : rateLimits.resetCredits
          }
          quotaResetMessage={rateLimits.resetMessage}
          recording={recording}
          dictating={dictating}
          dictationProcessing={dictationProcessing}
          dictationInsertion={dictationInsertion}
          hasThread={Boolean(threadId) || isDemoPreview()}
          loadingThread={
            threadHistory.resuming || demoPlayback.loadingThread
          }
          commandChoiceRequest={composerCommands.choiceRequest}
          onCommandChoiceDismiss={composerCommands.dismissChoices}
          onCommandChoiceSelect={(choiceId) =>
            void composerCommands.selectChoice(choiceId)
          }
          telemetry={
            threadId
              ? threadTelemetry[threadId]
              : isDemoPreview()
                ? demoTelemetry
                : undefined
          }
          onCompact={() => void threadActions.compact()}
          onChangeEffort={setEffort}
          onChangeModel={changeModel}
          onChangeCollaborationMode={runtimeMutations.changeCollaborationMode}
          onChangePermission={runtimeMutations.changePermission}
          onChangeApprovalPolicy={runtimeMutations.changeApprovalPolicy}
          onChangeServiceTier={runtimeMutations.changeServiceTier}
          onConsumeQuotaReset={
            isDemoPreview() ? async () => undefined : rateLimits.consumeReset
          }
          onNeedApps={() => setAppsEnabled(true)}
          onNeedSkills={() => {
            if (!isDemoPreview()) void integrations.refreshSkills();
          }}
          onConsumeDictationInsertion={consumeDictationInsertion}
          onOpenMcpSettings={() => setSettings("mcp")}
          onOpenPluginSettings={() => setSettings("plugins")}
          onSend={send}
          onStop={interrupt}
          onToggleVoice={toggleVoice}
          onToggleDictation={toggleDictation}
        />
      </main>
      {workPanel && (
        <WorkPanel tool={workPanel} onClose={() => setWorkPanel(undefined)} />
      )}
      {interactiveRequests.approval && (
        <ApprovalDialog
          approval={interactiveRequests.approval}
          onDecide={interactiveRequests.decideApproval}
        />
      )}
      {shellCommand.pending && <ShellCommandDialog controller={shellCommand} />}
      {schedulerTools.confirmation && (
        <SchedulerToolConfirmationDialog
          confirmation={schedulerTools.confirmation}
          submitting={schedulerTools.submitting}
          onCancel={() => void schedulerTools.cancelDelete()}
          onConfirm={() => void schedulerTools.confirmDelete()}
        />
      )}
      {interactiveRequests.userInput && (
        <UserInputDialog
          request={interactiveRequests.userInput}
          submitting={interactiveRequests.submittingUserInput}
          onSubmit={interactiveRequests.answerUserInput}
        />
      )}
      {interactiveRequests.mcpElicitation && (
        <McpElicitationLoader
          request={interactiveRequests.mcpElicitation}
          submitting={interactiveRequests.submittingMcpElicitation}
          onSubmit={interactiveRequests.answerMcpElicitation}
        />
      )}
      <div className="archive-notices">
        {threadActions.archivedThreads.map((archived) => (
          <ArchiveNotice
            key={archived.thread.id}
            thread={archived.thread}
            onDismiss={() =>
              threadActions.dismissArchiveNotice(archived.thread.id)
            }
            onUndo={() => threadActions.unarchive(archived)}
          />
        ))}
      </div>
    </div>
  );
}
