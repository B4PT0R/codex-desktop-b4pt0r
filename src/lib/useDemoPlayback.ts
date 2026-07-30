import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AgentActivity } from "./activity";
import type { AgentSignal, ChatMessage, ToolCall } from "../types";
import { closedStepRevealDelay } from "./toolActivityTiming";

type DemoPlaybackFrame = {
  at: number;
  activity?: AgentActivity;
  complete?: boolean;
  update: (messages: ChatMessage[]) => ChatMessage[];
};

type DemoPlaybackOptions = {
  enabled: boolean;
  scopeKey?: string;
  setActivity: Dispatch<SetStateAction<AgentActivity>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useDemoPlayback({
  enabled,
  scopeKey,
  setActivity,
  setMessages,
}: DemoPlaybackOptions) {
  const [running, setRunning] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const timers = useRef<number[]>([]);
  const generation = useRef(0);
  const scheduledScope = useRef<string | undefined>(undefined);

  const cancelTimers = useCallback(() => {
    generation.current += 1;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    scheduledScope.current = undefined;
  }, []);

  const stop = useCallback(() => {
    cancelTimers();
    setRunning(false);
    setLoadingThread(false);
    setActivity(null);
    setMessages(interruptDemoMessages);
  }, [cancelTimers, setActivity, setMessages]);

  const play = useCallback(() => {
    if (!enabled) return;
    cancelTimers();
    const run = generation.current;
    scheduledScope.current = scopeKey;
    const frames = buildDemoPlaybackFrames();
    setHasPlayed(true);
    setRunning(true);
    setLoadingThread(false);
    for (const frame of frames) {
      const timer = window.setTimeout(() => {
        if (generation.current !== run) return;
        setMessages(frame.update);
        if (Object.hasOwn(frame, "activity")) {
          setActivity(frame.activity ?? null);
        }
        if (frame.complete) {
          timers.current = [];
          scheduledScope.current = undefined;
          setRunning(false);
        }
      }, frame.at);
      timers.current.push(timer);
    }
  }, [cancelTimers, enabled, scopeKey, setActivity, setMessages]);

  const previewThreadLoading = useCallback(() => {
    if (!enabled) return;
    cancelTimers();
    const run = generation.current;
    scheduledScope.current = scopeKey;
    setRunning(false);
    setActivity(null);
    setLoadingThread(true);
    const timer = window.setTimeout(() => {
      if (generation.current !== run) return;
      timers.current = [];
      scheduledScope.current = undefined;
      setLoadingThread(false);
    }, 3_000);
    timers.current = [timer];
  }, [cancelTimers, enabled, scopeKey, setActivity]);

  const submitPreview = useCallback(
    ({
      message,
      onComplete,
      threadId,
    }: {
      message: ChatMessage;
      onComplete: () => void;
      threadId: string;
    }) => {
      cancelTimers();
      const run = generation.current;
      scheduledScope.current = threadId;
      const timer = window.setTimeout(() => {
        if (generation.current !== run) return;
        timers.current = [];
        scheduledScope.current = undefined;
        setMessages((messages) => [...messages, message]);
        onComplete();
      }, 900);
      timers.current = [timer];
    },
    [cancelTimers, setMessages],
  );

  useEffect(() => {
    if (
      timers.current.length > 0 &&
      scheduledScope.current !== scopeKey
    ) {
      cancelTimers();
      setRunning(false);
      setLoadingThread(false);
      setActivity(null);
    }
  }, [cancelTimers, scopeKey, setActivity]);

  useEffect(() => cancelTimers, [cancelTimers]);

  return {
    enabled,
    hasPlayed,
    loadingThread,
    play,
    previewThreadLoading,
    running,
    stop,
    submitPreview,
  };
}

function interruptDemoMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) =>
    message.id.startsWith("demo-live-assistant")
      ? {
          ...message,
          streaming: false,
          signals: message.signals?.filter(
            (signal) => signal.kind !== "plan",
          ).map((signal) =>
            signal.status === "running"
              ? { ...signal, status: "done" as const }
              : signal,
          ),
          tools: message.tools?.map((tool) =>
            tool.status === "running"
              ? { ...tool, status: "error" as const }
              : tool,
          ),
        }
      : message,
  );
}

