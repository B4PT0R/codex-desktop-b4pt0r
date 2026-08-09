import { invoke, isDesktopApp } from "./nativeBridge";

export async function createDiscussionWorkspace(title?: string) {
  if (isDesktopApp()) {
    return invoke<string>("create_discussion_workspace", { title });
  }
  const date = new Date().toISOString().slice(0, 10);
  return `/home/developer/Documents/Codex/${date}-discussion`;
}
