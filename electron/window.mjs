import path from "node:path";

export function createMainWindow(BrowserWindow, { hidden, root }) {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 840,
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
