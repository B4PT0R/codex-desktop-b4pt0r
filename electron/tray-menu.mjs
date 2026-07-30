const rendererStates = new Set(["unavailable", "idle", "active", "error"]);

export function rendererRealtimeState(value) {
  if (!rendererStates.has(value)) {
    throw new Error("Invalid tray Realtime state");
  }
  return value === "error" ? "idle" : value;
}

export function trayMenuTemplate({
  realtimeState,
  onNewChat,
  onOpen,
  onQuit,
  onToggleRealtime,
}) {
  const realtimeAvailable = ["idle", "active"].includes(realtimeState);
  const realtimeChecked = ["starting", "active", "stopping"].includes(
    realtimeState,
  );
  return [
    { label: "Ouvrir Codex", click: onOpen },
    { label: "Nouveau chat", click: onNewChat },
    {
      label: "Realtime",
      type: "checkbox",
      checked: realtimeChecked,
      enabled: realtimeAvailable,
      click: onToggleRealtime,
    },
    { type: "separator" },
    { label: "Quitter", click: onQuit },
  ];
}

export function pendingRealtimeState(state) {
  if (state === "idle") return "starting";
  if (state === "active") return "stopping";
  return state;
}

export function realtimeToggleAction(state) {
  return state === "active" ? "stop" : "start";
}
