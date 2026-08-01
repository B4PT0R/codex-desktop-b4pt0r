// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Alert } from "../../src/components/Alert";

afterEach(cleanup);

describe("Alert", () => {
  it("uses status semantics for an ordinary warning", () => {
    render(<Alert>Desktop features are unavailable.</Alert>);

    expect(screen.getByRole("status")).toHaveClass(
      "settings-alert",
      "warning",
    );
  });

  it("uses alert semantics for errors", () => {
    render(<Alert tone="error">Could not load settings.</Alert>);

    expect(screen.getByRole("alert")).toHaveClass("error");
  });
});
