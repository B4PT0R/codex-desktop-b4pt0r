import type { FileOpener } from "./protocol";
import { openExternalTarget } from "./externalTarget";
import { classifyMarkdownLink } from "./linkRouting";
import { invoke, isDesktopApp, openUrl } from "./nativeBridge";

export type MarkdownLinkContext = {
  cwd?: string;
  fileOpener: FileOpener;
};

export async function openMarkdownLink(
  href: string,
  context: MarkdownLinkContext,
) {
  const target = classifyMarkdownLink(href);
  if (target.kind === "anchor") return "anchor";
  if (target.kind === "web") {
    if (!isDesktopApp()) {
      window.open(target.url, "_blank", "noopener,noreferrer");
      return "browser";
    }
    return openExternalTarget(target.url);
  }
  if (target.kind === "mailto") {
    if (!isDesktopApp()) {
      window.location.href = target.url;
      return "browser";
    }
    await openUrl(target.url);
    return "system";
  }
  if (target.kind === "file") {
    if (!isDesktopApp()) throw new Error("Local files require the desktop app");
    await invoke("open_file_reference", {
      column: target.column,
      line: target.line,
      opener: context.fileOpener,
      path: target.path,
      workspace: context.cwd,
    });
    return "editor";
  }
  throw new Error("Unsupported link target");
}
