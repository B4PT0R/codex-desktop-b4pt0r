import assert from "node:assert/strict";
import test from "node:test";
import { createMainWindow } from "./window.mjs";

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
  assert.equal(options.show, true);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.preload, "/app/electron/preload.cjs");
});
