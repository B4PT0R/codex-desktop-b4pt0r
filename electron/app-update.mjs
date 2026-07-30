import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  environmentForCodex,
  findCodexExecutable,
} from "./app-server.mjs";

const REPOSITORY = "B4PT0R/codex-desktop-b4pt0r";
const RELEASE_API =
  `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const MAX_PACKAGE_BYTES = 1_000_000_000;

export class AppUpdateManager {
  #architecture;
  #candidate;
  #clientVersion;
  #fetch;
  #installing = false;
  #openPath;
  #tempRoot;

  constructor({
    architecture,
    clientVersion,
    fetchImpl,
    openPath,
    tempRoot,
  }) {
    this.#architecture = architecture;
    this.#clientVersion = clientVersion;
    this.#fetch = fetchImpl;
    this.#openPath = openPath;
    this.#tempRoot = tempRoot;
  }

  versions() {
    return readAppVersions(this.#clientVersion);
  }

  async check() {
    this.#candidate = undefined;
    const candidate = await checkLatestRelease({
      architecture: this.#architecture,
      currentVersion: this.#clientVersion,
      fetchImpl: this.#fetch,
    });
    if (candidate.updateAvailable && candidate.asset) {
      this.#candidate = candidate;
    }
    return publicUpdateStatus(candidate);
  }

  async install(confirmed) {
    if (confirmed !== true) {
      throw new Error("Update installation requires explicit confirmation");
    }
    if (!this.#candidate?.asset) {
      throw new Error("Check for an available update before installing");
    }
    if (this.#installing) {
      throw new Error("An update download is already in progress");
    }
    this.#installing = true;
    try {
      const directory = await mkdtemp(
        path.join(this.#tempRoot, "codex-desktop-update-"),
      );
      const packagePath = await downloadReleaseAsset(
        this.#candidate.asset,
        directory,
        this.#fetch,
      );
      const openError = await this.#openPath(packagePath);
      if (openError) {
        throw new Error(
          `The update was downloaded to ${packagePath}, but the system installer could not open it: ${openError}`,
        );
      }
      this.#candidate = undefined;
      return { opened: true };
    } finally {
      this.#installing = false;
    }
  }
}

export async function readAppVersions(
  clientVersion,
  {
    execFileImpl = execFile,
    resolveExecutable = findCodexExecutable,
  } = {},
) {
  const result = { clientVersion: normalizeVersion(clientVersion) };
  try {
    const executable = await resolveExecutable();
    result.codexVersion = await executableVersion(executable, execFileImpl);
  } catch (error) {
    result.codexError = errorMessage(error);
  }
  return result;
}

export async function checkLatestRelease({
  architecture = process.arch,
  currentVersion,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `codex-desktop-linux/${normalizeVersion(currentVersion)}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub release check returned HTTP ${response.status}`);
  }
  return releaseCandidate(
    await response.json(),
    normalizeVersion(currentVersion),
    architecture,
  );
}

export function releaseCandidate(input, currentVersion, architecture) {
  const release = objectValue(input);
  const latestVersion = normalizeVersion(release.tag_name);
  const releaseUrl = validatedReleaseUrl(release.html_url, latestVersion);
  const updateAvailable =
    compareVersions(latestVersion, currentVersion) > 0;
  const expectedName =
    `codex-desktop-linux_${latestVersion}_${debianArchitecture(architecture)}.deb`;
  const asset = Array.isArray(release.assets)
    ? release.assets
        .map(objectValue)
        .find((candidate) => candidate.name === expectedName)
    : undefined;

  return {
    currentVersion,
    latestVersion,
    releaseUrl,
    updateAvailable,
    asset:
      updateAvailable && asset
        ? validatedAsset(asset, expectedName, latestVersion)
        : undefined,
  };
}

export function publicUpdateStatus(candidate) {
  return {
    assetAvailable: Boolean(candidate.asset),
    currentVersion: candidate.currentVersion,
    latestVersion: candidate.latestVersion,
    updateAvailable: candidate.updateAvailable,
  };
}

export async function downloadReleaseAsset(
  asset,
  directory,
  fetchImpl = globalThis.fetch,
) {
  const target = path.join(directory, asset.name);
  const partial = `${target}.part`;
  const response = await fetchImpl(asset.url, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "codex-desktop-linux-updater",
    },
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Update download returned HTTP ${response.status}`);
  }

  const hash = createHash("sha256");
  let received = 0;
  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > asset.size) {
        callback(new Error("Downloaded package exceeds the advertised size"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      verifier,
      createWriteStream(partial, { flags: "wx", mode: 0o600 }),
    );
    if (received !== asset.size) {
      throw new Error("Downloaded package size does not match the release");
    }
    if (hash.digest("hex") !== asset.sha256) {
      throw new Error("Downloaded package checksum does not match the release");
    }
    await rename(partial, target);
    return target;
  } catch (error) {
    await rm(partial, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function executableVersion(executable, execFileImpl) {
  return new Promise((resolve, reject) => {
    execFileImpl(
      executable,
      ["--version"],
      {
        encoding: "utf8",
        env: environmentForCodex(executable),
        maxBuffer: 64 * 1024,
        timeout: 5_000,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        const version = String(stdout).trim();
        if (!version || version.length > 128) {
          reject(new Error("Codex returned an invalid version"));
          return;
        }
        resolve(version);
      },
    );
  });
}

function validatedAsset(asset, expectedName, version) {
  const size = asset.size;
  if (
    asset.state !== "uploaded" ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_PACKAGE_BYTES
  ) {
    throw new Error("GitHub release contains an invalid Debian asset");
  }
  const digest = typeof asset.digest === "string" ? asset.digest : "";
  const digestMatch = /^sha256:([a-f0-9]{64})$/i.exec(digest);
  if (!digestMatch) {
    throw new Error("GitHub release Debian asset has no SHA-256 digest");
  }
  const url = new URL(String(asset.browser_download_url ?? ""));
  const expectedPrefix =
    `/${REPOSITORY}/releases/download/v${version}/`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    !url.pathname.startsWith(expectedPrefix) ||
    path.posix.basename(url.pathname) !== expectedName
  ) {
    throw new Error("GitHub release contains an invalid Debian asset URL");
  }
  return {
    name: expectedName,
    sha256: digestMatch[1].toLowerCase(),
    size,
    url: url.toString(),
  };
}

function validatedReleaseUrl(value, version) {
  const url = new URL(String(value ?? ""));
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.pathname !== `/${REPOSITORY}/releases/tag/v${version}`
  ) {
    throw new Error("GitHub returned an invalid release URL");
  }
  return url.toString();
}

function debianArchitecture(architecture) {
  if (architecture === "x64") return "amd64";
  if (architecture === "arm64") return "arm64";
  throw new Error(`Unsupported update architecture: ${architecture}`);
}

function normalizeVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? "").trim());
  if (!match) throw new Error(`Invalid application version: ${value}`);
  return match.slice(1).map(Number).join(".");
}

function versionParts(value) {
  return normalizeVersion(value).split(".").map(Number);
}

function objectValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GitHub returned an invalid release");
  }
  return value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
