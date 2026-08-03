import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
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
const CODEX_RELEASE_API =
  "https://api.github.com/repos/openai/codex/releases/latest";
const MAX_PACKAGE_BYTES = 1_000_000_000;

export class AppUpdateManager {
  #architecture;
  #candidate;
  #clientVersion;
  #fetch;
  #execFile;
  #installing = false;
  #installPackage;
  #minimumCodexVersion;
  #packageFormat;
  #resolveExecutable;
  #tempRoot;

  constructor({
    architecture,
    clientVersion,
    execFileImpl = execFile,
    fetchImpl,
    installPackage = installDebianPackage,
    minimumCodexVersion,
    packageFormat = detectLinuxPackageFormat(),
    resolveExecutable = findCodexExecutable,
    tempRoot,
  }) {
    this.#architecture = architecture;
    this.#clientVersion = clientVersion;
    this.#execFile = execFileImpl;
    this.#fetch = fetchImpl;
    this.#installPackage = installPackage;
    this.#minimumCodexVersion = normalizeVersion(minimumCodexVersion);
    this.#packageFormat = packageFormat;
    this.#resolveExecutable = resolveExecutable;
    this.#tempRoot = tempRoot;
  }

  versions() {
    return readAppVersions(this.#clientVersion, this.#minimumCodexVersion, {
      execFileImpl: this.#execFile,
      resolveExecutable: this.#resolveExecutable,
    });
  }

  async updateCodex(confirmed) {
    if (confirmed !== true) {
      throw new Error("Codex update requires explicit confirmation");
    }
    if (this.#installing) {
      throw new Error("Another update is already in progress");
    }
    this.#installing = true;
    try {
      const executable = await this.#resolveExecutable();
      await executeFile(
        executable,
        ["update"],
        this.#execFile,
        10 * 60_000,
        environmentForCodex(executable),
      );
      return await this.versions();
    } finally {
      this.#installing = false;
    }
  }

  async check() {
    this.#candidate = undefined;
    const [candidateResult, versions] = await Promise.all([
      Promise.resolve().then(() =>
        checkLatestRelease({
          architecture: this.#architecture,
          currentVersion: this.#clientVersion,
          fetchImpl: this.#fetch,
          packageFormat: this.#packageFormat,
        }),
      ).then(
        (value) => ({ value }),
        (error) => ({ error: errorMessage(error) }),
      ),
      this.versions(),
    ]);
    const candidate = candidateResult.value;
    if (candidate?.updateAvailable && candidate.asset) {
      this.#candidate = candidate;
    }
    let codexUpdate;
    try {
      codexUpdate = await checkLatestCodexRelease({
        currentVersion: versions.codexVersion,
        fetchImpl: this.#fetch,
        minimumVersion: versions.minimumCodexVersion,
      });
    } catch (error) {
      codexUpdate = {
        compatible: versions.codexCompatible,
        currentVersion: versions.codexVersion,
        error: errorMessage(error),
        minimumVersion: versions.minimumCodexVersion,
      };
    }
    return {
      ...(candidate
        ? publicUpdateStatus(candidate)
        : {
            assetAvailable: false,
            currentVersion: normalizeVersion(this.#clientVersion),
            installMode: "unavailable",
            latestVersion: normalizeVersion(this.#clientVersion),
            packageFormat: this.#packageFormat,
            releaseUrl: "",
            updateAvailable: false,
          }),
      ...(candidateResult.error ? { clientError: candidateResult.error } : {}),
      codexUpdate,
    };
  }

  async install(confirmed) {
    if (confirmed !== true) {
      throw new Error("Update installation requires explicit confirmation");
    }
    if (!this.#candidate?.asset) {
      throw new Error("Check for an available update before installing");
    }
    if (this.#candidate.installMode !== "automatic") {
      throw new Error("This package format requires a manual update");
    }
    if (this.#installing) {
      throw new Error("An update download is already in progress");
    }
    this.#installing = true;
    let directory;
    try {
      directory = await mkdtemp(
        path.join(this.#tempRoot, "codex-desktop-update-"),
      );
      const packagePath = await downloadReleaseAsset(
        this.#candidate.asset,
        directory,
        this.#fetch,
      );
      await this.#installPackage(packagePath, {
        architecture: debianArchitecture(this.#architecture),
        version: this.#candidate.latestVersion,
      });
      this.#candidate = undefined;
      return { installed: true };
    } finally {
      if (directory) {
        await rm(directory, { force: true, recursive: true }).catch(
          () => undefined,
        );
      }
      this.#installing = false;
    }
  }
}

export async function installDebianPackage(
  packagePath,
  { architecture, version },
  { execFileImpl = execFile } = {},
) {
  if (!path.isAbsolute(packagePath) || path.extname(packagePath) !== ".deb") {
    throw new Error("Update package path must be an absolute .deb file");
  }

  const { stdout } = await executeFile(
    "/usr/bin/dpkg-deb",
    ["--field", packagePath, "Package", "Version", "Architecture"],
    execFileImpl,
  );
  const metadata = debianControlFields(stdout);
  if (
    metadata.Package !== "codex-desktop-linux" ||
    metadata.Version !== version ||
    metadata.Architecture !== architecture
  ) {
    throw new Error(
      "Downloaded package metadata does not match the requested update",
    );
  }

  try {
    await executeFile(
      "/usr/bin/pkexec",
      [
        "/usr/bin/apt-get",
        "--yes",
        "--no-remove",
        "--only-upgrade",
        "install",
        packagePath,
      ],
      execFileImpl,
      10 * 60_000,
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === 126 || error.code === 127) {
        throw new Error("Update authorization was cancelled or denied");
      }
    }
    const detail = commandErrorDetail(error);
    throw new Error(
      detail
        ? `Debian package upgrade failed: ${detail}`
        : "Debian package upgrade failed",
    );
  }
}

