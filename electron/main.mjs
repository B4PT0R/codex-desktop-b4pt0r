import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  Notification,
  powerMonitor,
  session,
  shell,
  Tray,
} from "electron";
import { AppServerTransport } from "./app-server.mjs";
import { AppServerHealthMonitor } from "./app-server-health.mjs";
import { readSettings, settingsPath, updateSettings } from "./settings.mjs";
import { transcribeDictation } from "./transcription.mjs";
import { SharedBrowserManager, stopManagedChromium } from "./chromium.mjs";
import { openFileReference } from "./file-reference.mjs";
import { createMainWindow, observeWindowShown } from "./window.mjs";
import {
  codexConfigPath,
  readCodexConfig,
  writeCodexConfig,
} from "./codex-config.mjs";
import {
  readWorkspaceAgents,
  writeWorkspaceAgents,
} from "./workspace-agents.mjs";
import {
  globalAgentsPath,
  readGlobalAgents,
  writeGlobalAgents,
} from "./global-agents.mjs";
import { readThreadInstructions } from "./thread-instructions.mjs";
import {
  generatedImageSaveOptions,
  saveGeneratedImage,
} from "./generated-image.mjs";
import {
  autostartPath,
  readLaunchAtLogin,
  setLaunchAtLogin,
} from "./autostart.mjs";
import { bundledSkillsRoot } from "./bundled-skills.mjs";
import { AutomationScheduler } from "./automation-scheduler.mjs";
import {
  pendingRealtimeState,
  realtimeToggleAction,
  rendererRealtimeState,
  trayMenuTemplate,
} from "./tray-menu.mjs";
import {
  AppUpdateManager,
} from "./app-update.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isDevelopment = !app.isPackaged;
let mainWindow;
let tray;
let automationScheduler;
let appServerHealthMonitor;
let trayRealtimeState = "unavailable";
let appUpdateManager;

function send(event, payload) {
  if (!mainWindow?.isDestroyed()) {
    mainWindow.webContents.send(`desktop:${event}`, payload);
  }
}

function sendAppServerEvent(event, payload) {
  if (event === "app-server-exited") automationScheduler?.notReady();
  send(event, payload);
}

const appServer = new AppServerTransport(sendAppServerEvent);
let sharedBrowser;

function trusted(event) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents
  ) {
    throw new Error("Untrusted desktop request");
  }
}

