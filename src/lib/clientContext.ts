export type ClientVersions = {
  clientVersion?: string;
  codexVersion?: string;
};

export function codexDesktopContext(versions: ClientVersions = {}) {
  const versionContext = [
    versions.clientVersion?.trim()
      ? `Codex Desktop Linux client version: ${versions.clientVersion.trim()}.`
      : undefined,
    versions.codexVersion?.trim()
      ? `Codex CLI backend version: ${versions.codexVersion.trim()}.`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const repositoryUrl = __PROJECT_REPOSITORY__.replace(/\.git$/, "");
  return [
    "You are interacting with the user through Codex Desktop Linux, an independent graphical desktop client backed by the official Codex App Server, not through the interactive Codex CLI surface.",
    versionContext,
    `Codex Desktop Linux project repository: ${repositoryUrl}.`,
    "The user may send messages from the desktop UI or a paired Remote Control device. Tailor UI-facing guidance to Codex Desktop, and do not direct the user to CLI-only interface commands unless they explicitly ask for a terminal workflow.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function codexDesktopDeveloperInstructions(
  existing: string | null | undefined,
  versions?: ClientVersions,
) {
  return [
    existing?.trim(),
    `<codex_desktop_context>\n${codexDesktopContext(versions)}\n</codex_desktop_context>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
