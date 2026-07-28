import { spawn } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { BrowserArtifactServer } from "./browser-artifacts.mjs";
import {
  ensurePlaywrightCodexConfig,
  removePlaywrightCodexConfig,
} from "./playwright-codex-config.mjs";
import {
  PlaywrightMcpClient,
  playwrightToolError,
} from "./playwright-mcp-client.mjs";

const MCP_HOST = "127.0.0.1";
const MCP_PORT = 8931;
const MCP_URL = `http://localhost:${MCP_PORT}/mcp`;
const MAX_INSTALL_LOG = 8_000;

export const sharedBrowserEndpoint = MCP_URL;

export class SharedBrowserManager {
  #artifacts;
  #client;
  #environment;
  #home;
  #installLog = "";
  #installer;
  #processExecutable;
  #root;
  #server;
  #spawn;

  constructor({
    home,
    root,
    environment = process.env,
    processExecutable = process.execPath,
    spawnProcess = spawn,
  }) {
    this.#home = home;
    this.#root = root;
    this.#environment = environment;
    this.#processExecutable = processExecutable;
    this.#spawn = spawnProcess;
    this.#artifacts = new BrowserArtifactServer(
      sharedBrowserPaths(home).artifacts,
    );
  }

  async status(enabled = false) {
    const executable = await this.#installedExecutable();
    return {
      available: Boolean(executable),
      enabled,
      running: Boolean(this.#server && this.#server.exitCode == null),
      installing: Boolean(this.#installer),
      installSupported: true,
      installPackage: "Playwright Chromium",
      version: executable ? await browserVersion(executable) : undefined,
      mcpVersion: await packageVersion(
        path.join(this.#root, "node_modules/@playwright/mcp/package.json"),
      ),
      ...(this.#installLog ? { detail: this.#installLog } : {}),
    };
  }

  async activate() {
    const executable =
      (await this.#installedExecutable()) ?? (await this.#installBrowser());
    try {
      await this.#startServer(executable);
      const client = await this.#connectClient();
      const verification = await client.callTool({
        name: "browser_tabs",
        arguments: { action: "list" },
      });
      if (verification.isError)
        throw new Error(playwrightToolError(verification));
      await this.#ensureCodexConfig();
      return this.status(true);
    } catch (error) {
      await this.#stopServer();
      throw error;
    }
  }

  cancelInstall() {
    if (!this.#installer) return false;
    this.#installer.kill();
    this.#installer = undefined;
    return true;
  }

  async deactivate() {
    this.cancelInstall();
    await this.#stopServer();
    await this.#artifacts.stop();
    await removePlaywrightCodexConfig({
      endpoint: MCP_URL,
      environment: this.#environment,
      spawnProcess: this.#spawn,
    });
    return this.status(false);
  }

  async openTarget(target, enabled) {
    if (!enabled) throw new Error("Shared browser is disabled");
    const validated = await validateTarget(target);
    const executable = await this.#installedExecutable();
    if (!executable) throw new Error("Shared Playwright browser is not installed");
    await this.#startServer(executable);
    const client = await this.#connectClient();
    const result = await client.callTool({
      name: "browser_navigate",
      arguments: { url: validated },
    });
    if (result.isError) throw new Error(playwrightToolError(result));
  }

  async openImage(dataUrl, enabled) {
    const url = await this.#artifacts.pageForImage(dataUrl);
    return this.openTarget(url, enabled);
  }

  async startIfEnabled(enabled) {
    if (!enabled) return;
    const executable = await this.#installedExecutable();
    if (!executable) return;
    await this.#startServer(executable);
    await this.#ensureCodexConfig();
  }

  async stop() {
    await this.#stopServer();
    this.#installer?.kill();
    this.#installer = undefined;
    await this.#artifacts.stop();
  }

  async #stopServer() {
    const client = this.#client;
    const server = this.#server;
    this.#client = undefined;
    this.#server = undefined;
    server?.kill();
    await client?.close().catch(() => undefined);
  }

  async #installBrowser() {
    if (this.#installer) throw new Error("Browser installation is already running");
    const paths = sharedBrowserPaths(this.#home);
    await privateDirectory(paths.browsers);
    const cli = path.join(
      this.#root,
      "node_modules/playwright-core",
      "cli.js",
    );
    this.#installLog = "";
    const child = this.#spawn(
      this.#processExecutable,
      [cli, "install", "chromium", "--no-shell"],
      {
        env: this.#nodeEnvironment(paths.browsers),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.#installer = child;
    child.stdout?.on("data", (chunk) => this.#appendInstallLog(chunk));
    child.stderr?.on("data", (chunk) => this.#appendInstallLog(chunk));
    try {
      await childExit(child, "Playwright browser installer");
    } finally {
      if (this.#installer === child) this.#installer = undefined;
    }
    const executable = await this.#installedExecutable();
    if (!executable)
      throw new Error("Playwright completed without installing Chromium");
    return executable;
  }

  async #installedExecutable() {
    const paths = sharedBrowserPaths(this.#home);
    process.env.PLAYWRIGHT_BROWSERS_PATH = paths.browsers;
    const { chromium } = await import("playwright-core");
    const executable = chromium.executablePath();
    try {
      await access(executable, 1);
      return executable;
    } catch {
      return undefined;
    }
  }

  async #startServer(executable) {
    if (this.#server && this.#server.exitCode == null) return;
    const paths = sharedBrowserPaths(this.#home);
    await stopStaleSharedBrowserServer(paths.serverPid, paths.profile);
    await Promise.all([
      privateDirectory(paths.profile),
      privateDirectory(paths.output),
    ]);
    const cli = path.join(
      this.#root,
      "node_modules/@playwright/mcp/cli.js",
    );
    let stderr = "";
    const child = this.#spawn(
      this.#processExecutable,
      [
        cli,
        "--host",
        MCP_HOST,
        "--port",
        String(MCP_PORT),
        "--shared-browser-context",
        "--user-data-dir",
        paths.profile,
        "--output-dir",
        paths.output,
        "--console-level",
        "warning",
        "--executable-path",
        executable,
      ],
      {
        env: this.#nodeEnvironment(paths.browsers),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.#server = child;
    try {
      await writeFile(paths.serverPid, `${child.pid}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch (error) {
      child.kill();
      this.#server = undefined;
      throw error;
    }
    child.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_INSTALL_LOG);
    });
    child.once("exit", () => {
      if (this.#server === child) this.#server = undefined;
      void removeOwnedPidFile(paths.serverPid, child.pid);
      void this.#client?.close().catch(() => undefined);
      this.#client = undefined;
    });
    child.once("error", () => {
      if (this.#server === child) this.#server = undefined;
      void removeOwnedPidFile(paths.serverPid, child.pid);
    });
    try {
      await waitForServer(child);
    } catch (error) {
      child.kill();
      if (this.#server === child) this.#server = undefined;
      throw new Error(stderr || error.message);
    }
  }

  async #connectClient() {
    if (this.#client) return this.#client;
    const client = new PlaywrightMcpClient(MCP_URL, "0.3.3");
    await client.connect();
    this.#client = client;
    return client;
  }

  async #ensureCodexConfig() {
    await ensurePlaywrightCodexConfig({
      endpoint: MCP_URL,
      environment: this.#environment,
      spawnProcess: this.#spawn,
    });
  }

  #nodeEnvironment(browserPath) {
    return {
      ...this.#environment,
      ELECTRON_RUN_AS_NODE: "1",
      PLAYWRIGHT_BROWSERS_PATH: browserPath,
    };
  }

  #appendInstallLog(chunk) {
    this.#installLog = `${this.#installLog}${String(chunk)}`.slice(
      -MAX_INSTALL_LOG,
    );
  }

}

export function sharedBrowserPaths(home) {
  const root = path.join(home, ".local", "share", "codex-desktop");
  return {
    root,
    browsers: path.join(root, "browsers"),
    profile: path.join(root, "browser-profile"),
    output: path.join(root, "browser-output"),
    artifacts: path.join(root, "browser-artifacts"),
    serverPid: path.join(root, "playwright-mcp.pid"),
  };
}

export function isOwnedSharedBrowserProcess(
  argv,
  uid,
  profile,
  currentUid = process.getuid?.(),
) {
  if (
    !Array.isArray(argv) ||
    (typeof currentUid === "number" && uid !== currentUid)
  )
    return false;
  const cli = argv.some(
    (argument) =>
      argument.endsWith("/@playwright/mcp/cli.js") ||
      argument.includes("/@playwright/mcp/cli.js"),
  );
  return (
    cli &&
    argumentValue(argv, "--port") === String(MCP_PORT) &&
    argumentValue(argv, "--user-data-dir") === profile
  );
}

async function validateTarget(target) {
  if (
    typeof target !== "string" ||
    target.length > 32_768 ||
    /[\0\r\n]/.test(target)
  )
    throw new Error("Invalid browser target");
  const url = new URL(target);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Shared browser target must be an HTTP(S) URL");
  return url.toString();
}

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

async function stopStaleSharedBrowserServer(pidFile, profile) {
  let pid;
  try {
    pid = Number.parseInt((await readFile(pidFile, "utf8")).trim(), 10);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) {
    await unlink(pidFile).catch(() => undefined);
    return;
  }
  if (process.platform !== "linux") {
    await unlink(pidFile).catch(() => undefined);
    return;
  }
  try {
    const [command, processStat] = await Promise.all([
      readFile(`/proc/${pid}/cmdline`),
      stat(`/proc/${pid}`),
    ]);
    const argv = command
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    if (!isOwnedSharedBrowserProcess(argv, processStat.uid, profile)) {
      await unlink(pidFile).catch(() => undefined);
      return;
    }
    process.kill(pid, "SIGTERM");
    for (let attempt = 0; attempt < 20; attempt++) {
      await delay(50);
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") break;
        throw error;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
  } finally {
    await removeOwnedPidFile(pidFile, pid);
  }
}

async function removeOwnedPidFile(pidFile, pid) {
  try {
    if (Number.parseInt((await readFile(pidFile, "utf8")).trim(), 10) === pid)
      await unlink(pidFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function argumentValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function browserVersion(executable) {
  return new Promise((resolve) => {
    const child = spawn(executable, ["--version"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(0, 200);
    });
    child.once("error", () => resolve(undefined));
    child.once("exit", () => resolve(output.trim() || undefined));
  });
}

async function packageVersion(file) {
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(file, "utf8")).version;
  } catch {
    return undefined;
  }
}

function childExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${code ?? signal}`));
    });
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while starting Playwright MCP"));
    }, 8_000);
    const onData = (chunk) => {
      output = `${output}${chunk}`.slice(-2_000);
      if (output.includes("Listening on ")) {
        cleanup();
        resolve();
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Playwright MCP exited with ${code}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

export function stopManagedChromium(manager) {
  return manager?.stop();
}