function registerIpc() {
  ipcMain.handle("desktop:start_app_server", async (event) => {
    trusted(event);
    return appServer.start();
  });
  ipcMain.handle("desktop:restart_app_server", async (event) => {
    trusted(event);
    return appServer.restart();
  });
  ipcMain.handle("desktop:send_app_server", (event, args) => {
    trusted(event);
    if (typeof args?.message !== "string" || args.message.length > 16_000_000) {
      throw new Error("Invalid App Server message");
    }
    appServer.send(args.message);
  });
  ipcMain.handle("desktop:read_bundled_skills_root", (event) => {
    trusted(event);
    return bundledSkillsRoot({
      appRoot: root,
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    });
  });
  ipcMain.handle("desktop:read_desktop_settings", (event) => {
    trusted(event);
    return readSettings(settingsPath(app.getPath("home")));
  });
  ipcMain.handle("desktop:update_desktop_settings", (event, args) => {
    trusted(event);
    return updateSettings(settingsPath(app.getPath("home")), args?.patch ?? {});
  });
  ipcMain.handle("desktop:read_app_versions", (event) => {
    trusted(event);
    return appUpdateManager.versions();
  });
  ipcMain.handle("desktop:check_for_updates", async (event) => {
    trusted(event);
    return appUpdateManager.check();
  });
  ipcMain.handle("desktop:install_update", async (event, args) => {
    trusted(event);
    return appUpdateManager.install(args?.confirmed);
  });
  ipcMain.handle("desktop:set_tray_realtime_state", (event, args) => {
    trusted(event);
    trayRealtimeState = rendererRealtimeState(args?.state);
    updateTrayMenu();
    if (
      args?.state === "error" &&
      typeof args?.message === "string" &&
      args.message
    ) {
      showRealtimeError(args.message);
    }
  });
  ipcMain.handle("desktop:read_codex_config", (event) => {
    trusted(event);
    return readCodexConfig(codexConfigPath(app.getPath("home"), process.env));
  });
  ipcMain.handle("desktop:write_codex_config", (event, args) => {
    trusted(event);
    return writeCodexConfig(
      codexConfigPath(app.getPath("home"), process.env),
      args?.content,
      args?.expectedVersion,
    );
  });
  ipcMain.handle("desktop:read_workspace_agents", (event, args) => {
    trusted(event);
    return readWorkspaceAgents(args?.workspace);
  });
  ipcMain.handle("desktop:write_workspace_agents", (event, args) => {
    trusted(event);
    return writeWorkspaceAgents(
      args?.workspace,
      args?.content,
      args?.expectedVersion,
    );
  });
  ipcMain.handle("desktop:read_global_agents", (event) => {
    trusted(event);
    return readGlobalAgents(globalAgentsPath(app.getPath("home"), process.env));
  });
  ipcMain.handle("desktop:write_global_agents", (event, args) => {
    trusted(event);
    return writeGlobalAgents(
      globalAgentsPath(app.getPath("home"), process.env),
      args?.content,
      args?.expectedVersion,
    );
  });
  ipcMain.handle("desktop:read_thread_instructions", (event, args) => {
    trusted(event);
    return readThreadInstructions(
      appServer.instructionSources(args?.threadId),
      args?.developerInstructions,
    );
  });
  ipcMain.handle("desktop:read_launch_at_login", async (event) => {
    trusted(event);
    return readLaunchAtLogin(
      autostartPath(app.getPath("home"), process.env),
      process.execPath,
    );
  });
  ipcMain.handle("desktop:set_launch_at_login", async (event, args) => {
    trusted(event);
    return setLaunchAtLogin(
      autostartPath(app.getPath("home"), process.env),
      process.execPath,
      Boolean(args?.enabled),
    );
  });
  ipcMain.handle("desktop:transcribe_dictation", (event, args) => {
    trusted(event);
    return transcribeDictation(args?.audio, process.env, net.fetch);
  });
  ipcMain.handle("desktop:read_chromium_status", (event) => {
    trusted(event);
    return readSettings(settingsPath(app.getPath("home"))).then((settings) =>
      sharedBrowser.status(settings.sharedBrowserEnabled === true),
    );
  });
  ipcMain.handle("desktop:open_chromium_target", async (event, args) => {
    trusted(event);
    const settings = await readSettings(settingsPath(app.getPath("home")));
    return sharedBrowser.openTarget(
      args?.target,
      settings.sharedBrowserEnabled === true,
    );
  });
  ipcMain.handle("desktop:open_chromium_image", async (event, args) => {
    trusted(event);
    const settings = await readSettings(settingsPath(app.getPath("home")));
    return sharedBrowser.openImage(
      args?.dataUrl,
      settings.sharedBrowserEnabled === true,
    );
  });
  ipcMain.handle("desktop:open_file_reference", (event, args) => {
    trusted(event);
    return openFileReference(args, shell);
  });
  ipcMain.handle("desktop:save_generated_image", async (event, args) => {
    trusted(event);
    const options = await generatedImageSaveOptions(
      args,
      app.getPath("pictures"),
    );
    const result = await dialog.showSaveDialog(mainWindow, options);
    if (result.canceled || !result.filePath) return false;
    await saveGeneratedImage(args, result.filePath);
    return true;
  });
  ipcMain.handle("desktop:install_chromium", async (event, args) => {
    trusted(event);
    if (args?.confirmed !== true) {
      throw new Error("Chromium installation requires explicit confirmation");
    }
    const status = await sharedBrowser.activate();
    await updateSettings(settingsPath(app.getPath("home")), {
      sharedBrowserEnabled: true,
    });
    return status;
  });
  ipcMain.handle("desktop:disable_chromium", async (event) => {
    trusted(event);
    await updateSettings(settingsPath(app.getPath("home")), {
      sharedBrowserEnabled: false,
    });
    return sharedBrowser.deactivate();
  });
  ipcMain.handle("desktop:cancel_chromium_install", (event) => {
    trusted(event);
    return sharedBrowser.cancelInstall();
  });
  ipcMain.handle("desktop:automation_list", (event) => {
    trusted(event);
    return automationScheduler.list();
  });
  ipcMain.handle("desktop:automation_upsert", (event, args) => {
    trusted(event);
    return automationScheduler.upsert(args?.automation);
  });
  ipcMain.handle("desktop:automation_delete", (event, args) => {
    trusted(event);
    return automationScheduler.remove(args?.id);
  });
  ipcMain.handle("desktop:automation_run_now", (event, args) => {
    trusted(event);
    return automationScheduler.runNow(args?.id);
  });
  ipcMain.handle("desktop:automation_complete", (event, args) => {
    trusted(event);
    return automationScheduler.complete(args);
  });
  ipcMain.handle("desktop:automation_ready", (event) => {
    trusted(event);
    return automationScheduler.ready();
  });
  ipcMain.handle("desktop:open-dialog", async (event, options) => {
    trusted(event);
    const properties = [
      options?.directory ? "openDirectory" : "openFile",
      ...(options?.multiple ? ["multiSelections"] : []),
    ];
    const result = await dialog.showOpenDialog(mainWindow, { properties });
    if (result.canceled) return null;
    return options?.multiple ? result.filePaths : (result.filePaths[0] ?? null);
  });
  ipcMain.handle("desktop:open-path", async (event, target) => {
    trusted(event);
    if (typeof target !== "string") throw new Error("Invalid path");
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:open-url", async (event, target) => {
    trusted(event);
    const url = new URL(target);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      throw new Error("Unsupported external URL");
    }
    await shell.openExternal(url.toString());
  });
}

