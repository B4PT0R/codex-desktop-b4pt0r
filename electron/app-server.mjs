import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

export const appServerArguments = [
  "app-server",
  "-c",
  "features.realtime_conversation=true",
  "-c",
  "features.browser_use=false",
  "-c",
  "features.browser_use_external=false",
  "-c",
  "features.in_app_browser=false",
  "-c",
  "features.computer_use=false",
  "--stdio",
];

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findCodexExecutable(environment = process.env) {
  if (environment.CODEX_EXECUTABLE?.trim()) {
    return environment.CODEX_EXECUTABLE.trim();
  }
  for (const directory of (environment.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(directory, "codex");
    if (directory && (await exists(candidate))) return candidate;
  }
  const nodeRoot = path.join(environment.HOME ?? "", ".nvm/versions/node");
  try {
    const versions = (await readdir(nodeRoot)).sort().reverse();
    for (const version of versions) {
      const candidate = path.join(nodeRoot, version, "bin/codex");
      if (await exists(candidate)) return candidate;
    }
  } catch {
    // The actionable spawn error below includes the final attempted executable.
  }
  return "codex";
}

export function environmentForCodex(
  executable,
  environment = process.env,
) {
  if (!path.isAbsolute(executable)) return { ...environment };
  const executableDirectory = path.dirname(executable);
  const pathEntries = (environment.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  return {
    ...environment,
    PATH: [
      executableDirectory,
      ...pathEntries.filter((entry) => entry !== executableDirectory),
    ].join(path.delimiter),
  };
}

export class AppServerTransport {
  #child;
  #initialized = false;
  #probe;
  #probeSequence = 0;
  #send;
  #spawnProcess;
  #resolveExecutable;

  constructor(
    send,
    {
      spawnProcess = spawn,
      resolveExecutable = findCodexExecutable,
    } = {},
  ) {
    this.#send = send;
    this.#spawnProcess = spawnProcess;
    this.#resolveExecutable = resolveExecutable;
  }

  async start() {
    if (this.#child?.stdin.writable) return !this.#initialized;
    const executable = await this.#resolveExecutable();
    const child = this.#spawnProcess(
      executable,
      appServerArguments,
      {
        env: environmentForCodex(executable),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.#child = child;
    createInterface({ input: child.stdout }).on("line", (line) =>
      this.#handleLine(child, line),
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });
    child.once("error", (error) =>
      this.#handleExit(child, null, error.message),
    );
    child.once("exit", (code) =>
      this.#handleExit(child, code, stderr.trim() || null),
    );
    return true;
  }

  send(message) {
    const parsed = parseOutboundMessage(message);
    if (!this.#child?.stdin.writable) {
      throw new Error("app-server non démarré");
    }
    this.#child.stdin.write(`${message}\n`);
    if (parsed.method === "initialized") this.#initialized = true;
  }

  async probe(timeoutMs = 15_000) {
    const child = this.#child;
    if (!child?.stdin.writable || !this.#initialized) return "unavailable";
    if (this.#probe) return this.#probe.promise;

    const id = `desktop-health:${++this.#probeSequence}`;
    let resolveProbe;
    const promise = new Promise((resolve) => {
      resolveProbe = resolve;
    });
    const timer = setTimeout(
      () => this.#settleProbe(id, "unresponsive"),
      timeoutMs,
    );
    timer.unref?.();
    this.#probe = { id, promise, resolve: resolveProbe, timer };
    child.stdin.write(
      `${JSON.stringify({
        id,
        method: "thread/list",
        params: { limit: 1, sortKey: "updated_at" },
      })}\n`,
      (error) => {
        if (error) this.#settleProbe(id, "unresponsive");
      },
    );
    return promise;
  }

  terminateUnresponsive() {
    const child = this.#child;
    if (!child) return false;
    this.#child = undefined;
    this.#initialized = false;
    this.#settleProbe(this.#probe?.id, "unavailable");
    child.kill();
    this.#send("app-server-exited", {
      code: null,
      message: null,
      reason: "unresponsive",
    });
    return true;
  }

  stop() {
    const child = this.#child;
    this.#child = undefined;
    this.#initialized = false;
    this.#settleProbe(this.#probe?.id, "unavailable");
    child?.kill();
  }

  async restart() {
    this.stop();
    return this.start();
  }

  #handleExit(child, code, message) {
    if (this.#child !== child) return;
    this.#child = undefined;
    this.#initialized = false;
    this.#settleProbe(this.#probe?.id, "unavailable");
    this.#send("app-server-exited", { code, message });
  }

  #handleLine(child, line) {
    if (this.#child !== child) return;
    try {
      const message = JSON.parse(line);
      if (String(message?.id ?? "").startsWith("desktop-health:")) {
        if (message.id === this.#probe?.id) {
          this.#settleProbe(this.#probe.id, "responsive");
        }
        return;
      }
    } catch {
      // The renderer owns normal protocol validation and its visible warning.
    }
    this.#send("app-server-message", line);
  }

  #settleProbe(id, status) {
    if (!id || this.#probe?.id !== id) return;
    const probe = this.#probe;
    this.#probe = undefined;
    clearTimeout(probe.timer);
    probe.resolve(status);
  }
}

function parseOutboundMessage(message) {
  if (typeof message !== "string" || /[\r\n]/.test(message)) {
    throw new Error("Invalid App Server message");
  }
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    throw new Error("Invalid App Server message");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid App Server message");
  }
  return parsed;
}
