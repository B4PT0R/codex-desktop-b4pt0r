// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Note } from "../../src/components/Note";

afterEach(cleanup);

describe("note typographique commune", () => {
  it("rend un contexte éditorial avec un titre facultatif", () => {
    const { container } = render(
      <Note title="Outils navigateur">Contexte partagé avec l’agent.</Note>,
    );

    expect(container.querySelector("aside.settings-note")).not.toBeNull();
    expect(screen.getByText("Outils navigateur")).toBeVisible();
    expect(screen.getByText("Contexte partagé avec l’agent.")).toBeVisible();
  });
});
