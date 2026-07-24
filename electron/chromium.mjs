import { spawn, spawnSync } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUPPORTED_MEDIA = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".html",
  ".htm", ".txt", ".mp3", ".wav", ".ogg", ".mp4", ".webm",
]);
let browser;
let installer;
let artifactSequence = 0;

async function executable(candidate) {
  try {
    await access(candidate, 1);
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

export async function discoverChromium(environment = process.env) {
  const candidates = [
    environment.CODEX_CHROMIUM_EXECUTABLE,
    ...["chromium", "chromium-browser"].flatMap((name) =>
      (environment.PATH ?? "")
        .split(path.delimiter)
        .filter(Boolean)
        .map((directory) => path.join(directory, name)),
    ),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await executable(candidate)) return candidate;
  }
}

export async function chromiumStatus(environment = process.env) {
  const executablePath = await discoverChromium(environment);
  const plan = await installPlan();
  const version = executablePath
    ? spawnSync(executablePath, ["--version"], { encoding: "utf8" })
        .stdout?.trim()
        .slice(0, 200)
    : undefined;
  return {
    available: Boolean(executablePath),
    ...(executablePath ? { executable: executablePath, version } : {}),
    installing: Boolean(installer),
    installSupported: Boolean(plan),
    ...(plan ? { installPackage: plan.package } : {}),
  };
}

export async function openChromiumTarget(target, home) {
  const executablePath = await discoverChromium();
  if (!executablePath) throw new Error("Chromium is not installed");
  const validated = await validateTarget(target);
  const profile = path.join(home, ".codex", "chromium-profile");
  await privateDirectory(profile);
  const mode = browser && browser.exitCode == null ? "--new-tab" : "--new-window";
  browser = spawn(
    executablePath,
    [
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      mode,
      validated,
    ],
    { detached: false, stdio: "ignore" },
  );
  browser.once("error", () => {
    browser = undefined;
  });
}

export async function openChromiumImage(dataUrl, home) {
  if (
    typeof dataUrl !== "string" ||
    dataUrl.length > 20_000_000 ||
    !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
      dataUrl,
    )
  ) {
    throw new Error("Generated image data is invalid");
  }
  const directory = path.join(home, ".codex", "chromium-artifacts");
  await privateDirectory(directory);
  const file = path.join(
    directory,
    `generated-${process.pid}-${artifactSequence++}.html`,
  );
  const escaped = dataUrl.replaceAll("'", "&#39;");
  await writeFile(
    file,
    `<!doctype html><meta charset=utf-8><meta http-equiv=Content-Security-Policy content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html,body{height:100%;margin:0;background:#181817}body{display:grid;place-items:center}img{max-width:100%;max-height:100%;object-fit:contain}</style><img alt="Codex generated image" src="${escaped}">`,
    { mode: 0o600, flag: "wx" },
  );
  await pruneArtifacts(directory);
  return openChromiumTarget(file, home);
}

export async function installChromium() {
  if (await discoverChromium()) return chromiumStatus();
  if (installer) throw new Error("Chromium installation is already running");
  const plan = await installPlan();
  if (!plan) {
    throw new Error(
      "Automatic Chromium installation is not supported on this distribution",
    );
  }
  await new Promise((resolve, reject) => {
    installer = spawn("pkexec", [plan.program, ...plan.args], {
      stdio: "ignore",
    });
    installer.once("error", reject);
    installer.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Chromium installer exited ${code}`)),
    );
  }).finally(() => {
    installer = undefined;
  });
  return chromiumStatus();
}

export function cancelChromiumInstall() {
  if (!installer) return false;
  installer.kill();
  installer = undefined;
  return true;
}

async function validateTarget(target) {
  if (
    typeof target !== "string" ||
    target.length > 32_768 ||
    /[\0\r\n]/.test(target)
  ) {
    throw new Error("Invalid Chromium target");
  }
  if (/^https?:\/\//.test(target)) return target;
  if (!path.isAbsolute(target) || !SUPPORTED_MEDIA.has(path.extname(target).toLowerCase())) {
    throw new Error("Chromium target must be an HTTP(S) URL or supported absolute path");
  }
  if (!(await stat(target)).isFile()) throw new Error("Media target is not a file");
  return pathToFileURL(target).toString();
}

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

async function pruneArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map(async (entry) => ({
        path: path.join(directory, entry.name),
        modified: (await stat(path.join(directory, entry.name))).mtimeMs,
      })),
  );
  files.sort((a, b) => b.modified - a.modified);
  const { unlink } = await import("node:fs/promises");
  await Promise.all(files.slice(20).map((file) => unlink(file.path).catch(() => {})));
}

async function installPlan() {
  let release;
  try {
    release = await readFile("/etc/os-release", "utf8");
  } catch {
    return undefined;
  }
  const id = release.match(/^ID=["']?([^"'\n]+)["']?$/m)?.[1];
  const plans = {
    ubuntu: { program: "apt-get", args: ["install", "-y", "chromium-browser"], package: "chromium-browser" },
    debian: { program: "apt-get", args: ["install", "-y", "chromium"], package: "chromium" },
    fedora: { program: "dnf", args: ["install", "-y", "chromium"], package: "chromium" },
    arch: { program: "pacman", args: ["-S", "--noconfirm", "chromium"], package: "chromium" },
    manjaro: { program: "pacman", args: ["-S", "--noconfirm", "chromium"], package: "chromium" },
  };
  return plans[id];
}

export function stopManagedChromium() {
  browser?.kill();
  browser = undefined;
  installer?.kill();
  installer = undefined;
}
