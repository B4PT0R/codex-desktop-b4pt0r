import { randomUUID } from "node:crypto";
import { readSettings, updateSettings } from "./settings.mjs";

const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 7 * 24 * 60;
const MAX_TEXT_LENGTH = 32_768;
const TICK_MS = 30_000;

export class AutomationScheduler {
  #file;
  #send;
  #timer;
  #ready = false;
  #queue = Promise.resolve();

  constructor({ file, send }) {
    this.#file = file;
    this.#send = send;
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(
      () => void this.#tick().catch(() => undefined),
      TICK_MS,
    );
    this.#timer.unref?.();
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = undefined;
    this.#ready = false;
  }

  notReady() {
    this.#ready = false;
  }

  async ready() {
    this.#ready = true;
    const hasInterruptedRun = (await this.list()).some(
      (item) => item.activeRunId,
    );
    if (hasInterruptedRun) {
      await this.#mutate((items) =>
        items.map((item) =>
          item.activeRunId
            ? {
                ...item,
                activeRunId: undefined,
                lastStatus: "failed",
                lastError: "automation-interrupted",
              }
            : item,
        ),
      );
    }
    await this.#tick();
  }

  async list() {
    return readAutomations(this.#file);
  }

  async upsert(input) {
    const automation = normalizeAutomation(input, Date.now());
    return this.#mutate((items) => {
      const index = items.findIndex((item) => item.id === automation.id);
      if (index < 0) return [...items, automation];
      const previous = items[index];
      const next = [...items];
      next[index] = {
        ...automation,
        activeRunId: previous.activeRunId,
        lastRunAt: previous.lastRunAt,
        lastStatus: previous.activeRunId ? "running" : previous.lastStatus,
        lastThreadId: previous.lastThreadId,
        lastError: previous.activeRunId ? undefined : previous.lastError,
      };
      return next;
    }).then((items) => items.find((item) => item.id === automation.id));
  }

  async remove(id) {
    validateId(id);
    let removed = false;
    await this.#mutate((items) => {
      const current = items.find((item) => item.id === id);
      if (!current) return items;
      if (current.activeRunId) {
        throw new Error("Cannot delete a running scheduled task");
      }
      removed = true;
      return items.filter((item) => item.id !== id);
    });
    return removed;
  }

  async runNow(id) {
    validateId(id);
    return this.#claim(id, Date.now());
  }

  async complete(input) {
    const { id, runId, status, threadId, error } = objectValue(input);
    validateId(id);
    validateId(runId);
    if (!["succeeded", "failed"].includes(status)) {
      throw new Error("Invalid automation completion status");
    }
    await this.#mutate((items) =>
      items.map((item) =>
        item.id !== id || item.activeRunId !== runId
          ? item
          : {
              ...item,
              activeRunId: undefined,
              lastStatus: status,
              lastThreadId:
                typeof threadId === "string" ? threadId : item.lastThreadId,
              lastError:
                status === "failed"
                  ? boundedText(error, "Automation failed")
                  : undefined,
            },
      ),
    );
  }

  async #tick() {
    if (!this.#ready) return;
    const now = Date.now();
    const items = await this.list();
    for (const item of items) {
      if (
        item.enabled &&
        !item.activeRunId &&
        typeof item.nextRunAt === "number" &&
        item.nextRunAt <= now
      ) {
        await this.#claim(item.id, now);
      }
    }
  }

  async #claim(id, now) {
    let claimed;
    await this.#mutate((items) =>
      items.map((item) => {
        if (item.id !== id || item.activeRunId) return item;
        const runId = randomUUID();
        claimed = {
          ...item,
          runId,
        };
        return {
          ...item,
          activeRunId: runId,
          enabled: item.schedule.type === "once" ? false : item.enabled,
          lastRunAt: now,
          lastStatus: "running",
          lastError: undefined,
          nextRunAt:
            item.schedule.type === "once"
              ? undefined
              : nextOccurrence(item.schedule, now),
        };
      }),
    );
    if (claimed) this.#send("automation-run-due", claimed);
    return claimed ?? null;
  }

  #mutate(transform) {
    const operation = this.#queue
      .catch(() => undefined)
      .then(async () => {
        const items = await readAutomations(this.#file);
        const next = transform(items);
        await updateSettings(this.#file, { automations: next });
        return next;
      });
    this.#queue = operation;
    return operation;
  }
}

export async function readAutomations(file) {
  const settings = await readSettings(file);
  if (!Array.isArray(settings.automations)) return [];
  return settings.automations.flatMap((value) => {
    try {
      return [normalizeStoredAutomation(value)];
    } catch {
      return [];
    }
  });
}

