// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import ExampleDetailRoute from "../routes/examples.$slug";

afterEach(() => cleanup());

describe("ExampleDetailRoute", () => {
  it("renders a curated artifact with one active output at a time", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/examples/stripe"]}>
        <Routes>
          <Route path="/examples/:slug" element={<ExampleDetailRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Stripe design.md" }),
    ).toBeTruthy();
    expect(screen.getByText("Preview from tokens")).toBeTruthy();
    expect(screen.getByRole("button", { name: "AI-enriched" })).toBeTruthy();
    expect(container.querySelector("pre")?.textContent).toContain(
      "## Do's and Don'ts",
    );

    fireEvent.click(screen.getByRole("button", { name: "Deterministic" }));

    const activeOutput = container.querySelector("pre")?.textContent ?? "";
    expect(activeOutput).toContain("## Colors");
    expect(activeOutput).not.toContain("## Do's and Don'ts");
  });
});
