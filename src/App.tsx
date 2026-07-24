import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ApprovalDialog } from "./components/ApprovalDialog";
import { ArchiveNotice } from "./components/ArchiveNotice";
import { ChatFooter } from "./components/ChatFooter";
import { ChatHeader } from "./components/ChatHeader";
import { Conversation } from "./components/Conversation";
import { SettingsLoader } from "./components/SettingsLoader";
import { ShellCommandDialog } from "./components/ShellCommandDialog";
import { Sidebar } from "./components/Sidebar";
import { UserInputDialog } from "./components/UserInputDialog";
import { McpElicitationLoader } from "./components/McpElicitationLoader";
import { WorkPanel } from "./components/WorkPanel";
import {
  configureCodexTranslation,
  isTauri,
  request,
  type AppServerMessage,
} from "./lib/codex";
import type { ThreadStartResponse } from "./lib/appServerTypes";
import {
  acceptRealtimeAnswer,
  playRealtimeAudio,
  startRealtime,
  stopRealtime,
} from "./lib/realtimeBridge";
import {
  threadBehaviorUpdateParams,
  threadCwdUpdateParams,
  threadStartParams,
  turnStartParams,
  turnSteerParams,
  type Permission,
  type TurnContextItem,
} from "./lib/protocol";
import { activityFromEvent, type AgentActivity } from "./lib/activity";
import { applyConversationEvent } from "./lib/conversationEvents";
import { useThreadHistory } from "./lib/useThreadHistory";
import { useInteractiveRequests } from "./lib/useInteractiveRequests";
import { useThreadActions } from "./lib/useThreadActions";
import { useIntegrations } from "./lib/useIntegrations";
import { useCapabilityCatalog } from "./lib/useCapabilityCatalog";
import { useAccount } from "./lib/useAccount";
import { useApps } from "./lib/useApps";
import { useRateLimits } from "./lib/useRateLimits";
import { threadStatusFromValue } from "./lib/threadLifecycle";
import {
  removeDeletedThread,
  removeDeletedThreadTelemetry,
} from "./lib/threadDeletion";
import type { SettingsSectionId } from "./lib/settingsSections";
import { commandFromText } from "./lib/commands";
import {
  contextUsageFromValue,
  modelRerouteFromValue,
  type ThreadTelemetry,
} from "./lib/sessionTelemetry";
import type {
  ChatMessage,
  CollaborationMode,
  Model,
  Personality,
  ThreadSummary,
  ToolCall,
} from "./types";
import { useI18n } from "./i18n/I18nProvider";
import { useAppServerConnection } from "./lib/useAppServerConnection";
import { useThreadSearch } from "./lib/useThreadSearch";
import { useShellCommand } from "./lib/useShellCommand";
import {
  appServerRecord,
  appServerString,
  realtimeAudioFromValue,
} from "./lib/appServerValues";
import "./styles.css";
import "./realtime.css";
import "./activity.css";
import "./empty.css";
import "./signals.css";
import "./tools.css";
import "./telemetry.css";
import "./settings.css";
import "./composer-menus.css";
import "./work-panel.css";
import "./appearance.css";
import "./elicitation.css";
import "./background-terminals.css";
import "./shell-command.css";
const fallbackModels: Model[] = [
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
];

