const { contextBridge, ipcRenderer } = require("electron");

const allowedCommands = new Set([
  "start_app_server",
  "restart_app_server",
  "send_app_server",
  "read_bundled_skills_root",
  "read_desktop_settings",
  "update_desktop_settings",
  "read_codex_config",
  "write_codex_config",
  "read_workspace_agents",
  "write_workspace_agents",
  "read_global_agents",
  "write_global_agents",
  "read_launch_at_login",
  "set_launch_at_login",
  "transcribe_dictation",
  "read_chromium_status",
  "open_chromium_target",
  "open_chromium_image",
  "open_file_reference",
  "save_generated_image",
  "install_chromium",
  "disable_chromium",
  "cancel_chromium_install",
  "automation_list",
  "automation_upsert",
  "automation_delete",
  "automation_run_now",
  "automation_complete",
  "automation_ready",
]);
const allowedEvents = new Set([
  "app-server-message",
  "app-server-exited",
  "new-chat",
  "automation-run-due",
]);

contextBridge.exposeInMainWorld("electronDesktop", {
  invoke(command, args) {
    if (!allowedCommands.has(command)) {
      return Promise.reject(
        new Error(`Unsupported desktop command: ${command}`),
      );
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
