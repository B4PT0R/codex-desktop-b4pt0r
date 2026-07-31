import assert from "node:assert/strict";
import test from "node:test";
import {
  createMainWindow,
  isTrustedMainWindowNavigation,
  observeRendererGone,
  observeWindowShown,
  RendererRecoveryBudget,
  sendToRenderer,
  shouldRecoverRenderer,
} from "./window.mjs";

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

test("sends only while the renderer remains available", () => {
  const sent = [];
  const window = {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (...args) => sent.push(args),
    },
  };

  assert.equal(sendToRenderer(window, "desktop:event", { ok: true }), true);
  assert.deepEqual(sent, [["desktop:event", { ok: true }]]);
  window.webContents.isDestroyed = () => true;
  assert.equal(sendToRenderer(window, "desktop:event", {}), false);
  window.webContents.isDestroyed = () => false;
  window.webContents.send = () => {
    throw new Error("renderer disappeared");
  };
  assert.equal(sendToRenderer(window, "desktop:event", {}), false);
});

test("reports renderer termination details", () => {
  let listener;
  let observed;
  const window = {
    webContents: {
      on: (event, nextListener) => {
        assert.equal(event, "render-process-gone");
        listener = nextListener;
      },
    },
  };
  observeRendererGone(window, (details) => {
    observed = details;
  });
  listener({}, { reason: "crashed", exitCode: 139 });
  assert.deepEqual(observed, { reason: "crashed", exitCode: 139 });
});

test("recovers only from abnormal renderer termination", () => {
  assert.equal(shouldRecoverRenderer(undefined), false);
  assert.equal(shouldRecoverRenderer({ reason: "crashed" }), true);
  assert.equal(shouldRecoverRenderer({ reason: "oom" }), true);
  assert.equal(shouldRecoverRenderer({ reason: "clean-exit" }), false);
});

test("bounds repeated renderer recovery attempts within a time window", () => {
  let now = 1_000;
  const budget = new RendererRecoveryBudget({
    maxAttempts: 2,
    windowMs: 60_000,
    now: () => now,
  });

  assert.equal(budget.claim(), true);
  assert.equal(budget.claim(), true);
  assert.equal(budget.claim(), false);
  now += 60_000;
  assert.equal(budget.claim(), true);
});

test("restricts privileged navigation to the application entry point", () => {
  const root = "/opt/Codex Desktop/resources/app";
  const production = { development: false, root };
  assert.equal(
    isTrustedMainWindowNavigation(
      "file:///opt/Codex%20Desktop/resources/app/dist/index.html#thread",
      production,
    ),
    true,
  );
  assert.equal(
    isTrustedMainWindowNavigation("file:///tmp/untrusted.html", production),
    false,
  );
  assert.equal(
    isTrustedMainWindowNavigation(
      "file:///opt/Codex%20Desktop/resources/app/dist/other.html",
      production,
    ),
    false,
  );

  const development = { development: true, root };
  assert.equal(
    isTrustedMainWindowNavigation("http://localhost:1420/thread/1", development),
    true,
  );
  assert.equal(
    isTrustedMainWindowNavigation("http://127.0.0.1:1420/", development),
    false,
  );
  assert.equal(
    isTrustedMainWindowNavigation("http://localhost:1421/", development),
    false,
  );
});
