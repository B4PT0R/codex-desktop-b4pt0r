import type { ThreadRuntimeSettings } from "./threadRuntimeSettings";

type SecuritySettings = Required<
  Pick<ThreadRuntimeSettings, "permission" | "approvalPolicy">
>;

type PendingConfirmation = {
  expected: SecuritySettings;
  confirmed: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Confirms effective App Server settings after an update.
 *
 * `thread/settings/update` only acknowledges that the update was queued, and
 * no notification is emitted when it is a no-op. A dependent turn must not
 * start until either `thread/settings/updated` or an authoritative read
 * confirms the effective values.
 */
export class ThreadSettingsConfirmation {
  readonly #pending = new Map<string, PendingConfirmation>();

  async updateAndWait(
    threadId: string,
    expected: SecuritySettings,
    update: () => Promise<unknown>,
    verify?: () => Promise<ThreadRuntimeSettings>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    if (this.#pending.has(threadId)) {
      throw new Error("A thread settings update is already awaiting confirmation.");
    }
    let pending: PendingConfirmation;
    const confirmed = new Promise<void>((resolve, reject) => {
      pending = {
        expected,
        confirmed: false,
        resolve,
        reject,
        timeout: setTimeout(() => {
          if (this.#pending.get(threadId) !== pending) return;
          this.#pending.delete(threadId);
          reject(new Error("Timed out while confirming restored thread security."));
        }, timeoutMs),
      };
      this.#pending.set(threadId, pending);
    });
    try {
      await update();
      // App Server deliberately omits `thread/settings/updated` when an update
      // is a no-op. Re-read the effective state so that an already-restored
      // thread does not become a false timeout.
      if (!pending!.confirmed && verify) {
        try {
          this.observe(threadId, await verify());
        } catch {
          // A later notification can still authoritatively confirm the update.
        }
      }
      await confirmed;
    } catch (error) {
      this.#remove(threadId, pending!);
      throw error;
    }
  }

  observe(threadId: string, settings: ThreadRuntimeSettings) {
    const pending = this.#pending.get(threadId);
    if (
      !pending ||
      settings.permission !== pending.expected.permission ||
      settings.approvalPolicy !== pending.expected.approvalPolicy
    ) {
      return false;
    }
    pending.confirmed = true;
    this.#remove(threadId, pending);
    pending.resolve();
    return true;
  }

  #remove(threadId: string, pending: PendingConfirmation) {
    if (this.#pending.get(threadId) !== pending) return;
    clearTimeout(pending.timeout);
    this.#pending.delete(threadId);
  }
}
