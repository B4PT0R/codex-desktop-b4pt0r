import { describe, expect, it, vi } from "vitest";
import { JsonRpcClient } from "../../src/lib/jsonRpc";
import { translate } from "../../src/i18n/translate";
import {
  appServerClientInfo,
  isReusableInitialization,
  parseAppServerPayload,
} from "../../src/lib/codex";
import packageMetadata from "../../package.json";

describe("client JSON-RPC", () => {
  it("annonce à App Server la version du paquet construit", () => {
    expect(appServerClientInfo()).toEqual({
      name: "codex-desktop-linux",
      title: "Codex Desktop Linux",
      version: packageMetadata.version,
    });
  });

  it("résout une réponse et réserve un identifiant par requête", async () => {
    const send = vi.fn(async () => undefined);
    const client = new JsonRpcClient(send, undefined, "session-a");
    const first = client.request<string>("thread/read", { threadId: "one" });
    const second = client.request<string>("thread/read", { threadId: "two" });

    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      id: "session-a:1",
      method: "thread/read",
      params: { threadId: "one" },
    });
    expect(client.receive({ id: "session-a:2", result: "second" })).toBe(
      true,
    );
    expect(client.receive({ id: "session-a:1", result: "first" })).toBe(
      true,
    );
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("rejette les erreurs de transport sans conserver la requête", async () => {
    const client = new JsonRpcClient(
      async () => {
        throw new Error("stdin fermée");
      },
      undefined,
      "session-b",
    );
    const request = client.request("turn/start");
    await expect(request).rejects.toThrow("stdin fermée");
    expect(client.receive({ id: "session-b:1", result: null })).toBe(false);
  });

  it("rejette toutes les requêtes en attente à la déconnexion", async () => {
    const client = new JsonRpcClient(
      async () => undefined,
      undefined,
      "session-c",
    );
    const first = client.request("model/list");
    const second = client.request("thread/list");
    client.disconnect(new Error("App Server arrêté"));
    await expect(first).rejects.toThrow("App Server arrêté");
    await expect(second).rejects.toThrow("App Server arrêté");
  });

  it("localise les erreurs de repli du transport", async () => {
    const t = (
      key: Parameters<typeof translate>[1],
      params?: Record<string, string | number>,
    ) => translate("en", key, params);
    const client = new JsonRpcClient(
      async () => Promise.reject({}),
      t,
      "session-d",
    );

    await expect(client.request("turn/start")).rejects.toThrow(
      "Unable to send request turn/start",
    );

    const pending = new JsonRpcClient(
      async () => undefined,
      t,
      "session-e",
    );
    const request = pending.request("model/list");
    expect(pending.receive({ id: "session-e:1", error: {} })).toBe(true);
    await expect(request).rejects.toThrow("App Server error");
  });

  it("rejette les enveloppes App Server malformées", () => {
    expect(parseAppServerPayload('{"method":"turn/started"}')).toEqual({
      method: "turn/started",
    });
    expect(() => parseAppServerPayload("secret payload")).toThrow();
    expect(() => parseAppServerPayload("null")).toThrow();
    expect(() => parseAppServerPayload("[]")).toThrow();
  });

  it("ne réutilise que le transport déjà initialisé officiel", () => {
    expect(isReusableInitialization(new Error("Already initialized"))).toBe(
      true,
    );
    expect(
      isReusableInitialization(new Error("Error: Already initialized")),
    ).toBe(true);
    expect(isReusableInitialization(new Error("Not initialized"))).toBe(false);
    expect(isReusableInitialization("Already initialized")).toBe(true);
    expect(isReusableInitialization({ message: "Already initialized" })).toBe(
      false,
    );
  });
});
