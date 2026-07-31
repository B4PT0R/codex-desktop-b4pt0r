import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AppUpdateManager,
  checkLatestRelease,
  compareVersions,
  downloadReleaseAsset,
  installDebianPackage,
  publicUpdateStatus,
  readAppVersions,
  releaseCandidate,
} from "./app-update.mjs";

const packageBytes = Buffer.from("valid deb fixture");
const packageDigest = createHash("sha256")
  .update(packageBytes)
  .digest("hex");

function release(version = "0.4.0") {
  const name = `codex-desktop-linux_${version}_amd64.deb`;
  return {
    tag_name: `v${version}`,
    html_url:
      `https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/tag/v${version}`,
    assets: [
      {
        name,
        state: "uploaded",
        size: packageBytes.length,
        digest: `sha256:${packageDigest}`,
        browser_download_url:
          `https://github.com/B4PT0R/codex-desktop-b4pt0r/releases/download/v${version}/${name}`,
      },
    ],
  };
}

test("compares stable semantic versions", () => {
  assert.equal(compareVersions("0.3.12", "0.3.12"), 0);
  assert.equal(compareVersions("0.4.0", "0.3.12"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.throws(() => compareVersions("latest", "0.3.12"));
});

test("reads the client and Codex versions without exposing the executable", async () => {
  const result = await readAppVersions("0.3.12", {
    resolveExecutable: async () => "/opt/codex/bin/codex",
    execFileImpl: (executable, args, options, callback) => {
      assert.equal(executable, "/opt/codex/bin/codex");
      assert.deepEqual(args, ["--version"]);
      assert.equal(options.timeout, 5_000);
      callback(null, "codex-cli 0.145.0\n");
    },
  });

  assert.deepEqual(result, {
    clientVersion: "0.3.12",
    codexVersion: "codex-cli 0.145.0",
  });
});

test("selects only the matching Debian asset and exposes no download URL", () => {
  const candidate = releaseCandidate(release(), "0.3.12", "x64");

  assert.equal(candidate.updateAvailable, true);
  assert.equal(candidate.asset.name, "codex-desktop-linux_0.4.0_amd64.deb");
  assert.deepEqual(publicUpdateStatus(candidate), {
    assetAvailable: true,
    currentVersion: "0.3.12",
    latestVersion: "0.4.0",
    updateAvailable: true,
  });
});

test("does not expose an installable asset when the client is current", () => {
  const candidate = releaseCandidate(release("0.3.12"), "0.3.12", "x64");

  assert.equal(candidate.updateAvailable, false);
  assert.equal(candidate.asset, undefined);
  assert.equal(publicUpdateStatus(candidate).assetAvailable, false);
});

test("checks the public latest-release endpoint with bounded headers", async () => {
  const candidate = await checkLatestRelease({
    architecture: "x64",
    currentVersion: "0.3.12",
    fetchImpl: async (url, options) => {
      assert.equal(
        url,
        "https://api.github.com/repos/B4PT0R/codex-desktop-b4pt0r/releases/latest",
      );
      assert.equal(options.headers.Accept, "application/vnd.github+json");
      return new Response(JSON.stringify(release()), {
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(candidate.latestVersion, "0.4.0");
});

test("rejects an asset without a trusted digest or GitHub URL", () => {
  const invalidDigest = release();
  invalidDigest.assets[0].digest = null;
  assert.throws(
    () => releaseCandidate(invalidDigest, "0.3.12", "x64"),
    /SHA-256/,
  );

  const invalidUrl = release();
  invalidUrl.assets[0].browser_download_url =
    "https://example.com/codex-desktop-linux_0.4.0_amd64.deb";
  assert.throws(
    () => releaseCandidate(invalidUrl, "0.3.12", "x64"),
    /asset URL/,
  );
});

test("downloads a package only when size and SHA-256 match", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-update-"));
  const asset = releaseCandidate(release(), "0.3.12", "x64").asset;
  const target = await downloadReleaseAsset(
    asset,
    directory,
    async () => new Response(packageBytes),
  );

  assert.equal(path.basename(target), asset.name);
  assert.deepEqual(await readFile(target), packageBytes);
});

test("removes a partial package when verification fails", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-update-"));
  const asset = releaseCandidate(release(), "0.3.12", "x64").asset;

  await assert.rejects(
    downloadReleaseAsset(
      asset,
      directory,
      async () => new Response(Buffer.alloc(packageBytes.length, 0)),
    ),
    /checksum/,
  );
  await assert.rejects(readFile(path.join(directory, `${asset.name}.part`)));
});

test("requires a fresh checked candidate and explicit install confirmation", async () => {
  const installed = [];
  const manager = new AppUpdateManager({
    architecture: "x64",
    clientVersion: "0.3.12",
    fetchImpl: async (url) =>
      String(url).includes("/releases/latest")
        ? new Response(JSON.stringify(release()))
        : new Response(packageBytes),
    installPackage: async (target, expected) => {
      installed.push({ expected, target });
    },
    tempRoot: os.tmpdir(),
  });

  await assert.rejects(manager.install(true), /Check for an available update/);
  assert.equal((await manager.check()).updateAvailable, true);
  await assert.rejects(manager.install(false), /explicit confirmation/);
  assert.deepEqual(await manager.install(true), { installed: true });
  assert.equal(installed.length, 1);
  assert.match(
    installed[0].target,
    /codex-desktop-linux_0\.4\.0_amd64\.deb$/,
  );
  assert.deepEqual(installed[0].expected, {
    architecture: "amd64",
    version: "0.4.0",
  });
  await assert.rejects(manager.install(true), /Check for an available update/);
});

test("installs a matching Debian package as an explicit apt upgrade", async () => {
  const calls = [];
  const packagePath = "/tmp/codex-desktop-linux_0.4.0_amd64.deb";
  await installDebianPackage(
    packagePath,
    { architecture: "amd64", version: "0.4.0" },
    {
      execFileImpl: (executable, args, options, callback) => {
        calls.push({ args, executable, options });
        if (executable === "/usr/bin/dpkg-deb") {
          callback(
            null,
            "Package: codex-desktop-linux\nVersion: 0.4.0\nArchitecture: amd64\n",
            "",
          );
          return;
        }
        callback(null, "", "");
      },
    },
  );

  assert.deepEqual(calls.map(({ executable }) => executable), [
    "/usr/bin/dpkg-deb",
    "/usr/bin/pkexec",
  ]);
  assert.deepEqual(calls[1].args, [
    "/usr/bin/apt-get",
    "--yes",
    "--no-remove",
    "--only-upgrade",
    "install",
    packagePath,
  ]);
  assert.equal(calls[1].options.timeout, 10 * 60_000);
});

test("rejects mismatched package metadata before requesting privileges", async () => {
  const executables = [];
  await assert.rejects(
    installDebianPackage(
      "/tmp/codex-desktop-linux_0.4.0_amd64.deb",
      { architecture: "amd64", version: "0.4.0" },
      {
        execFileImpl: (executable, _args, _options, callback) => {
          executables.push(executable);
          callback(
            null,
            "Package: another-package\nVersion: 0.4.0\nArchitecture: amd64\n",
            "",
          );
        },
      },
    ),
    /metadata does not match/,
  );
  assert.deepEqual(executables, ["/usr/bin/dpkg-deb"]);
});

test("reports a cancelled update authorization clearly", async () => {
  await assert.rejects(
    installDebianPackage(
      "/tmp/codex-desktop-linux_0.4.0_amd64.deb",
      { architecture: "amd64", version: "0.4.0" },
      {
        execFileImpl: (executable, _args, _options, callback) => {
          if (executable === "/usr/bin/dpkg-deb") {
            callback(
              null,
              "Package: codex-desktop-linux\nVersion: 0.4.0\nArchitecture: amd64\n",
              "",
            );
            return;
          }
          const error = new Error("Command failed");
          error.code = 126;
          callback(error, "", "Dismissed");
        },
      },
    ),
    /authorization was cancelled or denied/,
  );
});
