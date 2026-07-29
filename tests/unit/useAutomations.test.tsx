// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutomations } from "../../src/lib/useAutomations";
import { ThreadTurnCoordinator } from "../../src/lib/threadTurnCoordinator";
import { scheduledTaskPrompt } from "../../src/lib/protocol";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  request: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: mocks.invoke,
  isDesktopApp: () => true,
  listen: mocks.listen,
}));
vi.mock("../../src/lib/codex", () => ({
  request: mocks.request,
}));

afterEach(() => vi.clearAllMocks());

describe("tâches planifiées", () => {
  it("n’arme pas le scheduler si la connexion disparaît avant le listener", async () => {
    const registration = deferred<() => void>();
    const cleanup = vi.fn();
    mocks.listen.mockReturnValue(registration.promise);
    mocks.invoke.mockResolvedValue([]);
    const turnCoordinator = new ThreadTurnCoordinator();
    const { rerender } = renderHook(
      ({ connected }) =>
        useAutomations({
          connected,
          onError: vi.fn(),
          onThreadCreated: vi.fn(),
          turnCoordinator,
        }),
      { initialProps: { connected: true } },
    );
    await waitFor(() =>
      expect(mocks.listen).toHaveBeenCalledWith(
        "automation-run-due",
        expect.any(Function),
      ),
    );

    rerender({ connected: false });
    await act(async () => registration.resolve(cleanup));

    expect(cleanup).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalledWith("automation_ready");
    expect(mocks.invoke).not.toHaveBeenCalledWith("automation_list");
  });

  it("exécute un prompt dans un thread de fond et clôt le run", async () => {
    let due:
      ((event: { payload: Record<string, unknown> }) => void) | undefined;
    mocks.listen.mockImplementation(async (_event, handler) => {
      due = handler;
      return () => {};
    });
    mocks.invoke.mockImplementation(async (command) => {
      if (command === "automation_list") return [];
      return undefined;
    });
    mocks.request.mockImplementation(async (method) => {
      if (method === "thread/start")
        return { thread: { id: "thread-automation", cwd: "/project" } };
      if (method === "turn/start") return { turn: { id: "turn-1" } };
      throw new Error(`Unexpected request: ${method}`);
    });
    const onThreadCreated = vi.fn();
    const turnCoordinator = new ThreadTurnCoordinator();
    const { result } = renderHook(() =>
      useAutomations({
        connected: true,
        onError: vi.fn(),
        onThreadCreated,
        turnCoordinator,
      }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_ready"),
    );

    act(() =>
      due?.({
        payload: {
          id: "automation-1",
          runId: "run-0001",
          name: "Review",
          prompt: "Inspect repository",
          enabled: true,
          cwd: "/project",
          schedule: { type: "interval", intervalMinutes: 60 },
          target: { type: "newThread" },
        },
      }),
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("turn/start", {
        threadId: "thread-automation",
        input: [
          {
            type: "text",
            text: scheduledTaskPrompt("Review", "Inspect repository"),
          },
        ],
      }),
    );
    expect(onThreadCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-automation", cwd: "/project" }),
    );

    act(() => {
      result.current.handleMessage({
        method: "turn/completed",
        params: { threadId: "thread-automation" },
      });
    });
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_complete", {
        id: "automation-1",
        runId: "run-0001",
        status: "succeeded",
        threadId: "thread-automation",
        error: undefined,
      }),
    );
  });

  it("démarre un thread éphémère sans l’ajouter à la navigation", async () => {
    let due:
      ((event: { payload: Record<string, unknown> }) => void) | undefined;
    mocks.listen.mockImplementation(async (_event, handler) => {
      due = handler;
      return () => {};
    });
    mocks.invoke.mockImplementation(async (command) => {
      if (command === "automation_list") return [];
      return undefined;
    });
    mocks.request.mockImplementation(async (method) => {
      if (method === "thread/start")
        return { thread: { id: "thread-ephemeral", cwd: "/project" } };
      if (method === "turn/start") return { turn: { id: "turn-1" } };
      throw new Error(`Unexpected request: ${method}`);
    });
    const onThreadCreated = vi.fn();
    const turnCoordinator = new ThreadTurnCoordinator();
    renderHook(() =>
      useAutomations({
        connected: true,
        onError: vi.fn(),
        onThreadCreated,
        turnCoordinator,
      }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_ready"),
    );

    act(() =>
      due?.({
        payload: {
          id: "automation-1",
          runId: "run-0001",
          name: "Review",
          prompt: "Inspect repository",
          enabled: true,
          cwd: "/project",
          schedule: { type: "once", at: Date.now() + 60_000 },
          target: { type: "ephemeralThread" },
        },
      }),
    );

    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("thread/start", {
        cwd: "/project",
        ephemeral: true,
      }),
    );
    expect(onThreadCreated).not.toHaveBeenCalled();
  });

  it("distingue deux exécutions qui ciblent le même thread", async () => {
    let due:
      ((event: { payload: Record<string, unknown> }) => void) | undefined;
    let turnSequence = 0;
    mocks.listen.mockImplementation(async (_event, handler) => {
      due = handler;
      return () => {};
    });
    mocks.invoke.mockImplementation(async (command) => {
      if (command === "automation_list") return [];
      return undefined;
    });
    mocks.request.mockImplementation(async (method) => {
      if (method === "thread/resume")
        return { thread: { id: "thread-shared", cwd: "/project" } };
      if (method === "turn/start")
        return { turn: { id: `turn-${++turnSequence}` } };
      throw new Error(`Unexpected request: ${method}`);
    });
    const turnCoordinator = new ThreadTurnCoordinator();
    const { result } = renderHook(() =>
      useAutomations({
        connected: true,
        onError: vi.fn(),
        onThreadCreated: vi.fn(),
        turnCoordinator,
      }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_ready"),
    );

    act(() => {
      for (const [id, runId] of [
        ["automation-1", "run-0001"],
        ["automation-2", "run-0002"],
      ]) {
        due?.({
          payload: {
            id,
            runId,
            name: id,
            prompt: "Inspect repository",
            enabled: true,
            schedule: { type: "interval", intervalMinutes: 60 },
            target: { type: "thread", threadId: "thread-shared" },
          },
        });
      }
    });
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3));

    act(() => {
      const completed = {
        method: "turn/completed",
        params: {
          threadId: "thread-shared",
          turn: { id: "turn-1", status: "completed" },
        },
      };
      turnCoordinator.handleMessage(completed);
      result.current.handleMessage(completed);
    });

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(4));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_complete", {
        id: "automation-1",
        runId: "run-0001",
        status: "succeeded",
        threadId: "thread-shared",
        error: undefined,
      }),
    );
  });

  it("restaure la sécurité après une exécution sans surveillance", async () => {
    let due:
      ((event: { payload: Record<string, unknown> }) => void) | undefined;
    mocks.listen.mockImplementation(async (_event, handler) => {
      due = handler;
      return () => {};
    });
    mocks.invoke.mockImplementation(async (command) => {
      if (command === "automation_list") return [];
      return undefined;
    });
    mocks.request.mockImplementation(async (method) => {
      if (method === "thread/resume") {
        return {
          thread: {
            id: "thread-secure",
            cwd: "/project",
            status: { type: "idle" },
          },
          activePermissionProfile: { id: ":workspace" },
          approvalPolicy: "on-request",
        };
      }
      if (method === "turn/start") return { turn: { id: "turn-secure" } };
      if (method === "thread/settings/update") return {};
      throw new Error(`Unexpected request: ${method}`);
    });
    const turnCoordinator = new ThreadTurnCoordinator();
    const { result } = renderHook(() =>
      useAutomations({
        connected: true,
        onError: vi.fn(),
        onThreadCreated: vi.fn(),
        turnCoordinator,
      }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("automation_ready"),
    );

    act(() =>
      due?.({
        payload: {
          id: "automation-secure",
          runId: "run-secure",
          name: "Maintenance",
          prompt: "Applique la maintenance",
          enabled: true,
          unattendedAccess: true,
          schedule: { type: "interval", intervalMinutes: 60 },
          target: { type: "thread", threadId: "thread-secure" },
        },
      }),
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "turn/start",
        expect.objectContaining({
          permissions: ":danger-full-access",
          approvalPolicy: "never",
        }),
      ),
    );

    act(() => {
      const completed = {
        method: "turn/completed",
        params: {
          threadId: "thread-secure",
          turn: { id: "turn-secure", status: "completed" },
        },
      };
      turnCoordinator.handleMessage(completed);
      result.current.handleMessage(completed);
    });

    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("thread/settings/update", {
        threadId: "thread-secure",
        permissions: ":workspace",
        approvalPolicy: "on-request",
      }),
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "automation_complete",
      expect.objectContaining({ id: "automation-secure" }),
    );
    act(() => {
      result.current.handleMessage({
        method: "thread/settings/updated",
        params: {
          threadId: "thread-secure",
          threadSettings: {
            activePermissionProfile: { id: ":workspace" },
            approvalPolicy: "on-request",
          },
        },
      });
    });
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith(
        "automation_complete",
        expect.objectContaining({
          id: "automation-secure",
          status: "succeeded",
        }),
      ),
    );
  });
});