export async function readAppVersions(
  clientVersion,
  minimumCodexVersion,
  {
    execFileImpl = execFile,
    resolveExecutable = findCodexExecutable,
  } = {},
) {
  const minimumVersion = normalizeVersion(minimumCodexVersion);
  const result = {
    clientVersion: normalizeVersion(clientVersion),
    minimumCodexVersion: minimumVersion,
  };
  try {
    const executable = await resolveExecutable();
    result.codexVersion = await executableVersion(executable, execFileImpl);
    result.codexCompatible =
      compareVersions(codexSemanticVersion(result.codexVersion), minimumVersion) >= 0;
  } catch (error) {
    result.codexError = errorMessage(error);
  }
  return result;
}

export function codexSemanticVersion(value) {
  const match = /(?:^|\s)v?(\d+\.\d+\.\d+)(?:\s|$)/.exec(String(value ?? ""));
  if (!match) throw new Error("Codex returned an invalid version");
  return normalizeVersion(match[1]);
}

export async function checkLatestRelease({
  architecture = process.arch,
  currentVersion,
  fetchImpl = globalThis.fetch,
  packageFormat = detectLinuxPackageFormat(),
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
    packageFormat,
  );
}

export async function checkLatestCodexRelease({
  currentVersion,
  fetchImpl = globalThis.fetch,
  minimumVersion,
}) {
  const normalizedMinimum = normalizeVersion(minimumVersion);
  if (!currentVersion) {
    throw new Error("The installed Codex version is unavailable");
  }
  const normalizedCurrent = codexSemanticVersion(currentVersion);
  const response = await fetchImpl(CODEX_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "codex-desktop-linux-cli-updater",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Codex release check returned HTTP ${response.status}`);
  }
  const release = objectValue(await response.json());
  const tagMatch = /^rust-v(\d+\.\d+\.\d+)$/.exec(String(release.tag_name ?? ""));
  if (!tagMatch) throw new Error("GitHub returned an invalid Codex release");
  const latestVersion = normalizeVersion(tagMatch[1]);
  const releaseUrl = new URL(String(release.html_url ?? ""));
  if (
    releaseUrl.protocol !== "https:" ||
    releaseUrl.hostname !== "github.com" ||
    releaseUrl.pathname !== `/openai/codex/releases/tag/rust-v${latestVersion}`
  ) {
    throw new Error("GitHub returned an invalid Codex release URL");
  }
  return {
    compatible: compareVersions(normalizedCurrent, normalizedMinimum) >= 0,
    currentVersion: normalizedCurrent,
    latestVersion,
    minimumVersion: normalizedMinimum,
    updateAvailable: compareVersions(latestVersion, normalizedCurrent) > 0,
  };
}

export function releaseCandidate(
  input,
  currentVersion,
  architecture,
  packageFormat = "deb",
) {
  const release = objectValue(input);
  const latestVersion = normalizeVersion(release.tag_name);
  const releaseUrl = validatedReleaseUrl(release.html_url, latestVersion);
  const updateAvailable =
    compareVersions(latestVersion, currentVersion) > 0;
  const expectedName = releaseAssetName(
    latestVersion,
    architecture,
    packageFormat,
  );
  const asset = expectedName
    ? Array.isArray(release.assets)
      ? release.assets
          .map(objectValue)
          .find((candidate) => candidate.name === expectedName)
      : undefined
    : undefined;

  return {
    currentVersion,
    latestVersion,
    installMode:
      updateAvailable && asset
        ? packageFormat === "deb" ? "automatic" : "manual"
        : updateAvailable && packageFormat === "unknown"
          ? "manual"
          : "unavailable",
    packageFormat,
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
    installMode: candidate.installMode,
    latestVersion: candidate.latestVersion,
    packageFormat: candidate.packageFormat,
    releaseUrl: candidate.releaseUrl,
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
    throw new Error("GitHub release contains an invalid Linux asset");
  }
  const digest = typeof asset.digest === "string" ? asset.digest : "";
  const digestMatch = /^sha256:([a-f0-9]{64})$/i.exec(digest);
  if (!digestMatch) {
    throw new Error("GitHub release Linux asset has no SHA-256 digest");
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
    throw new Error("GitHub release contains an invalid Linux asset URL");
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

function portableArchitecture(architecture) {
  if (architecture === "x64") return "x86_64";
  if (architecture === "arm64") return "arm64";
  throw new Error(`Unsupported update architecture: ${architecture}`);
}

function rpmArchitecture(architecture) {
  if (architecture === "x64") return "x86_64";
  if (architecture === "arm64") return "aarch64";
  throw new Error(`Unsupported update architecture: ${architecture}`);
}

function releaseAssetName(version, architecture, packageFormat) {
  if (packageFormat === "deb") {
    return `codex-desktop-linux_${version}_${debianArchitecture(architecture)}.deb`;
  }
  if (packageFormat === "rpm") {
    return `codex-desktop-linux_${version}_${rpmArchitecture(architecture)}.rpm`;
  }
  if (packageFormat === "appimage") {
    return `codex-desktop-linux_${version}_${portableArchitecture(architecture)}.AppImage`;
  }
  return undefined;
}

export function detectLinuxPackageFormat({
  env = process.env,
  platform = process.platform,
  readFile = readFileSync,
} = {}) {
  if (platform !== "linux") return "unknown";
  if (typeof env.APPIMAGE === "string" && env.APPIMAGE.trim()) {
    return "appimage";
  }
  try {
    const release = String(readFile("/etc/os-release", "utf8"));
    const family = release
      .split(/\r?\n/)
      .filter((line) => /^(ID|ID_LIKE)=/.test(line))
      .join(" ")
      .toLowerCase();
    if (/\b(debian|ubuntu)\b/.test(family)) return "deb";
    if (/\b(fedora|rhel|centos|suse|opensuse)\b/.test(family)) return "rpm";
  } catch {
    // Unknown distributions remain on the non-installing release path.
  }
  return "unknown";
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

function executeFile(
  executable,
  args,
  execFileImpl,
  timeout = 30_000,
  env,
) {
  return new Promise((resolve, reject) => {
    execFileImpl(
      executable,
      args,
      {
        encoding: "utf8",
        ...(env ? { env } : {}),
        maxBuffer: 1024 * 1024,
        timeout,
        windowsHide: true,
      },
      (error, stdout = "", stderr = "") => {
        if (error) {
          const commandError =
            error instanceof Error ? error : new Error(String(error));
          commandError.stderr = stderr;
          reject(commandError);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function debianControlFields(output) {
  return Object.fromEntries(
    String(output)
      .split(/\r?\n/)
      .map((line) => /^([^:]+):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function commandErrorDetail(error) {
  if (!error || typeof error !== "object") return "";
  const stderr = "stderr" in error ? String(error.stderr ?? "") : "";
  return stderr.replace(/\s+/g, " ").trim().slice(0, 500);
}
