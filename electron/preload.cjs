const { contextBridge, ipcRenderer } = require("electron");

const allowedCommands = new Set([
  "start_app_server",
  "send_app_server",
  "read_desktop_settings",
  "update_desktop_settings",
  "read_launch_at_login",
  "set_launch_at_login",
  "transcribe_dictation",
  "read_chromium_status",
  "open_chromium_target",
  "open_chromium_image",
  "install_chromium",
  "cancel_chromium_install",
]);
const allowedEvents = new Set([
  "app-server-message",
  "app-server-exited",
  "new-chat",
]);

contextBridge.exposeInMainWorld("electronDesktop", {
  invoke(command, args) {
    if (!allowedCommands.has(command)) {
      return Promise.reject(new Error(`Unsupported desktop command: ${command}`));
    }
    return ipcRenderer.invoke(`desktop:${command}`, args ?? {});
  },
  listen(event, handler) {
    if (!allowedEvents.has(event)) {
      return Promise.reject(new Error(`Unsupported desktop event: ${event}`));
    }
    const listener = (_ipcEvent, payload) => handler(payload);
    ipcRenderer.on(`desktop:${event}`, listener);
    return Promise.resolve(() =>
      ipcRenderer.removeListener(`desktop:${event}`, listener),
    );
  },
  openDialog: (options) => ipcRenderer.invoke("desktop:open-dialog", options),
  openPath: (path) => ipcRenderer.invoke("desktop:open-path", path),
  openUrl: (url) => ipcRenderer.invoke("desktop:open-url", url),
});
