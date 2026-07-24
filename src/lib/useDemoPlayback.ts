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
  setActivity: Dispatch<SetStateAction<AgentActivity>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useDemoPlayback({
  enabled,
  setActivity,
  setMessages,
}: DemoPlaybackOptions) {
  const [running, setRunning] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const timers = useRef<number[]>([]);
  const generation = useRef(0);

  const cancelTimers = useCallback(() => {
    generation.current += 1;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    cancelTimers();
    setRunning(false);
    setActivity(null);
    setMessages(interruptDemoMessages);
  }, [cancelTimers, setActivity, setMessages]);

  const play = useCallback(() => {
    if (!enabled) return;
    cancelTimers();
    const run = generation.current;
    const frames = buildDemoPlaybackFrames();
    setHasPlayed(true);
    setRunning(true);
    for (const frame of frames) {
      const timer = window.setTimeout(() => {
        if (generation.current !== run) return;
        setMessages(frame.update);
        if (Object.hasOwn(frame, "activity")) {
          setActivity(frame.activity ?? null);
        }
        if (frame.complete) {
          timers.current = [];
          setRunning(false);
        }
      }, frame.at);
      timers.current.push(timer);
    }
  }, [cancelTimers, enabled, setActivity, setMessages]);

  useEffect(() => cancelTimers, [cancelTimers]);

  return { enabled, hasPlayed, play, running, stop };
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
    "Je vais parcourir le renderer, mettre à jour le plan puis exécuter les vérifications nécessaires.\n\n",
    90,
    "talking",
  );
  push(900, updatePlan(1), "working");
  push(700, addTool(commandTool("running")), "working");
  push(250, addTool(fileTool("running")), "working");
  push(
    1_800,
    updateTool("demo-live-command", {
      status: "done",
      output: "9 tests réussis",
      exitCode: 0,
      durationMs: 1_742,
    }),
    "working",
  );
  push(
    700,
    updateTool("demo-live-file", { status: "done", durationMs: 1_721 }),
    "talking",
  );
  push(1_600, appendAssistantStep("demo-live-assistant-2"), "talking");

  cursor = appendStreamingText(
    frames,
    cursor,
    "Les deux premières actions sont terminées. Je relis leurs résultats avant de lancer les vérifications finales.\n\n",
    85,
    "talking",
  );
  push(700, updatePlan(2), "working");
  push(650, addTool(reviewTool("running")), "working");
  push(220, addTool(browserTool("running")), "working");
  push(
    1_650,
    updateTool("demo-live-review", {
      status: "done",
      output: "Aucune régression détectée",
      durationMs: 1_534,
    }),
    "working",
  );
  push(
    620,
    updateTool("demo-live-browser", {
      status: "done",
      output: "Aucune erreur console",
      durationMs: 1_988,
    }),
    "talking",
  );
  push(1_600, updatePlan(3), "talking");
  push(300, appendAssistantStep("demo-live-assistant-3"), "talking");

  cursor = appendStreamingText(
    frames,
    cursor,
    "Le flux reste lisible entre les étapes. Le Markdown final affiche une formule inline $E = mc^2$ et chaque série d’actions reste dans son propre groupe.",
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

function reviewTool(status: ToolCall["status"]): ToolCall {
  return {
    id: "demo-live-review",
    kind: "commandExecution",
    title: "Tests ciblés",
    detail: "npm test -- ToolGroup Conversation",
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
