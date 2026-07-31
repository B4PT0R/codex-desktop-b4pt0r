import assert from "node:assert/strict";
import test from "node:test";
import { createMainWindow, observeWindowShown } from "./window.mjs";

test("creates a sandboxed window without a browser menu bar", () => {
  let options;
  const window = {
    setMenu: (menu) => assert.equal(menu, null),
    setMenuBarVisibility: (visible) => assert.equal(visible, false),
  };
  class BrowserWindow {
    constructor(nextOptions) {
      options = nextOptions;
      return window;
    }
  }

  assert.equal(
    createMainWindow(BrowserWindow, { hidden: false, root: "/app" }),
    window,
  );
  assert.equal(options.autoHideMenuBar, true);
  assert.equal(options.minWidth, 520);
  assert.equal(options.minHeight, 620);
  assert.equal(options.show, true);
  assert.equal(options.webPreferences.backgroundThrottling, false);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.preload, "/app/electron/preload.cjs");
});

test("reports both showing and restoring the hidden window", () => {
  const listeners = new Map();
  const window = {
    on: (event, listener) => listeners.set(event, listener),
  };
  let shown = 0;

  observeWindowShown(window, () => {
    shown += 1;
  });
  listeners.get("show")();
  listeners.get("restore")();

  assert.equal(shown, 2);
});
