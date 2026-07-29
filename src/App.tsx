import { useCallback, useEffect, useRef, useState } from "react";
import { openDialog as open } from "./lib/nativeBridge";
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
  ThreadListResponse,
  ThreadStartResponse,
} from "./lib/appServerTypes";
import { finishDictationCapture, startDictationCapture } from "./lib/dictation";
import {
  threadBehaviorUpdateParams,
  threadApprovalPolicyUpdateParams,
  threadCwdUpdateParams,
  threadPermissionUpdateParams,
  threadStartParams,
  turnStartParams,
  turnSteerParams,
  type ApprovalPolicy,
  type Permission,
  type TurnContextItem,
} from "./lib/protocol";
import type { AgentActivity } from "./lib/activity";
import {
  demoTelemetry,
  demoQuotas,
  demoResetCredits,
  demoSkills,
  previewDemoThreads,
  initialPreviewMessages,
  isDemoPreview,
  isReadmeDemoPreview,
} from "./lib/demoConversation";
import { useThreadHistory } from "./lib/useThreadHistory";
import { useDemoPlayback } from "./lib/useDemoPlayback";
import { useInteractiveRequests } from "./lib/useInteractiveRequests";
import { useThreadActions } from "./lib/useThreadActions";
import { useIntegrations } from "./lib/useIntegrations";
import { useCapabilityCatalog } from "./lib/useCapabilityCatalog";
import { useAccount } from "./lib/useAccount";
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
import type { ThreadTelemetry } from "./lib/sessionTelemetry";
import type {
  ChatMessage,
  CollaborationMode,
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
import { useCodexDefaults } from "./lib/useCodexDefaults";
import { useCodexGlobalSettings } from "./lib/useCodexGlobalSettings";
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
  const translateRef = useRef(t);
  translateRef.current = t;
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
  const runtime = useThreadRuntimeState({
    model: fallbackModels[0].id,
    effort: "medium",
    personality: "pragmatic",
    collaborationMode: "default",
    permission: ":workspace",
    approvalPolicy: "on-request",
  });
  const {
    approvalPolicy,
    collaborationMode,
    effort,
    model,
    permission,
    setCollaborationMode,
    setEffort,
    setModel,
  } = runtime;
  const dictationSequence = useRef(0);
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
  const integrations = useIntegrations({
    cwd,
    enabled: settings === "plugins" || settings === "mcp",
    hooksEnabled: settings === "hooks",
    threadId,
  });
  const capabilities = useCapabilityCatalog({
    cwd,
    enabled: settings === "agent" || settings === "permissions",
  });
  const account = useAccount(settings === "account");
  const externalAgentImport = useExternalAgentImport({
    cwd,
    enabled: settings === "advanced",
  });
  const realtime = useRealtimeSettings(settings === "voice");
  const realtimeConversation = useRealtimeConversation({
    setActivity,
    setMessages,
    showError,
    translate: t,
  });
  const recording = realtimeConversation.recording;
  const enqueueConversationEvent = useConversationEventQueue({
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
  });
  const automations = useAutomations({
    connected: connection.connected,
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
  const personalityForModel =
    models.find((candidate) => candidate.id === model)?.supportsPersonality ===
    false
      ? undefined
      : (webSearch.advanced.personality ?? undefined);
  const memory = useMemorySettings(connection.connected);
  const remoteControl = useRemoteControl(
    connection.connected,
    configRequirements.allowRemoteControl !== false,
  );
  useCodexDefaults({
    connected: connection.connected,
    cwd,
    enabled: !threadId,
    onDefaults: (defaults) => {
      runtime.applyServerDefaults(defaults);
    },
    onError: (error) => showError(t("app.initializationIncomplete"), error),
  });
  const threadSearch = useThreadSearch(connection.connected);
  const rateLimits = useRateLimits(connection.connected);
  const apps = useApps({
    enabled: appsEnabled || settings === "plugins",
    threadId,
  });
  useEffect(() => setWorkPanel(undefined), [threadId]);
  const threadHistory = useThreadHistory({
    activeThreadId: threadId,
    onError: showError,
    onMessagesPrepended: (older) =>
      setMessages((items) => [...older, ...items]),
    onMessagesReplaced: setMessages,
    onThreadResumed: (id, runtimeSettings) => {
      setThreadId(id);
      applyThreadRuntimeSettings(runtimeSettings);
    },
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
  const shellCommand = useShellCommand({
    busy,
    threadId,
    createThread,
    onError: (title, error) => {
      setBusy(false);
      showError(title, error);
    },
    onStarted: (command) => {
      setBusy(true);
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "user", content: `! ${command}` },
      ]);
    },
  });
  function newChat() {
    realtimeConversation.reset();
    setDictating(false);
    setMessages([]);
    setThreadId(undefined);
    setTurnId(undefined);
    threadHistory.reset();
    setBusy(false);
    runtime.resetAccessSettings();
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
          setMessages((items) => [
            ...items,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `**${t("app.changeDirectoryError")}**\n\n${String(error)}`,
            },
          ]);
          return;
        }
      }
      persistWorkspace(selected);
      setCwd(selected);
    }
  }
  function handle(msg: AppServerMessage) {
    const routed = routeAppNotification(msg);
    turnCoordinator.handleMessage(msg);
    automations.handleMessage(msg);
    const affectsActiveThread =
      !routed.threadId || routed.threadId === activeThreadRef.current;
    if (affectsActiveThread && routed.activity !== undefined)
      setActivity(routed.activity);
    if (schedulerTools.handleMessage(msg)) return;
    if (interactiveRequests.handleMessage(msg)) return;
    if (affectsActiveThread && routed.conversationEvent)
      enqueueConversationEvent(msg);
    if (affectsActiveThread && routed.startsTurn) setTurnId(routed.turnId);
    if (affectsActiveThread && routed.completesTurn) setBusy(false);
    if (affectsActiveThread && routed.clearsActivity) setActivity(null);

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
    const r = await request<ThreadStartResponse>(
      "thread/start",
      threadStartParams(
        cwd || undefined,
        model,
        runtime.permissionForStart,
        personalityForModel,
        runtime.approvalPolicyForStart,
      ),
    );
    const id = r.thread.id as string;
    const runtimeSettings = threadRuntimeSettings(r);
    const resolvedCwd = runtimeSettings.cwd ?? cwd;
    turnCoordinator.observeStatus(id, threadSummary(r.thread).status ?? "idle");
    applyThreadRuntimeSettings(runtimeSettings);
    setThreadId(id);
    setThreads((x) => [{ id, name: t("app.newChat"), cwd: resolvedCwd }, ...x]);
    return id;
  }
  async function send(text: string, context: TurnContextItem[]) {
    if (text.trimStart().startsWith("!")) {
      shellCommand.requestExecution(text.trimStart().slice(1));
      return;
    }
    const command = commandFromText(text);
    if (command) {
      if (command.settingsSection) {
        setSettings(command.settingsSection);
        return;
      }
      switch (command.id) {
        case "new":
        case "clear":
          newChat();
          return;
        case "resume":
          setSidebar(true);
          return;
        case "plan":
          await changeCollaborationMode("plan");
          return;
        case "compact":
          await threadActions.compact();
          return;
        case "fork":
          await threadActions.fork();
          return;
        case "stop":
          await interrupt();
          return;
        case "status":
          setMessages((x) => [
            ...x,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `**${t("app.session.title")}**\n\n- ${t("app.session.connection")} : ${connection.connected ? t("app.session.active") : t("app.session.inactive")}\n- ${t("app.session.model")} : ${model}\n- ${t("app.session.permissions")} : ${permission}\n- ${t("app.session.thread")} : ${threadId ?? t("app.session.new")}`,
            },
          ]);
          return;
        case "review":
          if (!threadId) {
            showError(t("app.reviewUnavailable"), t("app.reviewNeedsThread"));
            return;
          }
          setBusy(true);
          try {
            await turnCoordinator.runWhenIdle(threadId, () =>
              request("review/start", {
                threadId,
                delivery: "inline",
                target: { type: "uncommittedChanges" },
              }),
            );
          } catch (error) {
            setBusy(false);
            showError(t("app.reviewUnavailable"), error);
          }
          return;
      }
      return;
    }
    const attachments = context.flatMap((item) =>
      item.type === "skill"
        ? []
        : [
            item.type === "mention"
              ? `@${item.name}`
              : (item.path.split("/").at(-1) ?? item.path),
          ],
    );
    const skills = context.flatMap((item) =>
      item.type === "skill" ? [{ name: item.name }] : [],
    );
    setMessages((x) => [
      ...x,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text || t("app.attachments"),
        attachments,
        skills,
      },
    ]);
    if (busy) {
      if (!threadId || !turnId) {
        showError(t("app.steerError"), t("app.noActiveTurn"));
        return;
      }
      try {
        await request(
          "turn/steer",
          turnSteerParams(threadId, turnId, text, context),
        );
      } catch (error) {
        showError(t("app.steerError"), error);
      }
      return;
    }
    setBusy(true);
    if (!isDesktopApp()) {
      if (!threadId) {
        const previewThread: ThreadSummary = {
          id: "browser-preview",
          name: text || t("app.newChat"),
          preview: text,
          cwd: cwd || undefined,
        };
        setThreadId(previewThread.id);
        setThreads((items) => [
          previewThread,
          ...items.filter((item) => item.id !== previewThread.id),
        ]);
      }
      setTimeout(() => {
        setMessages((x) => [
          ...x,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: t("app.preview"),
            tools: [
              {
                id: "1",
                kind: "commandExecution",
                title: t("app.previewTool"),
                detail: "rg --files src",
                status: "done",
                output: "src/App.tsx\nsrc/components/Conversation.tsx\n",
                exitCode: 0,
                durationMs: 84,
              },
              {
                id: "2",
                kind: "imageGeneration",
                title: t("tool.imageGeneration"),
                detail: t("app.previewImage"),
                status: "done",
                artifacts: [
                  {
                    type: "generatedImage",
                    dataUrl:
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJEAIAAADk2OcmAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRP///////wlY99wAAAAHdElNRQfqBxMMIg+1kBTwAAAAYElEQVQoz2MMC8vObmtjoBlg+Vn1Y8fXMhpa8Kvy+45vpbT1wXYa++AHTX3AaLrNiSnwEk19gCUO/kMsx6HnP7IDCemCxcF/JI2MeAxHNgybeog4kgijkpKmppER7YIIAA8zKkZIs1QvAAAAAElFTkSuQmCC",
                    prompt: t("app.previewImage"),
                  },
                ],
              },
              {
                id: "3",
                kind: "webSearch",
                title: t("tool.web"),
                detail: t("app.previewSearch"),
                status: "done",
                artifacts: [
                  {
                    type: "webResult",
                    title: t("app.previewResult"),
                    url: "https://developers.openai.com/codex/",
                    snippet: t("app.previewSnippet"),
                  },
                ],
              },
            ],
          },
        ]);
        setBusy(false);
      }, 900);
      return;
    }
    try {
      const id = threadId ?? (await createThread());
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
            }),
          ),
        (result) => result.turn.id,
      );
    } catch (e) {
      setMessages((x) => [
        ...x,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**${t("app.connectionError")}**\n\n${String(e)}`,
        },
      ]);
      setBusy(false);
    }
  }
  async function toggleVoice() {
    if (recording) {
      await realtimeConversation.stop();
      return;
    }
    if (dictating) return;
    try {
      const parentThreadId = threadId ?? (await createThread());
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
  async function changeCollaborationMode(nextMode: CollaborationMode) {
    const previousMode = collaborationMode;
    setCollaborationMode(nextMode);
    if (!threadId) return true;
    try {
      await request(
        "thread/settings/update",
        threadBehaviorUpdateParams(
          threadId,
          model,
          effort,
          personalityForModel,
          nextMode,
          permission,
          approvalPolicy,
        ),
      );
      return true;
    } catch (error) {
      setCollaborationMode(previousMode);
      showError(t("app.saveSettingsError"), error);
      return false;
    }
  }
  async function changePermission(nextPermission: Permission) {
    const previousPermission = permission;
    runtime.selectPermission(nextPermission);
    if (!threadId) return true;
    try {
      await request(
        "thread/settings/update",
        threadPermissionUpdateParams(threadId, nextPermission),
      );
      return true;
    } catch (error) {
      runtime.selectPermission(previousPermission);
      showError(t("app.saveSettingsError"), error);
      return false;
    }
  }
  async function changeApprovalPolicy(nextPolicy: ApprovalPolicy) {
    const previousPolicy = approvalPolicy;
    runtime.selectApprovalPolicy(nextPolicy);
    if (!threadId) return true;
    try {
      await request(
        "thread/settings/update",
        threadApprovalPolicyUpdateParams(threadId, nextPolicy),
      );
      return true;
    } catch (error) {
      runtime.selectApprovalPolicy(previousPolicy);
      showError(t("app.saveSettingsError"), error);
      return false;
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
  if (settings) {
    return (
      <SettingsLoader
        account={account}
        apps={apps}
        automations={automations}
        capabilities={capabilities}
        configRequirements={configRequirements}
        externalAgentImport={externalAgentImport}
        integrations={integrations}
        models={models}
        rateLimits={rateLimits}
        realtime={realtime}
        memory={memory}
        remoteControl={remoteControl}
        currentThreadId={threadId}
        currentWorkspace={cwd || undefined}
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
          if (deleted) threadSearch.remove(thread.id);
          return deleted;
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
          demoPlayback={
            demoPlayback.enabled && !isReadmeDemoPreview()
              ? {
                  hasPlayed: demoPlayback.hasPlayed,
                  running: demoPlayback.running,
                  onPlay: demoPlayback.play,
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
        />
        <Conversation
          activity={activity}
          canLoadOlder={threadHistory.canLoadOlder}
          cwd={cwd}
          fileOpener={webSearch.fileOpener}
          loadingOlder={threadHistory.loadingOlder}
          messages={messages}
          onLinkError={(error) => showError(t("link.openError"), error)}
          onLoadOlder={threadHistory.loadOlder}
          onReviewDiff={setWorkPanel}
        />
        <ChatFooter
          apps={apps}
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
          onChangeCollaborationMode={changeCollaborationMode}
          onChangePermission={changePermission}
          onChangeApprovalPolicy={changeApprovalPolicy}
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