export function buildDemoPlaybackFrames(): DemoPlaybackFrame[] {
  const frames: DemoPlaybackFrame[] = [];
  let cursor = 0;
  const push = (
    delay: number,
    update: DemoPlaybackFrame["update"],
    activity?: AgentActivity,
    complete = false,
  ) => {
    cursor += delay;
    frames.push({ at: cursor, update, activity, complete });
  };

  push(
    0,
    () => [
      {
        id: "demo-live-user",
        role: "user",
        content:
          "Peux-tu vérifier le rendu du chat, simuler quelques outils et valider le résultat ?",
      },
    ],
    null,
  );
  push(
    700,
    (messages) => [
      ...messages,
      {
        id: "demo-live-assistant-1",
        role: "assistant",
        content: "",
        streaming: true,
        signals: [initialReasoning(), planSignal(0)],
      },
    ],
    "thinking",
  );
  push(
    1_000,
    updateReasoning("J’examine la structure du transcript…"),
    "thinking",
  );
  push(
    1_200,
    updateReasoning(
      "J’examine la structure du transcript et les surfaces persistantes.",
    ),
    "thinking",
  );
  push(900, completeReasoning, "talking");

  cursor = appendStreamingText(
    frames,
    cursor,
    "Je vais vérifier le renderer puis faire circuler une série d’actions assez longue pour éprouver les transitions.\n\n",
    90,
    "talking",
  );
  push(900, updatePlan(1), "working");
  // Three calls belong to the same agentic step. The UI deliberately presents
  // their details one after another even when App Server announces them close
  // together.
  push(700, addTool(commandTool("running")), "working");
  push(180, addTool(fileTool("running")), "working");
  push(180, addTool(browserTool("running")), "working");
  push(
    650,
    updateTool("demo-live-command", {
      output: "rendering.test.tsx\nToolGroup.test.tsx\n",
    }),
    "working",
  );
  push(
    850,
    updateTool("demo-live-command", {
      status: "done",
      output: "9 tests réussis",
      exitCode: 0,
      durationMs: 1_742,
    }),
    "working",
  );
  push(
    1_700,
    updateTool("demo-live-file", { status: "done", durationMs: 1_721 }),
    "working",
  );
  push(
    1_700,
    updateTool("demo-live-browser", {
      status: "done",
      output: "Mise en page stable à 1240 × 820",
      durationMs: 1_988,
    }),
    "working",
  );

  // Further silent agentic steps keep feeding the same group: no assistant
  // prose and no non-action item has created a visual boundary.
  push(700, updatePlan(2), "working");
  push(1_100, addTool(schemaTool("running")), "working");
  push(
    1_450,
    updateTool("demo-live-schema", {
      status: "done",
      output: "Schéma compatible",
      durationMs: 1_364,
    }),
    "working",
  );
  push(1_550, addTool(lintTool("running")), "working");
  push(
    1_450,
    updateTool("demo-live-lint", {
      status: "done",
      output: "0 erreur TypeScript",
      durationMs: 1_402,
    }),
    "working",
  );
  push(1_550, addTool(packageTool("running")), "working");
  push(
    1_450,
    updateTool("demo-live-package", {
      status: "done",
      output: "Bundle Electron prêt",
      durationMs: 1_411,
    }),
    "working",
  );
  push(1_550, addTool(auditTool("running")), "working");
  push(
    1_450,
    updateTool("demo-live-audit", {
      status: "done",
      output: "0 vulnérabilité",
      durationMs: 1_395,
    }),
    "working",
  );

  // This completed signal is a real non-action boundary. It closes the first
  // seven-call group before the next calls form a fresh group underneath.
  push(1_650, appendCompactionStep, "compacting");
  push(4_700, completeCompaction, "working");
  push(900, addTool(devServerTool("running")), "working");
  push(
    650,
    updateTool("demo-live-dev-server", {
      output: "Local: http://127.0.0.1:1420/\nready in 412 ms",
    }),
    "working",
  );
  push(500, addTool(finalBrowserTool("running")), "working");
  push(
    1_500,
    updateTool("demo-live-browser-final", {
      status: "done",
      output: "Preview ouverte",
      durationMs: 1_468,
    }),
    "working",
  );
  push(1_650, addTool(browserInspectTool("running")), "working");
  push(
    1_500,
    updateTool("demo-live-browser-inspect", {
      status: "done",
      output: "Aucune erreur console, scroll ancré",
      durationMs: 1_432,
    }),
    "working",
  );
  push(1_600, updatePlan(3), "talking");
  push(300, appendAssistantStep("demo-live-assistant-final"), "talking");

  cursor = appendStreamingText(
    frames,
    cursor,
    "La vague reste continue : les sept premières actions demeurent agrégées malgré les steps silencieux, la compaction crée une frontière nette, puis le serveur de preview cède la place aux deux contrôles Playwright sans attendre de s’arrêter. Le Markdown reste rendu pendant le flux, avec $E = mc^2$.",
    85,
    "talking",
  );
  push(
    1_000,
    (messages) =>
      updateLatestAssistant(messages, (message) => ({
        ...message,
        streaming: false,
      })).map((message) => ({
        ...message,
        signals: message.signals?.map((signal) =>
          signal.kind === "plan" ? planSignal(4, "done") : signal,
        ),
      })),
    null,
    true,
  );
  return frames;
}

