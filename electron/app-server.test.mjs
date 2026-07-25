import assert from "node:assert/strict";
import test from "node:test";
import {
  environmentForCodex,
  findCodexExecutable,
} from "./app-server.mjs";

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

test("exposes the discovered Codex directory to App Server tools", () => {
  assert.deepEqual(
    environmentForCodex("/home/alice/.nvm/versions/node/v24/bin/codex", {
      HOME: "/home/alice",
      PATH: "/usr/local/bin:/usr/bin",
    }),
    {
      HOME: "/home/alice",
      PATH: "/home/alice/.nvm/versions/node/v24/bin:/usr/local/bin:/usr/bin",
    },
  );
});

test("does not duplicate an already exposed Codex directory", () => {
  assert.equal(
    environmentForCodex("/opt/codex/bin/codex", {
      PATH: "/usr/bin:/opt/codex/bin:/bin",
    }).PATH,
    "/opt/codex/bin:/usr/bin:/bin",
  );
});

test("preserves PATH lookup when Codex remains a bare command", () => {
  assert.deepEqual(environmentForCodex("codex", { PATH: "/usr/bin" }), {
    PATH: "/usr/bin",
  });
});
