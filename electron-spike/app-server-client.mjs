import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const MAX_STDERR_LENGTH = 8_000;
export const REALTIME_MODEL = "gpt-live-1-codex";

export function appServerCommand(environment = process.env) {
  return environment.CODEX_EXECUTABLE?.trim() || "codex";
}

export function initializeParams() {
  return {
    clientInfo: {
      name: "codex-desktop-linux-electron-probe",
      title: "Codex Desktop Linux Electron Probe",
      version: "0.1.0",
    },
    capabilities: { experimentalApi: true },
  };
}

export function realtimeStartParams(threadId, sdp, voice = "juniper") {
  return {
    threadId,
    model: REALTIME_MODEL,
    version: "v3",
    outputModality: "audio",
    transport: { type: "webrtc", sdp },
    includeStartupContext: false,
    flushTranscriptTailOnSessionEnd: true,
    codexResponseHandoffPrefix: "",
    codexResponseItemPrefix: null,
    codexResponsesAsItems: false,
    initialItems: [],
    realtimeSessionId: null,
    voice,
  };
}

export class AppServerClient {
  #child;
  #nextId = 1;
  #pending = new Map();
  #notificationHandler;
  #stderr = "";
  #ready;

  constructor(notificationHandler = () => undefined) {
    this.#notificationHandler = notificationHandler;
  }

  async connect() {
    if (this.#ready) return this.#ready;
    this.#ready = this.#connect();
    try {
      await this.#ready;
    } catch (error) {
      this.#ready = undefined;
      throw error;
    }
  }

  async #connect() {
    const child = spawn(
      appServerCommand(),
      ["app-server", "-c", "features.realtime_conversation=true", "--stdio"],
      {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.#child = child;
    child.once("error", (error) => this.#disconnect(error));
    child.once("exit", (code, signal) => {
      const detail = this.#stderr.trim();
      this.#disconnect(
        new Error(
          `codex app-server stopped (${signal ?? code ?? "unknown"})${
            detail ? `: ${detail}` : ""
          }`,
        ),
      );
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      this.#stderr = `${this.#stderr}${chunk}`.slice(-MAX_STDERR_LENGTH);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => this.#receive(line));

    await this.request("initialize", initializeParams());
    this.notify("initialized", {});
  }

  request(method, params = {}) {
    if (!this.#child?.stdin.writable) {
      return Promise.reject(new Error("codex app-server is not connected"));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#write({ id, method, params });
    });
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  close() {
    const child = this.#child;
    this.#child = undefined;
    this.#ready = undefined;
    if (child && !child.killed) child.kill();
    this.#disconnect(new Error("codex app-server closed"));
  }

  #write(message) {
    const stdin = this.#child?.stdin;
    if (!stdin?.writable) throw new Error("codex app-server is not connected");
    stdin.write(`${JSON.stringify(message)}\n`);
  }

  #receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message && Object.hasOwn(message, "id")) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(message.error.message ?? "App Server request failed"),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (
      typeof message?.method === "string" &&
      message.method.startsWith("thread/realtime/")
    ) {
      this.#notificationHandler({
        method: message.method,
        params: message.params ?? {},
      });
    }
  }

  #disconnect(error) {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
