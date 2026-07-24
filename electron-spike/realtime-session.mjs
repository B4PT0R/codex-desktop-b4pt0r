export function acceptsRealtimeEvent(activeThreadId, eventThreadId) {
  return !activeThreadId || !eventThreadId || activeThreadId === eventThreadId;
}

export function createActivationState() {
  return {
    requestAccepted: false,
    threadStarted: false,
    webRtcConnected: false,
    sessionInitialized: false,
  };
}

export function isRealtimeActive(state) {
  return (
    state.requestAccepted &&
    state.threadStarted &&
    state.webRtcConnected &&
    state.sessionInitialized
  );
}

export function applyActivationSignal(state, signal) {
  switch (signal) {
    case "request-accepted":
      return { ...state, requestAccepted: true };
    case "thread-started":
      return { ...state, threadStarted: true };
    case "webrtc-connected":
      return { ...state, webRtcConnected: true };
    case "session-initialized":
      return { ...state, sessionInitialized: true };
    default:
      return state;
  }
}

export function connectionStatus(state) {
  switch (state) {
    case "connected":
      return {
        kind: "active",
        label: "Realtime actif",
        message: "La connexion audio avec Codex est établie.",
      };
    case "disconnected":
      return {
        kind: "idle",
        label: "Reconnexion…",
        message: "La connexion audio est momentanément interrompue.",
      };
    case "failed":
      return {
        kind: "error",
        label: "Connexion perdue",
        message: "WebRTC n’a pas pu rétablir la session.",
      };
    case "closed":
      return {
        kind: "idle",
        label: "Fermé",
        message: "La connexion audio est fermée.",
      };
    default:
      return {
        kind: "idle",
        label: "Connexion…",
        message: "WebRTC négocie la connexion audio.",
      };
  }
}
