import type { AgentActivity } from "./activity";
import type { ThreadResumeRunState } from "./useThreadHistory";

type ViewStateField = "activity" | "busy" | "turn";

export type ThreadViewStatePatch = {
  activity?: AgentActivity;
  busy?: boolean;
  turnId?: string;
};

type VersionSnapshot = Record<ViewStateField, number> & {
  threadId: string;
};

/**
 * Prevents a thread/resume snapshot from overwriting newer notifications that
 * arrived while that snapshot was being loaded.
 */
export class ThreadViewStateGuard {
  #versions: Record<ViewStateField, number> = {
    activity: 0,
    busy: 0,
    turn: 0,
  };
  #resume?: VersionSnapshot;

  beginResume(threadId: string) {
    this.reset();
    this.#resume = { ...this.#versions, threadId };
  }

  failResume(threadId: string) {
    if (this.#resume?.threadId === threadId) this.#resume = undefined;
  }

  observe(...fields: ViewStateField[]) {
    for (const field of fields) this.#versions[field] += 1;
  }

  reconcileResume(
    threadId: string,
    runState: ThreadResumeRunState,
  ): ThreadViewStatePatch {
    const baseline = this.#resume;
    if (!baseline || baseline.threadId !== threadId) return {};
    this.#resume = undefined;
    return {
      ...(this.#versions.activity === baseline.activity
        ? { activity: runState.activity }
        : {}),
      ...(this.#versions.busy === baseline.busy
        ? { busy: runState.busy }
        : {}),
      ...(this.#versions.turn === baseline.turn
        ? { turnId: runState.turnId }
        : {}),
    };
  }

  reset() {
    this.#resume = undefined;
    this.observe("activity", "busy", "turn");
  }
}
