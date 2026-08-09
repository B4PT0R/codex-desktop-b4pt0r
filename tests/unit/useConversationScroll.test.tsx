// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationScroll } from "../../src/lib/useConversationScroll";

type ResizeCallback = ConstructorParameters<typeof ResizeObserver>[0];

let resizeCallback: ResizeCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class ResizeObserverMock {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

function ScrollHarness({ content = "Réponse" }: { content?: string }) {
  const scroll = useConversationScroll(
    [{ id: "message", role: "assistant", content, streaming: true }],
    null,
  );
  return (
    <section
      onScroll={scroll.onScroll}
      onWheel={scroll.onWheel}
      ref={scroll.container}
    >
      <div ref={scroll.content}>{content}</div>
    </section>
  );
}

describe("défilement de conversation", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    observe.mockClear();
    disconnect.mockClear();
  });

  it("reste ancré en bas lorsque le composer redimensionne le viewport", () => {
    const { container } = render(<ScrollHarness />);
    const scroller = container.querySelector("section")!;
    const content = container.querySelector("div")!;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 1_200,
    });

    expect(observe).toHaveBeenCalledWith(content);
    expect(observe).toHaveBeenCalledWith(scroller);

    act(() => {
      resizeCallback(
        [{ target: scroller } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      top: 1_200,
    });
  });

  it("laisse le ResizeObserver piloter le streaming sans scroll concurrent", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { container, rerender } = render(<ScrollHarness content="Début" />);
    const scroller = container.querySelector("section")!;
    const content = container.querySelector("div")!;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 1_200,
    });

    rerender(<ScrollHarness content="Début prolongé" />);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      resizeCallback(
        [{ target: content } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 1_200 });
  });

  it("préserve la lecture lorsque l’utilisateur a remonté la conversation", () => {
    const { container } = render(<ScrollHarness />);
    const scroller = container.querySelector("section")!;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_200 },
    });

    scroller.scrollTop = 800;
    fireEvent.scroll(scroller);
    fireEvent.wheel(scroller, { deltaY: -80 });
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);
    scrollTo.mockClear();

    act(() => {
      resizeCallback(
        [{ target: scroller } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
