import assert from "node:assert/strict";
import test from "node:test";
import { discoverChromium } from "./chromium.mjs";

test("honors the explicit managed Chromium executable", async () => {
  assert.equal(
    await discoverChromium({
      CODEX_CHROMIUM_EXECUTABLE: process.execPath,
      PATH: "",
    }),
    process.execPath,
  );
});
