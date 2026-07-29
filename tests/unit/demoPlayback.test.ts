import { describe, expect, it } from "vitest";
import { buildDemoPlaybackFrames } from "../../src/lib/useDemoPlayback";

describe("scénario de streaming de démonstration", () => {
  it("fait progresser texte, plan et outils jusqu’à un état final cohérent", () => {
    const frames = buildDemoPlaybackFrames();
    let messages = frames[0].update([]);
    for (const frame of frames.slice(1)) messages = frame.update(messages);

    expect(frames.map((frame) => frame.at)).toEqual(
      [...frames].map((frame) => frame.at).sort((a, b) => a - b),
    );
    expect(frames.at(-1)?.complete).toBe(true);
    expect(frames.at(-1)?.at).toBeGreaterThan(15_000);
    const assistants = messages.filter(
      (message) => message.role === "assistant",
    );
    expect(assistants).toHaveLength(3);
    expect(assistants.every((message) => message.streaming !== true)).toBe(true);
    expect(assistants[1].signals?.[0]).toMatchObject({
      kind: "compaction",
      status: "done",
    });
    expect(assistants[2].content).toContain("La vague reste continue");
    expect(assistants[0].tools).toHaveLength(7);
    expect(assistants[1].tools).toHaveLength(3);
    expect(
      assistants
        .flatMap((message) => message.tools ?? [])
        .every(
          (tool) =>
            tool.status === "done" ||
            (tool.id === "demo-live-dev-server" &&
              tool.status === "running"),
        ),
    ).toBe(true);
    const plan = assistants
      .flatMap((message) => message.signals ?? [])
      .find((signal) => signal.kind === "plan");
    expect(plan?.status).toBe("done");
    expect(
      plan?.steps?.every((step) => step.status === "completed"),
    ).toBe(true);
  });
});
