import path from "node:path";
import { fileURLToPath } from "node:url";

export function createMainWindow(BrowserWindow, { hidden, root }) {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 520,
    minHeight: 620,
    title: "Codex",
    show: !hidden,
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(root, "electron/preload.cjs"),
      sandbox: true,
      webSecurity: true,
    },
  });
  window.setMenu(null);
  window.setMenuBarVisibility(false);
  return window;
}

export function observeWindowShown(window, onShown) {
  window.on("show", onShown);
  window.on("restore", onShown);
}

export function sendToRenderer(window, channel, payload) {
  if (!window || window.isDestroyed() || window.webContents?.isDestroyed()) {
    return false;
  }
  try {
    window.webContents.send(channel, payload);
    return true;
  } catch {
    // A renderer can disappear between the state checks and the actual send.
    return false;
  }
}

export function observeRendererGone(window, onGone) {
  window.webContents.on("render-process-gone", (_event, details) =>
    onGone(details),
  );
}

export function shouldRecoverRenderer(details) {
  return Boolean(details && details.reason !== "clean-exit");
}

export class RendererRecoveryBudget {
  #attempts = [];
  #maxAttempts;
  #now;
  #windowMs;

  constructor({ maxAttempts = 2, windowMs = 60_000, now = Date.now } = {}) {
    this.#maxAttempts = maxAttempts;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  claim() {
    const current = this.#now();
    this.#attempts = this.#attempts.filter(
      (attempt) => current - attempt < this.#windowMs,
    );
    if (this.#attempts.length >= this.#maxAttempts) return false;
    this.#attempts.push(current);
    return true;
  }
}

export function isTrustedMainWindowNavigation(
  target,
  { development, root },
) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (development) return url.origin === "http://localhost:1420";
  if (url.protocol !== "file:" || url.hostname) return false;
  try {
    return (
      path.resolve(fileURLToPath(url)) === path.resolve(root, "dist/index.html")
    );
  } catch {
    return false;
  }
}
