export class PlaywrightMcpClient {
  #id = 0;
  #sessionId;
  #url;
  #version;

  constructor(url, version) {
    this.#url = url;
    this.#version = version;
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
    await this.#post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      false,
    );
  }

  async callTool({ name, arguments: args }) {
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
    await fetch(this.#url, {
      method: "DELETE",
      headers: { "mcp-session-id": this.#sessionId },
    }).catch(() => undefined);
    this.#sessionId = undefined;
  }

  async #post(message, expectBody = true) {
    const response = await fetch(this.#url, {
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
      throw new Error(
        (await response.text()).slice(0, 2_000) ||
          `Playwright MCP returned HTTP ${response.status}`,
      );
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
