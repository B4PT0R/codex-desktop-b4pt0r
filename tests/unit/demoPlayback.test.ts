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
    expect(assistants.every((message) => message.streaming === false)).toBe(
      true,
    );
    expect(assistants[1].content).toContain("premières actions");
    expect(assistants[2].content).toContain("Le flux reste lisible");
    expect(assistants[0].tools).toHaveLength(2);
    expect(assistants[1].tools).toHaveLength(2);
    expect(
      assistants
        .flatMap((message) => message.tools ?? [])
        .every((tool) => tool.status === "done"),
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
