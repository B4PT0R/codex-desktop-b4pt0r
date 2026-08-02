import { lstat, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";

const AUTOSTART_FILE = "codex-desktop.desktop";
const LEGACY_AUTOSTART_FILE = "Codex Desktop.desktop";
const OWNERSHIP_MARKER = "X-Codex-Desktop-Autostart=true";

export function autostartPath(home, env = process.env) {
  const configHome =
    typeof env.XDG_CONFIG_HOME === "string" && env.XDG_CONFIG_HOME.trim()
      ? path.resolve(env.XDG_CONFIG_HOME)
      : path.join(home, ".config");
  return path.join(configHome, "autostart", AUTOSTART_FILE);
}

export async function readLaunchAtLogin(file, executable) {
  try {
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return false;
    const content = await readFile(file, "utf8");
    return (
      content.includes(OWNERSHIP_MARKER) &&
      content.includes(`Exec=${desktopExec(executable)} --hidden`) &&
      !/^Hidden\s*=\s*true\s*$/im.test(content)
    );
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function setLaunchAtLogin(file, executable, enabled) {
  validateExecutable(executable);
  if (typeof enabled !== "boolean") {
    throw new Error("Invalid launch-at-login state");
  }
  if (enabled) {
    await writeFileAtomically(file, desktopEntry(executable), {
      createDirectory: true,
      mode: 0o600,
    });
  } else {
    await removeIfPresent(file);
  }

  const legacyFile = path.join(path.dirname(file), LEGACY_AUTOSTART_FILE);
  if (legacyFile !== file) await removeIfPresent(legacyFile);
  return readLaunchAtLogin(file, executable);
}

function desktopEntry(executable) {
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=Codex Desktop
Comment=Launch Codex Desktop at login
Exec=${desktopExec(executable)} --hidden
Terminal=false
StartupNotify=false
${OWNERSHIP_MARKER}
`;
}

function desktopExec(executable) {
  validateExecutable(executable);
  return `"${executable.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("`", "\\`").replaceAll("$", "\\$")}"`;
}

function validateExecutable(executable) {
  if (
    typeof executable !== "string" ||
    !path.isAbsolute(executable) ||
    /[\r\n\0]/.test(executable)
  ) {
    throw new Error("Invalid Codex Desktop executable path");
  }
}

async function removeIfPresent(file) {
  try {
    await unlink(file);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
