import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AutomationScheduler,
  nextOccurrence,
} from "./automation-scheduler.mjs";
import { updateSettings } from "./settings.mjs";

test("calculates interval and weekly occurrences", () => {
  const after = new Date(2026, 6, 29, 9, 30).getTime();
  assert.equal(
    nextOccurrence({ type: "interval", intervalMinutes: 15 }, after),
    after + 15 * 60_000,
  );
  assert.equal(
    nextOccurrence({ type: "weekly", time: "10:00", days: [3] }, after),
    new Date(2026, 6, 29, 10, 0).getTime(),
  );
  assert.equal(
    nextOccurrence({ type: "once", at: after + 60_000 }, after),
    after + 60_000,
  );
  assert.equal(nextOccurrence({ type: "once", at: after }, after), undefined);
});

test("claims a one-time task exactly once and accepts an ephemeral target", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const events = [];
  const scheduler = new AutomationScheduler({
    file: path.join(directory, "settings.json"),
    send: (_event, payload) => events.push(payload),
  });
  const saved = await scheduler.upsert({
    name: "One shot",
    prompt: "Inspect repository",
    enabled: true,
    schedule: { type: "once", at: Date.now() + 60_000 },
    target: { type: "ephemeralThread" },
  });

  await scheduler.runNow(saved.id);
  const [claimed] = await scheduler.list();
  assert.equal(claimed.enabled, false);
  assert.equal(claimed.nextRunAt, undefined);
  assert.equal(claimed.target.type, "ephemeralThread");
  assert.equal(events.length, 1);
});

test("persists, claims and completes a scheduled task", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const file = path.join(directory, "settings.json");
  const events = [];
  const scheduler = new AutomationScheduler({
    file,
    send: (event, payload) => events.push({ event, payload }),
  });
  const task = await scheduler.upsert({
    name: "Check repository",
    prompt: "Inspect the repository status",
    cwd: "/tmp/project",
    enabled: true,
    unattendedAccess: true,
    schedule: { type: "interval", intervalMinutes: 15 },
    target: { type: "newThread" },
  });

  const run = await scheduler.runNow(task.id);
  assert.equal(run.id, task.id);
  assert.equal(run.unattendedAccess, true);
  assert.equal(events[0].event, "automation-run-due");
  await scheduler.complete({
    id: task.id,
    runId: run.runId,
    status: "succeeded",
    threadId: "thread-123",
  });

  assert.deepEqual(
    (await scheduler.list()).map((item) => ({
      name: item.name,
      lastStatus: item.lastStatus,
      lastThreadId: item.lastThreadId,
      activeRunId: item.activeRunId,
    })),
    [
      {
        name: "Check repository",
        lastStatus: "succeeded",
        lastThreadId: "thread-123",
        activeRunId: undefined,
      },
    ],
  );
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.version, 1);
  assert.equal(stored.automations[0].unattendedAccess, true);
});

test("defers due work until App Server is available again", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const file = path.join(directory, "settings.json");
  const events = [];
  const scheduler = new AutomationScheduler({
    file,
    send: (event, payload) => events.push({ event, payload }),
  });
  await scheduler.upsert({
    name: "Deferred task",
    prompt: "Run after recovery",
    enabled: true,
    schedule: { type: "interval", intervalMinutes: 5 },
    target: { type: "newThread" },
  });
  await updateSettings(file, {
    automations: (await scheduler.list()).map((item) => ({
      ...item,
      nextRunAt: Date.now() - 1,
    })),
  });

  scheduler.notReady();
  assert.equal(events.length, 0);
  await scheduler.ready();
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "automation-run-due");
  scheduler.stop();
});

test("keeps an active run attached when its schedule is edited", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const file = path.join(directory, "settings.json");
  const scheduler = new AutomationScheduler({ file, send: () => undefined });
  const saved = await scheduler.upsert({
    name: "Review",
    prompt: "Inspect repository",
    enabled: true,
    schedule: { type: "interval", intervalMinutes: 60 },
    target: { type: "newThread" },
  });
  const run = await scheduler.runNow(saved.id);

  await scheduler.upsert({
    ...saved,
    name: "Updated review",
    schedule: { type: "interval", intervalMinutes: 90 },
  });

  const [updated] = await scheduler.list();
  assert.equal(updated.activeRunId, run.runId);
  assert.equal(updated.lastStatus, "running");
  assert.equal(updated.name, "Updated review");
});

test("refuses to delete a running scheduled task", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const scheduler = new AutomationScheduler({
    file: path.join(directory, "settings.json"),
    send: () => undefined,
  });
  const saved = await scheduler.upsert({
    name: "Review",
    prompt: "Inspect repository",
    enabled: true,
    schedule: { type: "interval", intervalMinutes: 60 },
    target: { type: "newThread" },
  });
  await scheduler.runNow(saved.id);

  await assert.rejects(
    scheduler.remove(saved.id),
    /Cannot delete a running scheduled task/,
  );
  assert.equal((await scheduler.list())[0].activeRunId !== undefined, true);
});

test("rejects unsafe or unsupported task values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-automation-"));
  const scheduler = new AutomationScheduler({
    file: path.join(directory, "settings.json"),
    send: () => {},
  });
  await assert.rejects(
    scheduler.upsert({
      name: "Too fast",
      prompt: "Run",
      enabled: true,
      schedule: { type: "interval", intervalMinutes: 1 },
      target: { type: "newThread" },
    }),
    /Invalid automation interval/,
  );
  await assert.rejects(
    scheduler.upsert({
      name: "Too late",
      prompt: "Run",
      enabled: true,
      schedule: { type: "once", at: Date.now() - 60_000 },
      target: { type: "newThread" },
    }),
    /date must be in the future/,
  );
});
