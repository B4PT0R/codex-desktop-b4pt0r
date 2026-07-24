export function createTranscriptState() {
  return {
    history: [],
    live: { user: "", assistant: "" },
  };
}

function transcriptRole(value) {
  return value === "user" ? "user" : "assistant";
}

export function applyTranscriptEvent(state, method, params = {}) {
  const role = transcriptRole(params.role);
  if (method === "thread/realtime/transcript/delta") {
    return {
      history: state.history,
      live: {
        ...state.live,
        [role]: `${state.live[role]}${params.delta ?? ""}`,
      },
    };
  }
  if (method !== "thread/realtime/transcript/done") return state;

  const text = String(params.text ?? state.live[role]).trim();
  const last = state.history.at(-1);
  return {
    history:
      text && (last?.role !== role || last.text !== text)
        ? [...state.history, { role, text }]
        : state.history,
    live: { ...state.live, [role]: "" },
  };
}

export function renderTranscript(state) {
  const label = (role) => (role === "user" ? "Vous" : "Codex");
  const complete = state.history.map(
    (item) => `${label(item.role)} : ${item.text}`,
  );
  const streaming = ["user", "assistant"]
    .filter((role) => state.live[role])
    .map((role) => `${label(role)} : ${state.live[role]}`);
  return [...complete, ...streaming].join("\n\n");
}