export function nextOccurrence(schedule, after) {
  if (schedule.type === "interval") {
    return after + schedule.intervalMinutes * 60_000;
  }
  if (schedule.type === "once") {
    return schedule.at > after ? schedule.at : undefined;
  }
  const [hours, minutes] = schedule.time.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(after);
    candidate.setSeconds(0, 0);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (
      candidate.getTime() > after &&
      schedule.days.includes(candidate.getDay())
    ) {
      return candidate.getTime();
    }
  }
  throw new Error("Unable to calculate the next automation occurrence");
}

function normalizeAutomation(input, now) {
  const value = objectValue(input);
  const schedule = normalizeSchedule(value.schedule);
  const target = normalizeTarget(value.target);
  const enabled = value.enabled !== false;
  const nextRunAt = enabled ? nextOccurrence(schedule, now) : undefined;
  if (enabled && nextRunAt === undefined) {
    throw new Error("Automation date must be in the future");
  }
  return {
    id: value.id === undefined ? randomUUID() : validateId(value.id),
    name: boundedText(value.name, "Scheduled task"),
    prompt: boundedText(value.prompt),
    cwd:
      value.cwd === undefined || value.cwd === ""
        ? undefined
        : boundedText(value.cwd),
    enabled,
    unattendedAccess: value.unattendedAccess === true,
    schedule,
    target,
    nextRunAt,
    lastRunAt: undefined,
    lastStatus: undefined,
    lastThreadId: undefined,
    lastError: undefined,
    activeRunId: undefined,
  };
}

function normalizeStoredAutomation(input) {
  const value = objectValue(input);
  const schedule = normalizeSchedule(value.schedule);
  const enabled = value.enabled === true;
  return {
    id: validateId(value.id),
    name: boundedText(value.name, "Scheduled task"),
    prompt: boundedText(value.prompt),
    cwd: typeof value.cwd === "string" ? boundedText(value.cwd) : undefined,
    enabled,
    unattendedAccess: value.unattendedAccess === true,
    schedule,
    target: normalizeTarget(value.target),
    nextRunAt: finiteTimestamp(value.nextRunAt),
    lastRunAt: finiteTimestamp(value.lastRunAt),
    lastStatus: ["running", "succeeded", "failed"].includes(value.lastStatus)
      ? value.lastStatus
      : undefined,
    lastThreadId:
      typeof value.lastThreadId === "string"
        ? boundedText(value.lastThreadId)
        : undefined,
    lastError:
      typeof value.lastError === "string"
        ? boundedText(value.lastError)
        : undefined,
    activeRunId:
      typeof value.activeRunId === "string"
        ? validateId(value.activeRunId)
        : undefined,
  };
}

function normalizeSchedule(input) {
  const value = objectValue(input);
  if (value.type === "interval") {
    if (
      !Number.isInteger(value.intervalMinutes) ||
      value.intervalMinutes < MIN_INTERVAL_MINUTES ||
      value.intervalMinutes > MAX_INTERVAL_MINUTES
    ) {
      throw new Error("Invalid automation interval");
    }
    return { type: "interval", intervalMinutes: value.intervalMinutes };
  }
  if (value.type === "once") {
    const at = finiteTimestamp(value.at);
    if (at === undefined) throw new Error("Invalid automation date");
    return { type: "once", at };
  }
  if (value.type !== "weekly" || !/^\d{2}:\d{2}$/.test(value.time ?? "")) {
    throw new Error("Invalid automation schedule");
  }
  const [hours, minutes] = value.time.split(":").map(Number);
  if (hours > 23 || minutes > 59) throw new Error("Invalid automation time");
  const days = [
    ...new Set(
      (Array.isArray(value.days) ? value.days : []).filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
      ),
    ),
  ].sort();
  if (days.length === 0) throw new Error("Automation schedule needs a weekday");
  return { type: "weekly", time: value.time, days };
}

function normalizeTarget(input) {
  const value = objectValue(input);
  if (value.type === "newThread" || value.type === "ephemeralThread") {
    return { type: value.type };
  }
  if (value.type === "thread") {
    return { type: "thread", threadId: boundedText(value.threadId) };
  }
  throw new Error("Invalid automation target");
}

function validateId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(value)) {
    throw new Error("Invalid automation identifier");
  }
  return value;
}

function finiteTimestamp(value) {
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function boundedText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (fallback !== undefined) return fallback;
    throw new Error("Automation text is required");
  }
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error("Automation text is too long");
  return text;
}

function objectValue(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Invalid automation value");
  }
  return value;
}