function appendStreamingText(
  frames: DemoPlaybackFrame[],
  start: number,
  text: string,
  interval: number,
  activity: AgentActivity,
) {
  let at = start;
  for (const token of text.match(/\S+\s*/g) ?? []) {
    at += interval;
    frames.push({
      at,
      activity,
      update: (messages) =>
        updateLatestAssistant(messages, (message) => ({
          ...message,
          content: `${message.content}${token}`,
        })),
    });
  }
  return at;
}

function initialReasoning(): AgentSignal {
  return {
    id: "demo-live-reasoning",
    kind: "reasoning",
    title: "Analyse de l’interface",
    detail: "",
    status: "running",
  };
}

function updateReasoning(detail: string) {
  return (messages: ChatMessage[]) =>
    updateLatestAssistant(messages, (message) => ({
      ...message,
      signals: message.signals?.map((signal) =>
        signal.kind === "reasoning" ? { ...signal, detail } : signal,
      ),
    }));
}

function completeReasoning(messages: ChatMessage[]) {
  return updateLatestAssistant(messages, (message) => ({
    ...message,
    signals: message.signals?.map((signal) =>
      signal.kind === "reasoning" ? { ...signal, status: "done" } : signal,
    ),
  }));
}

function planSignal(
  completed: number,
  status: AgentSignal["status"] = "running",
): AgentSignal {
  const labels = [
    "Inspecter le renderer",
    "Simuler le streaming",
    "Vérifier les appels d’outils",
    "Finaliser les animations",
  ];
  return {
    id: "demo-live-plan",
    kind: "plan",
    title: "Plan de vérification",
    status,
    steps: labels.map((step, index) => ({
      step,
      status:
        index < completed
          ? "completed"
          : index === completed && completed < labels.length
            ? "inProgress"
            : "pending",
    })),
  };
}

function updatePlan(completed: number) {
  return (messages: ChatMessage[]) =>
    messages.map((message) => ({
      ...message,
      signals: message.signals?.map((signal) =>
        signal.kind === "plan" ? planSignal(completed) : signal,
      ),
    }));
}

function commandTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-command",
    kind: "commandExecution",
    title: "Tests du renderer",
    detail: "npm test -- rendering",
    status,
  };
}

function fileTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-file",
    kind: "fileChange",
    title: "Mise à jour de l’interface",
    detail: "src/components/Conversation.tsx",
    diff: "+ streaming stable\n+ plan mis à jour",
    status,
  };
}

function devServerTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-dev-server",
    kind: "commandExecution",
    title: "Serveur de preview",
    detail: "npm run dev",
    status,
  };
}

function browserTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-browser",
    kind: "mcpToolCall",
    title: "Validation visuelle",
    detail: "Playwright · conversation",
    status,
  };
}

function schemaTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-schema",
    kind: "commandExecution",
    title: "Contrat App Server",
    detail: "npm run test:contract",
    status,
  };
}

function lintTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-lint",
    kind: "commandExecution",
    title: "Vérification TypeScript",
    detail: "npm run check",
    status,
  };
}

function packageTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-package",
    kind: "commandExecution",
    title: "Construction Electron",
    detail: "npm run build",
    status,
  };
}

function auditTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-audit",
    kind: "commandExecution",
    title: "Audit des dépendances",
    detail: "npm audit",
    status,
  };
}

function finalBrowserTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-browser-final",
    kind: "mcpToolCall",
    title: "Contrôle du scroll",
    detail: "Playwright · ancrage bas",
    status,
  };
}

function browserInspectTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-browser-inspect",
    kind: "mcpToolCall",
    title: "Inspection Playwright",
    detail: "Playwright · console et mise en page",
    status,
  };
}

function appendCompactionStep(messages: ChatMessage[]): ChatMessage[] {
  const previousTools = messages.at(-1)?.tools?.length ?? 1;
  return [
    ...messages.map((message) =>
      message.role === "assistant" && message.streaming
        ? { ...message, streaming: false }
        : message,
    ),
    {
      id: "demo-live-compaction",
      role: "assistant",
      content: "",
      revealAfter: Date.now() + closedStepRevealDelay(previousTools),
      signals: [
        {
          id: "demo-live-compaction-signal",
          kind: "compaction",
          title: "Compaction du contexte",
          status: "running",
        },
      ],
    },
  ];
}

function completeCompaction(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) =>
    message.id === "demo-live-compaction"
      ? {
          ...message,
          signals: message.signals?.map((signal) =>
            signal.kind === "compaction"
              ? {
                  ...signal,
                  title: "Contexte compacté",
                  status: "done" as const,
                }
              : signal,
          ),
        }
      : message,
  );
}

function addTool(tool: ToolCall) {
  return (messages: ChatMessage[]) =>
    updateLatestAssistant(messages, (message) => ({
      ...message,
      tools: [...(message.tools ?? []), tool],
    }));
}

function updateTool(id: string, patch: Partial<ToolCall>) {
  return (messages: ChatMessage[]) =>
    updateLatestAssistant(messages, (message) => ({
      ...message,
      tools: message.tools?.map((tool) =>
        tool.id === id ? { ...tool, ...patch } : tool,
      ),
    }));
}

function appendAssistantStep(id: string) {
  return (messages: ChatMessage[]): ChatMessage[] => [
    ...messages.map((message) =>
      message.role === "assistant" && message.streaming
        ? { ...message, streaming: false }
        : message,
    ),
    {
      id,
      role: "assistant",
      content: "",
      streaming: true,
      revealAfter:
        Date.now() +
        closedStepRevealDelay(messages.at(-1)?.tools?.length ?? 1),
    },
  ];
}

function updateLatestAssistant(
  messages: ChatMessage[],
  update: (message: ChatMessage) => ChatMessage,
) {
  let index = -1;
  for (let cursor = messages.length - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor].role === "assistant") {
      index = cursor;
      break;
    }
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index ? update(message) : message,
  );
}
