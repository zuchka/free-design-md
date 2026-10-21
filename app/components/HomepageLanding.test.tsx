// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomepageLanding from "./HomepageLanding";
import { getHomepageExamples } from "@/lib/example-library";

afterEach(() => cleanup());

describe("HomepageLanding", () => {
  it("leads with website extraction, the agent skill, and the example library", () => {
    render(
      <MemoryRouter>
        <HomepageLanding
          url=""
          isLoading={false}
          examples={getHomepageExamples()}
          onUrlChange={() => undefined}
          onSubmit={(event) => event.preventDefault()}
          onSampleSelect={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: /turn any public website into a portable design\.md/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Extract design.md" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install skill" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Claude Code" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Codex" })).toBeTruthy();
    expect(screen.getByText(/optional AI enrichment/i)).toBeTruthy();
    expect(screen.getByText("Free example library")).toBeTruthy();
    expect(screen.queryByText("Artifact preview")).toBeNull();
    expect(screen.queryByText("Structured tokens")).toBeNull();
    expect(screen.queryByText("Paste URL")).toBeNull();
    expect(screen.queryByText("API and CLI docs")).toBeNull();
    expect(screen.getAllByText("Stripe").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /nike/i })).toBeTruthy();
    const footerNav = screen.getByRole("navigation", { name: /footer/i });
    expect(footerNav).toBeTruthy();
    expect(
      within(footerNav).getByRole("link", { name: /advanced usage/i }),
    ).toBeTruthy();
  });

  it("launches extraction when a curated sample is selected", () => {
    const onSampleSelect = vi.fn();

    render(
      <MemoryRouter>
        <HomepageLanding
          url=""
          isLoading={false}
          examples={getHomepageExamples()}
          onUrlChange={() => undefined}
          onSubmit={(event) => event.preventDefault()}
          onSampleSelect={onSampleSelect}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stripe" }));

    expect(onSampleSelect).toHaveBeenCalledWith("https://stripe.com/");
  });
});
