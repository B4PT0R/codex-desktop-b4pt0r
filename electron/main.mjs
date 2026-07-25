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
import {
  cancelChromiumInstall,
  chromiumStatus,
  installChromium,
  openChromiumImage,
  openChromiumTarget,
  stopManagedChromium,
} from "./chromium.mjs";
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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isDevelopment = !app.isPackaged;
let mainWindow;
let tray;

function send(event, payload) {
  if (!mainWindow?.isDestroyed()) {
    mainWindow.webContents.send(`desktop:${event}`, payload);
  }
}

const appServer = new AppServerTransport(send);

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
  ipcMain.handle("desktop:send_app_server", (event, args) => {
    trusted(event);
    if (typeof args?.message !== "string" || args.message.length > 16_000_000) {
      throw new Error("Invalid App Server message");
    }
    appServer.send(args.message);
  });
  ipcMain.handle("desktop:read_desktop_settings", (event) => {
    trusted(event);
    return readSettings(settingsPath(app.getPath("home")));
  });
  ipcMain.handle("desktop:update_desktop_settings", (event, args) => {
    trusted(event);
    return updateSettings(
      settingsPath(app.getPath("home")),
      args?.patch ?? {},
    );
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
  ipcMain.handle("desktop:read_launch_at_login", (event) => {
    trusted(event);
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle("desktop:set_launch_at_login", (event, args) => {
    trusted(event);
    app.setLoginItemSettings({
      openAtLogin: Boolean(args?.enabled),
      args: ["--hidden"],
    });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle("desktop:transcribe_dictation", (event, args) => {
    trusted(event);
    return transcribeDictation(args?.audio, process.env, net.fetch);
  });
  ipcMain.handle("desktop:read_chromium_status", (event) => {
    trusted(event);
    return chromiumStatus();
  });
  ipcMain.handle("desktop:open_chromium_target", (event, args) => {
    trusted(event);
    return openChromiumTarget(args?.target, app.getPath("home"));
  });
  ipcMain.handle("desktop:open_chromium_image", (event, args) => {
    trusted(event);
    return openChromiumImage(args?.dataUrl, app.getPath("home"));
  });
  ipcMain.handle("desktop:install_chromium", (event, args) => {
    trusted(event);
    if (args?.confirmed !== true) {
      throw new Error("Chromium installation requires explicit confirmation");
    }
    return installChromium();
  });
  ipcMain.handle("desktop:cancel_chromium_install", (event) => {
    trusted(event);
    return cancelChromiumInstall();
  });
  ipcMain.handle("desktop:open-dialog", async (event, options) => {
    trusted(event);
    const properties = [
      options?.directory ? "openDirectory" : "openFile",
      ...(options?.multiple ? ["multiSelections"] : []),
    ];
    const result = await dialog.showOpenDialog(mainWindow, { properties });
    if (result.canceled) return null;
    return options?.multiple ? result.filePaths : result.filePaths[0] ?? null;
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
    installPermissionPolicy();
    registerIpc();
    createWindow();
    createTray();
  });
}

app.on("before-quit", () => {
  app.isQuitting = true;
  appServer.stop();
  stopManagedChromium();
});
