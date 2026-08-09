import type { AppServerThread } from "./appServerTypes";

// Stable server-owned section ID defined by Codex for pinned threads.
export const PINNED_THREAD_SECTION_ID =
  "01984de2-8f74-7c91-a3b2-5c5e937cf318";

export function isPinnedThread(thread: AppServerThread) {
  return thread.section?.id === PINNED_THREAD_SECTION_ID;
}