function installPermissionPolicy() {
  const isTrusted = (webContents) =>
    Boolean(
      mainWindow &&
      !mainWindow.isDestroyed() &&
      webContents === mainWindow.webContents,
    );
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, _origin, details) =>
      permission === "media" &&
      details.mediaType === "audio" &&
      isTrusted(webContents),
  );
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const mediaTypes = details.mediaTypes ?? [];
      callback(
        permission === "media" &&
          mediaTypes.length === 1 &&
          mediaTypes[0] === "audio" &&
          isTrusted(webContents),
      );
    },
  );
}

function createWindow() {
  mainWindow = createMainWindow(BrowserWindow, {
    hidden: process.argv.includes("--hidden"),
    root,
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDevelopment
      ? url.startsWith("http://localhost:1420/")
      : url.startsWith("file://");
    if (!allowed) event.preventDefault();
  });
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  observeWindowShown(mainWindow, () => send("window-shown"));
  if (isDevelopment) void mainWindow.loadURL("http://localhost:1420/");
  else void mainWindow.loadFile(path.join(root, "dist/index.html"));
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(root, "electron/assets/tray-icon.png"),
  );
  tray = new Tray(icon.resize({ width: 22, height: 22 }));
  tray.setToolTip("Codex Desktop");
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuTemplate({
        realtimeState: trayRealtimeState,
        onOpen: () => mainWindow.show(),
        onNewChat: () => {
          send("new-chat");
          mainWindow.show();
        },
        onToggleRealtime: () => {
          const action = realtimeToggleAction(trayRealtimeState);
          trayRealtimeState = pendingRealtimeState(trayRealtimeState);
          updateTrayMenu();
          send("realtime-tray-toggle", {
            action,
            home: app.getPath("home"),
            windowVisible: mainWindow.isVisible(),
          });
        },
        onQuit: () => {
          app.isQuitting = true;
          app.quit();
        },
      }),
    ),
  );
}

function showRealtimeError(message) {
  const body = message.slice(0, 1_024);
  if (Notification.isSupported()) {
    new Notification({ title: "Codex Desktop — Realtime", body }).show();
    return;
  }
  tray?.displayBalloon?.({
    title: "Codex Desktop — Realtime",
    content: body,
  });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.whenReady().then(() => {
    sharedBrowser = new SharedBrowserManager({
      clientVersion: app.getVersion(),
      home: app.getPath("home"),
      root,
    });
    automationScheduler = new AutomationScheduler({
      file: settingsPath(app.getPath("home")),
      send,
    });
    appUpdateManager = new AppUpdateManager({
      architecture: process.arch,
      clientVersion: app.getVersion(),
      fetchImpl: net.fetch,
      tempRoot: app.getPath("temp"),
    });
    automationScheduler.start();
    appServerHealthMonitor = new AppServerHealthMonitor(appServer);
    appServerHealthMonitor.start();
    powerMonitor.on("resume", () =>
      appServerHealthMonitor?.afterSystemResume(),
    );
    powerMonitor.on("unlock-screen", () =>
      appServerHealthMonitor?.afterSystemResume(),
    );
    installPermissionPolicy();
    registerIpc();
    createWindow();
    createTray();
    void readSettings(settingsPath(app.getPath("home")))
      .then((settings) =>
        sharedBrowser.startIfEnabled(settings.sharedBrowserEnabled === true),
      )
      .catch(() => undefined);
  });
}

app.on("before-quit", () => {
  app.isQuitting = true;
  automationScheduler?.stop();
  appServerHealthMonitor?.stop();
  appServer.stop();
  void stopManagedChromium(sharedBrowser);
});
