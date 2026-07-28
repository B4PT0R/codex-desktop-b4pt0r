import { request as httpRequest } from "node:http";

export class PlaywrightMcpClient {
  #eventStream;
  #eventStreamFactory;
  #fetch;
  #id = 0;
  #reconnecting;
  #sessionId;
  #url;
  #version;

  constructor(
    url,
    version,
    fetchImpl = fetch,
    eventStreamFactory = openMcpEventStream,
  ) {
    this.#url = url;
    this.#version = version;
    this.#fetch = fetchImpl;
    this.#eventStreamFactory = eventStreamFactory;
  }

  async connect() {
    const response = await this.#post({
      jsonrpc: "2.0",
      id: ++this.#id,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "codex-desktop-linux",
          version: this.#version,
        },
      },
    });
    this.#sessionId = response.headers.get("mcp-session-id") ?? undefined;
    await this.#openEventStream();
    await this.#post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      false,
    );
  }

  async callTool({ name, arguments: args }) {
    try {
      return await this.#callTool({ name, arguments: args });
    } catch (error) {
      if (!(error instanceof PlaywrightMcpSessionExpiredError)) throw error;
      await this.#reconnect(error.sessionId);
      return this.#callTool({ name, arguments: args });
    }
  }

  async #callTool({ name, arguments: args }) {
    const response = await this.#post({
      jsonrpc: "2.0",
      id: ++this.#id,
      method: "tools/call",
      params: { name, arguments: args },
    });
    const message = await responseMessage(response);
    if (message.error) throw new Error(message.error.message ?? "MCP tool failed");
    return message.result;
  }

  async close() {
    if (!this.#sessionId) return;
    await this.#fetch(this.#url, {
      method: "DELETE",
      headers: { "mcp-session-id": this.#sessionId },
    }).catch(() => undefined);
    this.#stopEventStream();
    this.#sessionId = undefined;
  }

  async #post(message, expectBody = true) {
    const requestSessionId = this.#sessionId;
    const response = await this.#fetch(this.#url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        ...(this.#sessionId
          ? { "mcp-session-id": this.#sessionId }
          : {}),
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const detail =
        (await response.text()).slice(0, 2_000) ||
        `Playwright MCP returned HTTP ${response.status}`;
      if (response.status === 404 && /session not found/i.test(detail)) {
        throw new PlaywrightMcpSessionExpiredError(
          detail,
          requestSessionId,
        );
      }
      throw new Error(detail);
    }
    if (expectBody) {
      const parsed = await responseMessage(response.clone());
      if (parsed.error) {
        throw new Error(
          parsed.error.message ?? "Playwright MCP request failed",
        );
      }
    }
    return response;
  }

  async #reconnect(expiredSessionId) {
    if (this.#sessionId && this.#sessionId !== expiredSessionId) return;
    if (!this.#reconnecting) {
      if (this.#sessionId === expiredSessionId) {
        this.#stopEventStream();
        this.#sessionId = undefined;
      }
      this.#reconnecting = this.connect().finally(() => {
        this.#reconnecting = undefined;
      });
    }
    await this.#reconnecting;
  }

  async #openEventStream() {
    if (!this.#sessionId) return;
    this.#stopEventStream();
    this.#eventStream = await this.#eventStreamFactory(
      this.#url,
      this.#sessionId,
      (message) => this.#handleServerMessage(message),
    );
  }

  async #handleServerMessage(message) {
    if (
      message?.jsonrpc !== "2.0" ||
      message.method !== "ping" ||
      message.id === undefined
    ) {
      return;
    }
    await this.#post(
      { jsonrpc: "2.0", id: message.id, result: {} },
      false,
    );
  }

  #stopEventStream() {
    this.#eventStream?.close();
    this.#eventStream = undefined;
  }
}

class PlaywrightMcpSessionExpiredError extends Error {
  constructor(message, sessionId) {
    super(message);
    this.name = "PlaywrightMcpSessionExpiredError";
    this.sessionId = sessionId;
  }
}

export function playwrightToolError(result) {
  return (
    result.content
      ?.filter((entry) => entry.type === "text")
      .map((entry) => entry.text)
      .join("\n") || "Playwright could not open the target"
  );
}

export async function responseMessage(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .find(Boolean);
    if (!data) throw new Error("Playwright MCP returned an empty event stream");
    return JSON.parse(data);
  }
  return text ? JSON.parse(text) : {};
}

export function openMcpEventStream(endpoint, sessionId, onMessage = () => {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(endpoint, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
      },
    });
    let settled = false;
    request.once("response", (response) => {
      if (
        response.statusCode === undefined ||
        response.statusCode < 200 ||
        response.statusCode >= 300
      ) {
        response.resume();
        reject(
          new Error(
            `Playwright MCP event stream returned HTTP ${response.statusCode ?? "unknown"}`,
          ),
        );
        return;
      }
      settled = true;
      response.setEncoding("utf8");
      let buffer = "";
      response.on("data", (chunk) => {
        buffer += chunk;
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!data) continue;
          try {
            const message = JSON.parse(data);
            Promise.resolve(onMessage(message)).catch(() => undefined);
          } catch {
            // Ignore malformed server events; the transport remains recoverable.
          }
        }
      });
      resolve({
        close() {
          response.destroy();
          request.destroy();
        },
      });
    });
    request.once("error", (error) => {
      if (!settled) reject(error);
    });
    request.end();
  });
}
