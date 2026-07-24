import assert from "node:assert/strict";
import test from "node:test";
import { authPath } from "./transcription.mjs";

test("uses the official Codex auth store without copying tokens", () => {
  assert.equal(
    authPath({ HOME: "/home/test" }),
    "/home/test/.codex/auth.json",
  );
  assert.equal(
    authPath({ HOME: "/home/test", CODEX_HOME: "/secure/codex" }),
    "/secure/codex/auth.json",
  );
});
