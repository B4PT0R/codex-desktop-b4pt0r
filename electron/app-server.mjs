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
  #send;

  constructor(send) {
    this.#send = send;
  }

  async start() {
    if (this.#child?.stdin.writable) return !this.#initialized;
    const executable = await findCodexExecutable();
    const child = spawn(
      executable,
      appServerArguments,
      {
        env: environmentForCodex(executable),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.#child = child;
    createInterface({ input: child.stdout }).on("line", (line) =>
      this.#send("app-server-message", line),
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
    if (!this.#child?.stdin.writable) {
      throw new Error("app-server non démarré");
    }
    this.#child.stdin.write(`${message}\n`);
    try {
      const parsed = JSON.parse(message);
      if (parsed?.method === "initialized") this.#initialized = true;
    } catch {
      // App Server will report malformed protocol input itself.
    }
  }

  stop() {
    const child = this.#child;
    this.#child = undefined;
    this.#initialized = false;
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
    this.#send("app-server-exited", { code, message });
  }
}
