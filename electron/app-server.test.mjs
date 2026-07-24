import assert from "node:assert/strict";
import test from "node:test";
import { findCodexExecutable } from "./app-server.mjs";

test("honors the explicit Codex executable override", async () => {
  assert.equal(
    await findCodexExecutable({
      CODEX_EXECUTABLE: "/opt/codex/bin/codex",
      PATH: "",
      HOME: "/missing",
    }),
    "/opt/codex/bin/codex",
  );
});
