import type { AppServerMessage } from "./codex";
import type { ThreadStatus } from "../types";
import { threadStatusFromValue } from "./threadLifecycle";

type QueueEntry<T> = {
  getTurnId?: (result: T) => string | undefined;
  reject: (error: unknown) => void;
  resolve: (result: T) => void;
  start: () => Promise<T>;
  manualRelease: boolean;
};

type CurrentStart = {
  manualRelease: boolean;
  turnId?: string;
};

type ThreadState = {
  active: boolean;
  current?: CurrentStart;
  queue: QueueEntry<unknown>[];
};

/**
 * Serializes turn-producing work per thread.
 *
 * App Server deliberately treats a second `turn/start` on an active regular
 * turn as steering. Scheduled work needs stricter semantics, so all starts
 * owned by this client reserve the thread until its terminal notification.
 */
export class ThreadTurnCoordinator {
  readonly #threads = new Map<string, ThreadState>();

  observeStatus(threadId: string, status: ThreadStatus | undefined) {
    if (!status) return;
    if (status === "active") {
      const state = this.#state(threadId);
      state.active = true;
      return;
    }
    if (status === "idle" || status === "systemError") {
      const state = this.#threads.get(threadId);
      if (!state) return;
      const wasActive = state.active;
      state.active = false;
      if (state.current && wasActive) {
        this.#completeOrHold(threadId, state);
      } else {
        this.#drain(threadId, state);
      }
    }
  }

  handleMessage(message: AppServerMessage) {
    const params = record(message.params);
    const threadId = stringValue(params?.threadId);
    if (!threadId) return false;

    if (message.method === "thread/status/changed") {
      const status = threadStatusFromValue(params?.status);
      if (!status) return false;
      this.observeStatus(threadId, status);
      return true;
    }

    if (message.method === "turn/started") {
      const state = this.#state(threadId);
      state.active = true;
      const turnId = stringValue(record(params?.turn)?.id);
      if (state.current && !state.current.turnId && turnId) {
        state.current.turnId = turnId;
      }
      return true;
    }
    const terminal =
      message.method === "turn/completed" ||
      (message.method === "error" && params?.willRetry !== true);
    if (terminal) {
      const state = this.#threads.get(threadId);
      if (!state) return false;
      const turnId =
        stringValue(record(params?.turn)?.id) ?? stringValue(params?.turnId);
      if (!state.current || !turnId || state.current.turnId === turnId) {
        state.active = false;
        this.#completeOrHold(threadId, state);
      }
      return true;
    }
    return false;
  }

  runWhenIdle<T>(
    threadId: string,
    start: () => Promise<T>,
    getTurnId?: (result: T) => string | undefined,
    options: { manualRelease?: boolean } = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const state = this.#state(threadId);
      state.queue.push({
        start,
        resolve,
        reject,
        getTurnId,
        manualRelease: options.manualRelease === true,
      } as QueueEntry<unknown>);
      this.#drain(threadId, state);
    });
  }

  queuedCount(threadId: string) {
    return this.#threads.get(threadId)?.queue.length ?? 0;
  }

  release(threadId: string, turnId?: string) {
    const state = this.#threads.get(threadId);
    if (
      !state?.current ||
      (turnId && state.current.turnId && state.current.turnId !== turnId)
    ) {
      return false;
    }
    state.active = false;
    this.#finishCurrent(threadId, state);
    return true;
  }

  #state(threadId: string) {
    let state = this.#threads.get(threadId);
    if (!state) {
      state = { active: false, queue: [] };
      this.#threads.set(threadId, state);
    }
    return state;
  }

  #drain(threadId: string, state: ThreadState) {
    if (state.active || state.current) return;
    const entry = state.queue.shift();
    if (!entry) {
      this.#deleteIfIdle(threadId, state);
      return;
    }
    const current: CurrentStart = {
      manualRelease: entry.manualRelease,
    };
    state.current = current;
    void entry
      .start()
      .then((result) => {
        if (state.current !== current) {
          entry.reject(new Error("Thread start reservation was superseded."));
          return;
        }
        const responseTurnId = entry.getTurnId?.(result);
        if (
          current.turnId &&
          responseTurnId &&
          current.turnId !== responseTurnId
        ) {
          this.#failStart(
            threadId,
            state,
            current,
            entry,
            new Error(
              "The thread became active before the reserved turn could start.",
            ),
          );
          return;
        }
        if (responseTurnId) current.turnId = responseTurnId;
        state.active = true;
        entry.resolve(result);
      })
      .catch((error) => {
        this.#failStart(threadId, state, current, entry, error);
      });
  }

  #finishCurrent(threadId: string, state: ThreadState) {
    state.current = undefined;
    this.#drain(threadId, state);
  }

  #completeOrHold(threadId: string, state: ThreadState) {
    if (state.current?.manualRelease) return;
    this.#finishCurrent(threadId, state);
  }

  #failStart(
    threadId: string,
    state: ThreadState,
    current: CurrentStart,
    entry: QueueEntry<unknown>,
    error: unknown,
  ) {
    if (state.current === current) state.current = undefined;
    entry.reject(error);
    this.#drain(threadId, state);
  }

  #deleteIfIdle(threadId: string, state: ThreadState) {
    if (!state.active && !state.current && state.queue.length === 0) {
      this.#threads.delete(threadId);
    }
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