export default function App() {
  const { t } = useI18n();
  configureCodexTranslation(t);
  const translateRef = useRef(t);
  translateRef.current = t;
  const activeThreadRef = useRef<string | undefined>(undefined);
  const workspaceChanged = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [models, setModels] = useState(fallbackModels),
    [model, setModel] = useState(fallbackModels[0].id),
    [effort, setEffort] = useState("medium"),
    [personality, setPersonality] = useState<Personality>("pragmatic"),
    [collaborationMode, setCollaborationMode] =
      useState<CollaborationMode>("default"),
    [busy, setBusy] = useState(false),
    [activity, setActivity] = useState<AgentActivity>(null),
    [recording, setRecording] = useState(false),
    [voiceTranscript, setVoiceTranscript] = useState(""),
    [threadId, setThreadId] = useState<string>(),
    [turnId, setTurnId] = useState<string>(),
    [threads, setThreads] = useState<ThreadSummary[]>([]),
    [threadTelemetry, setThreadTelemetry] = useState<
      Record<string, ThreadTelemetry>
    >({}),
    [sidebar, setSidebar] = useState(true),
    [settings, setSettings] = useState<SettingsSectionId | null>(null),
    [appsEnabled, setAppsEnabled] = useState(false),
    [workPanel, setWorkPanel] = useState<ToolCall>(),
    [permission, setPermission] = useState<Permission>(":workspace");
  const [cwd, setCwd] = useState(
    () => localStorage.getItem("codex-desktop.cwd") ?? "",
  );
  useEffect(() => {
    let disposed = false;
    void import("./lib/desktopSettings")
      .then(({ loadDesktopSettings }) => loadDesktopSettings())
      .then((settings) => {
        if (!disposed && !workspaceChanged.current && settings.lastWorkspace) {
          setCwd(settings.lastWorkspace);
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
      setThreads(history);
    },
    onMessage: handle,
    onNewChat: newChat,
  });
  const threadSearch = useThreadSearch(connection.connected);
  const rateLimits = useRateLimits(connection.connected);
  const apps = useApps({
    enabled: appsEnabled || settings === "plugins",
    threadId,
  });
  useEffect(() => setWorkPanel(undefined), [threadId]);
  function showError(title: string, error: unknown) {
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `**${title}**\n\n${String(error)}`,
      },
    ]);
  }
  const threadHistory = useThreadHistory({
    activeThreadId: threadId,
    onError: showError,
    onMessagesPrepended: (older) =>
      setMessages((items) => [...older, ...items]),
    onMessagesReplaced: setMessages,
    onThreadResumed: (id, resumedCwd) => {
      setThreadId(id);
      if (resumedCwd) {
        setCwd(resumedCwd);
        persistWorkspace(resumedCwd);
      }
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
    stopRealtime();
    setRecording(false);
    setVoiceTranscript("");
    setActivity(null);
    setMessages([]);
    setThreadId(undefined);
    setTurnId(undefined);
    threadHistory.reset();
    setBusy(false);
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
    const params = appServerRecord(msg.params);
    const item = appServerRecord(params?.item);
    const nextActivity = activityFromEvent(
      msg.method ?? "",
      appServerString(item?.type),
    );
    if (nextActivity !== undefined) setActivity(nextActivity);
    if (interactiveRequests.handleMessage(msg)) return;
    setMessages((messages) =>
      applyConversationEvent(messages, msg, translateRef.current),
    );
    if (msg.method === "turn/started") {
      const turn = appServerRecord(params?.turn);
      setTurnId(appServerString(turn?.id));
    }
    if (msg.method === "turn/completed") setBusy(false);
    if (msg.method === "error" && params?.willRetry !== true) {
      setBusy(false);
      setActivity(null);
    }
    if (msg.method === "thread/name/updated") {
      const updatedThreadId = appServerString(params?.threadId);
      const name = appServerString(params?.threadName);
      if (updatedThreadId)
        setThreads((items) =>
          items.map((thread) =>
            thread.id === updatedThreadId
              ? { ...thread, name: name ?? null }
              : thread,
          ),
        );
    }
    if (msg.method === "thread/status/changed") {
      const changedThreadId = appServerString(params?.threadId);
      const status = threadStatusFromValue(params?.status);
      if (changedThreadId && status)
        setThreads((items) =>
          items.map((thread) =>
            thread.id === changedThreadId ? { ...thread, status } : thread,
          ),
        );
    }
    if (msg.method === "thread/deleted") {
      const deletedThreadId = appServerString(params?.threadId);
      if (deletedThreadId) {
        setThreads((items) => removeDeletedThread(items, deletedThreadId));
        setThreadTelemetry((items) =>
          removeDeletedThreadTelemetry(items, deletedThreadId),
        );
        if (activeThreadRef.current === deletedThreadId) newChat();
        threadSearch.remove(deletedThreadId);
      }
    }
    if (msg.method === "thread/tokenUsage/updated") {
      const usageThreadId = appServerString(params?.threadId);
      const context = contextUsageFromValue(params?.tokenUsage);
      if (usageThreadId && context)
        setThreadTelemetry((items) => ({
          ...items,
          [usageThreadId]: { ...items[usageThreadId], context },
        }));
    }
    if (msg.method === "model/rerouted") {
      const rerouteThreadId = appServerString(params?.threadId);
      const reroute = modelRerouteFromValue(params);
      if (rerouteThreadId && reroute)
        setThreadTelemetry((items) => ({
          ...items,
          [rerouteThreadId]: { ...items[rerouteThreadId], reroute },
        }));
    }
    if (msg.method === "turn/started") {
      const startedThreadId = appServerString(params?.threadId);
      if (startedThreadId)
        setThreadTelemetry((items) => ({
          ...items,
          [startedThreadId]: {
            ...items[startedThreadId],
            reroute: undefined,
          },
        }));
    }
    if (msg.method === "thread/realtime/sdp")
      acceptRealtimeAnswer(
        appServerString(params?.threadId) ?? "",
        appServerString(params?.sdp) ?? "",
      );
    if (msg.method === "thread/realtime/outputAudio/delta")
      playRealtimeAudio(
        appServerString(params?.threadId) ?? "",
        realtimeAudioFromValue(params?.audio),
      );
    if (msg.method === "thread/realtime/transcript/delta")
      setVoiceTranscript((x) => x + (appServerString(params?.delta) ?? ""));
    if (msg.method === "thread/realtime/transcript/done") {
      const role = params?.role === "user" ? "user" : "assistant";
      setMessages((x) => [
        ...x,
        {
          id: crypto.randomUUID(),
          role,
          content: appServerString(params?.text) ?? "",
        },
      ]);
      setVoiceTranscript("");
    }
    if (
      msg.method === "thread/realtime/closed" ||
      msg.method === "thread/realtime/error"
    ) {
      setRecording(false);
      setVoiceTranscript("");
      stopRealtime(false);
    }
  }
  async function createThread() {
    const r = await request<ThreadStartResponse>(
      "thread/start",
      threadStartParams(cwd || undefined, model, permission, personality),
    );
    const id = r.thread.id as string;
    const resolvedCwd = (r.cwd ?? r.thread.cwd ?? cwd) as string;
    if (resolvedCwd) {
      setCwd(resolvedCwd);
      persistWorkspace(resolvedCwd);
    }
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
          setCollaborationMode("plan");
          setSettings("agent");
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
            await request("review/start", {
              threadId,
              delivery: "inline",
              target: { type: "uncommittedChanges" },
            });
          } catch (error) {
            setBusy(false);
            showError(t("app.reviewUnavailable"), error);
          }
          return;
      }
      return;
    }
    const attachments = context.map((item) =>
      item.type === "mention"
        ? `@${item.name}`
        : (item.path.split("/").at(-1) ?? item.path),
    );
    setMessages((x) => [
      ...x,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text || t("app.attachments"),
        attachments,
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
    if (!isTauri()) {
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
      await request(
        "turn/start",
        turnStartParams(id, model, text, context, {
          effort,
          personality,
          mode: collaborationMode,
        }),
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
      await stopRealtime();
      setRecording(false);
      setVoiceTranscript("");
      return;
    }
    try {
      const id = threadId ?? (await createThread());
      await startRealtime(id, (error) => {
        setRecording(false);
        setVoiceTranscript("");
        showError(translateRef.current("app.audioInterrupted"), error);
      });
      setRecording(true);
    } catch (e) {
      setMessages((x) => [
        ...x,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**${t("app.realtimeUnavailable")}**\n\n${String(e)}`,
        },
      ]);
      setRecording(false);
    }
  }
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
    if (!selected?.supportsPersonality) setPersonality("none");
  }
  async function saveSettings() {
    if (threadId)
      try {
        await request(
          "thread/settings/update",
          threadBehaviorUpdateParams(
            threadId,
            model,
            effort,
            personality,
            collaborationMode,
            permission,
          ),
        );
      } catch (error) {
        showError(t("app.saveSettingsError"), error);
        return;
      }
    setSettings(null);
  }
  function persistWorkspace(path: string) {
    workspaceChanged.current = true;
    void import("./lib/desktopSettings")
      .then(({ updateDesktopSettings }) =>
        updateDesktopSettings({ lastWorkspace: path }),
      )
      .catch((error) => showError(t("desktopSettings.saveError"), error));
  }
  const currentThread = threads.find((thread) => thread.id === threadId);
  if (settings) {
    return (
      <SettingsLoader
        account={account}
        apps={apps}
        capabilities={capabilities}
        collaborationMode={collaborationMode}
        effort={effort}
        integrations={integrations}
        model={model}
        models={models}
        permission={permission}
        personality={personality}
        rateLimits={rateLimits}
        section={settings}
        onChangeCollaborationMode={setCollaborationMode}
        onChangeEffort={setEffort}
        onChangeModel={changeModel}
        onChangePermission={setPermission}
        onChangePersonality={setPersonality}
        onClose={() => setSettings(null)}
        onSave={saveSettings}
        onSelectSection={setSettings}
      />
    );
  }
  return (
    <div className="app">
      <Sidebar
        cwd={cwd}
        open={sidebar}
        selectedThreadId={threadId}
        threads={threads}
        search={threadSearch}
        onArchive={(thread) => {
          void threadActions.archive(thread.id, thread).then((archived) => {
            if (archived) threadSearch.remove(thread.id);
          });
        }}
        onClose={() => setSidebar(false)}
        onNewChat={newChat}
        onOpenSettings={() => setSettings("general")}
        onResume={threadHistory.resume}
        onSelectDirectory={selectDirectory}
      />
      <main>
        <ChatHeader
          busy={busy}
          connected={connection.connected}
          nativeApp={isTauri()}
          reconnecting={connection.reconnecting}
          sidebarOpen={sidebar}
          threadId={threadId}
          title={
            currentThread?.name ?? currentThread?.preview ?? t("app.newChat")
          }
          onCompact={threadActions.compact}
          onDelete={threadActions.deleteThread}
          onFork={threadActions.fork}
          onOpenSidebar={() => setSidebar(true)}
          onReconnect={() => void connection.reconnect()}
          onRename={threadActions.rename}
        />
        <Conversation
          activity={activity}
          canLoadOlder={threadHistory.canLoadOlder}
          loadingOlder={threadHistory.loadingOlder}
          messages={messages}
          onLoadOlder={threadHistory.loadOlder}
          onReviewDiff={setWorkPanel}
        />
        <ChatFooter
          apps={apps}
          busy={busy}
          canSteer={Boolean(threadId && turnId)}
          cwd={cwd}
          model={model}
          models={models}
          permission={permission}
          quotas={rateLimits.quotas}
          recording={recording}
          hasThread={Boolean(threadId)}
          telemetry={threadId ? threadTelemetry[threadId] : undefined}
          voiceTranscript={voiceTranscript}
          onCompact={() => void threadActions.compact()}
          onOpenModelSettings={() => setSettings("agent")}
          onNeedApps={() => setAppsEnabled(true)}
          onOpenMcpSettings={() => setSettings("mcp")}
          onOpenPermissionSettings={() => setSettings("permissions")}
          onOpenPluginSettings={() => setSettings("plugins")}
          onSend={send}
          onStop={interrupt}
          onToggleVoice={toggleVoice}
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
