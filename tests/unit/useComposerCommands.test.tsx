// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultTranslate } from "../../src/i18n/translate";
import { commandFromText, composerCommands } from "../../src/lib/commands";
import { useComposerCommands } from "../../src/lib/useComposerCommands";

vi.mock("../../src/lib/useAutoReviewDenials", () => ({
  useAutoReviewDenials: () => ({
    approve: vi.fn(),
    forThread: () => [],
  }),
}));

type Options = Parameters<typeof useComposerCommands>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function command(name: string) {
  const result = commandFromText(name);
  if (!result) throw new Error(`Unknown test command: ${name}`);
  return result;
}

function options(overrides: Partial<Options> = {}): Options {
  return {
    approvalPolicy: "on-request",
    backgroundTerminals: {
      loading: false,
      refresh: vi.fn().mockResolvedValue([]),
      terminals: [],
      terminate: vi.fn().mockResolvedValue(true),
      terminating: [],
    },
    busy: false,
    connected: true,
    effort: "medium",
    messages: [],
    model: "gpt-test",
    models: [
      {
        id: "gpt-test",
        label: "GPT test",
        supportedReasoningEfforts: [
          { reasoningEffort: "medium", description: "Balanced" },
          { reasoningEffort: "high", description: "Thorough" },
        ],
      },
    ],
    permission: ":workspace",
    permissionProfiles: [
      { id: ":workspace", name: "Workspace", allowed: true },
      { id: ":danger-full-access", name: "Full access", allowed: true },
    ],
    runtimeMutations: {
      changeApprovalPolicy: vi.fn().mockResolvedValue(true),
      changeCollaborationMode: vi.fn().mockResolvedValue(true),
      changePermission: vi.fn().mockResolvedValue(true),
      changeServiceTier: vi.fn().mockResolvedValue(true),
    },
    serviceTier: null,
    threadId: "thread-1",
    translate: defaultTranslate,
    onAppendResult: vi.fn(),
    onClear: vi.fn(),
    onCompact: vi.fn().mockResolvedValue(true),
    onReview: vi.fn().mockResolvedValue(true),
    onSetEffort: vi.fn(),
    onSetModel: vi.fn(),
    onShowError: vi.fn(),
    writeClipboard: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("orchestration des commandes du composer", () => {
  it("produit un item de résultat pour chaque commande validée", async () => {
    const onAppendResult = vi.fn();
    const { result } = renderHook(() =>
      useComposerCommands(options({ onAppendResult })),
    );

    async function execute(name: string, choiceId?: string) {
      await act(() => result.current.execute(command(name)));
      if (choiceId)
        await act(() => result.current.selectChoice(choiceId));
    }

    const choices: Partial<Record<(typeof composerCommands)[number]["id"], string>> = {
      model: "gpt-test",
      reasoning: "high",
      permissions: ":danger-full-access",
      approvals: "never",
    };
    for (const item of composerCommands)
      await execute(item.value, choices[item.id]);

    expect(onAppendResult.mock.calls.map(([title]) => title)).toEqual(
      composerCommands.map(({ value }) => value),
    );
  });

  it("ignore un résultat asynchrone après un changement de thread", async () => {
    const refresh = deferred<
      Array<{ itemId: string; processId: string; command: string; cwd: string }>
    >();
    const onAppendResult = vi.fn();
    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) =>
        useComposerCommands(
          options({
            backgroundTerminals: {
              loading: false,
              refresh: () => refresh.promise,
              terminals: [],
              terminate: vi.fn(),
              terminating: [],
            },
            onAppendResult,
            threadId,
          }),
        ),
      { initialProps: { threadId: "thread-1" } },
    );

    let execution!: Promise<void>;
    act(() => {
      execution = result.current.execute(command("/ps"));
    });
    rerender({ threadId: "thread-2" });
    refresh.resolve([
      {
        itemId: "item-1",
        processId: "process-1",
        command: "npm run dev",
        cwd: "/workspace",
      },
    ]);
    await act(() => execution);

    expect(onAppendResult).not.toHaveBeenCalled();
  });

  it("ferme un choix ouvert lors du changement de thread", () => {
    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) =>
        useComposerCommands(options({ threadId })),
      { initialProps: { threadId: "thread-1" } },
    );

    act(() => void result.current.execute(command("/model")));
    expect(result.current.choiceRequest?.command).toBe("/model");

    rerender({ threadId: "thread-2" });
    expect(result.current.choiceRequest).toBeUndefined();
  });

  it("sérialise deux validations du même choix", async () => {
    const mutation = deferred<boolean>();
    const changePermission = vi.fn().mockReturnValue(mutation.promise);
    const { result } = renderHook(() =>
      useComposerCommands(
        options({
          runtimeMutations: {
            ...options().runtimeMutations,
            changePermission,
          },
        }),
      ),
    );
    act(() => void result.current.execute(command("/permissions")));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.selectChoice(":danger-full-access");
      second = result.current.selectChoice(":danger-full-access");
    });

    await act(() => second);
    expect(changePermission).toHaveBeenCalledOnce();
    mutation.resolve(true);
    await act(() => first);
  });
});
