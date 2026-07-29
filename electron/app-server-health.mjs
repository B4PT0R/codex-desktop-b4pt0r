export const APP_SERVER_HEALTH_INTERVAL_MS = 2 * 60_000;
export const APP_SERVER_HEALTH_RETRY_MS = 5_000;
export const APP_SERVER_HEALTH_TIMEOUT_MS = 15_000;
export const APP_SERVER_RESUME_DELAY_MS = 3_000;

export class AppServerHealthMonitor {
  #failures = 0;
  #generation = 0;
  #inFlight;
  #interval;
  #probeTimeoutMs;
  #retryDelay;
  #retryDelayMs;
  #resumeTimer;
  #transport;

  constructor(
    transport,
    {
      probeTimeoutMs = APP_SERVER_HEALTH_TIMEOUT_MS,
      retryDelay = delay,
      retryDelayMs = APP_SERVER_HEALTH_RETRY_MS,
    } = {},
  ) {
    this.#transport = transport;
    this.#probeTimeoutMs = probeTimeoutMs;
    this.#retryDelay = retryDelay;
    this.#retryDelayMs = retryDelayMs;
  }

  start() {
    if (this.#interval) return;
    this.#interval = setInterval(
      () => void this.check(),
      APP_SERVER_HEALTH_INTERVAL_MS,
    );
    this.#interval.unref?.();
  }

  afterSystemResume() {
    clearTimeout(this.#resumeTimer);
    this.#resumeTimer = setTimeout(
      () => void this.check(),
      APP_SERVER_RESUME_DELAY_MS,
    );
    this.#resumeTimer.unref?.();
  }

  stop() {
    this.#generation += 1;
    this.#failures = 0;
    clearInterval(this.#interval);
    clearTimeout(this.#resumeTimer);
    this.#interval = undefined;
    this.#resumeTimer = undefined;
  }

  async check() {
    if (this.#inFlight) return this.#inFlight;
    const generation = this.#generation;
    this.#inFlight = this.#runCheck(generation).finally(() => {
      this.#inFlight = undefined;
    });
    return this.#inFlight;
  }

  async #runCheck(generation) {
    const status = await this.#transport.probe(this.#probeTimeoutMs);
    if (generation !== this.#generation) return "stopped";
    if (status === "responsive") {
      this.#failures = 0;
      return status;
    }
    if (status === "unavailable") {
      this.#failures = 0;
      return status;
    }

    this.#failures += 1;
    if (this.#failures < 2) {
      await this.#retryDelay(this.#retryDelayMs);
      if (generation !== this.#generation) return "stopped";
      return this.#runCheck(generation);
    }
    this.#failures = 0;
    this.#transport.terminateUnresponsive();
    return "restarting";
  }
}

function delay(durationMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, durationMs);
    timer.unref?.();
  });
}
