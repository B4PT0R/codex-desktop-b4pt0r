const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronProbe", {
  startRealtime: (sdp) => ipcRenderer.invoke("probe:realtime-start", { sdp }),
  stopRealtime: () => ipcRenderer.invoke("probe:realtime-stop"),
  onRealtimeEvent: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("probe:realtime-event", listener);
    return () => ipcRenderer.removeListener("probe:realtime-event", listener);
  },
});
