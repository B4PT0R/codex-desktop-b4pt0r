import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  session,
} from "electron";
import { AppServerClient, realtimeStartParams } from "./app-server-client.mjs";
import {
  PROBE_ORIGIN,
  canCheckMicrophone,
  canRequestMicrophone,
} from "./media-policy.mjs";

const probeRoot = path.dirname(fileURLToPath(import.meta.url));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
]);
let realtimeThreadId;
let appServer;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

function resolveProbeAsset(requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== "app:" || url.hostname !== "probe") return undefined;
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const candidate = path.resolve(probeRoot, relativePath || "index.html");
  const relative = path.relative(probeRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return candidate;
}

async function serveProbe(request) {
  const assetPath = resolveProbeAsset(request.url);
  if (!assetPath) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(assetPath);
    return new Response(body, {
      headers: {
        "content-type":
          contentTypes.get(path.extname(assetPath)) ??
          "application/octet-stream",
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function installPermissionPolicy() {
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) =>
      canCheckMicrophone({
        permission,
        requestingOrigin,
        mediaType: details.mediaType,
        isMainFrame: details.isMainFrame,
      }),
  );
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(
        canRequestMicrophone({
          permission,
          pageUrl: webContents.getURL(),
          requestingUrl: details.requestingUrl ?? details.securityOrigin ?? "",
          mediaTypes: details.mediaTypes,
        }),
      );
    },
  );
}

function createProbeWindow() {
  const window = new BrowserWindow({
    width: 720,
    height: 600,
    minWidth: 560,
    minHeight: 480,
    title: "Codex Desktop — Electron audio probe",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(probeRoot, "preload.cjs"),
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${PROBE_ORIGIN}/`)) event.preventDefault();
  });
  void window.loadURL(`${PROBE_ORIGIN}/index.html`);
}

app.whenReady().then(async () => {
  protocol.handle("app", serveProbe);
  installPermissionPolicy();
  ipcMain.handle("probe:realtime-start", async (event, payload) => {
    if (
      typeof payload?.sdp !== "string" ||
      payload.sdp.length === 0 ||
      payload.sdp.length > 1_000_000
    ) {
      throw new Error("Invalid WebRTC offer");
    }
    if (!event.sender.getURL().startsWith(`${PROBE_ORIGIN}/`)) {
      throw new Error("Untrusted realtime request");
    }
    appServer ??= new AppServerClient((message) => {
      if (
        message.method === "thread/realtime/error" ||
        message.method === "thread/realtime/closed"
      ) {
        const detail =
          message.params?.message ?? message.params?.reason ?? "unspecified";
        console.error(`[electron-probe] ${message.method}: ${detail}`);
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send("probe:realtime-event", message);
      }
    });
    await appServer.connect();
    if (realtimeThreadId) {
      await appServer
        .request("thread/realtime/stop", { threadId: realtimeThreadId })
        .catch(() => undefined);
    }
    const started = await appServer.request("thread/start", {
      cwd: process.cwd(),
      ephemeral: true,
    });
    const threadId = started?.thread?.id;
    if (typeof threadId !== "string") {
      throw new Error("App Server returned no thread id");
    }
    realtimeThreadId = threadId;
    await appServer.request(
      "thread/realtime/start",
      realtimeStartParams(threadId, payload.sdp),
    );
    return { threadId };
  });
  ipcMain.handle("probe:realtime-stop", async (event) => {
    if (!event.sender.getURL().startsWith(`${PROBE_ORIGIN}/`)) return;
    const threadId = realtimeThreadId;
    realtimeThreadId = undefined;
    if (threadId && appServer) {
      await appServer
        .request("thread/realtime/stop", { threadId })
        .catch(() => undefined);
    }
  });
  createProbeWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createProbeWindow();
  });
});

app.on("window-all-closed", () => {
  appServer?.close();
  app.quit();
});
