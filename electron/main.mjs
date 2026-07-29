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
  session,
  shell,
  Tray,
} from "electron";
import { AppServerTransport } from "./app-server.mjs";
import { readSettings, settingsPath, updateSettings } from "./settings.mjs";
import { transcribeDictation } from "./transcription.mjs";
import { SharedBrowserManager, stopManagedChromium } from "./chromium.mjs";
import { openFileReference } from "./file-reference.mjs";
import { createMainWindow } from "./window.mjs";
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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isDevelopment = !app.isPackaged;
let mainWindow;
let tray;
let automationScheduler;

function send(event, payload) {
  if (!mainWindow?.isDestroyed()) {
    mainWindow.webContents.send(`desktop:${event}`, payload);
  }
}

const appServer = new AppServerTransport(send);
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
  if (isDevelopment) void mainWindow.loadURL("http://localhost:1420/");
  else void mainWindow.loadFile(path.join(root, "dist/index.html"));
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(root, "electron/assets/tray-icon.png"),
  );
  tray = new Tray(icon.resize({ width: 22, height: 22 }));
  tray.setToolTip("Codex Desktop");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir Codex", click: () => mainWindow.show() },
      {
        label: "Nouveau chat",
        click: () => {
          mainWindow.show();
          send("new-chat");
        },
      },
      { type: "separator" },
      {
        label: "Quitter",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
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
      home: app.getPath("home"),
      root,
    });
    automationScheduler = new AutomationScheduler({
      file: settingsPath(app.getPath("home")),
      send,
    });
    automationScheduler.start();
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
  appServer.stop();
  void stopManagedChromium(sharedBrowser);
});
