// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomepageLanding from "./HomepageLanding";
import { getHomepageExamples } from "@/lib/example-library";

afterEach(() => cleanup());

describe("HomepageLanding", () => {
  it("explains API, CLI, Docker, exports, and example library entry points", () => {
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
    expect(screen.getByText("Use it from code")).toBeTruthy();
    expect(screen.getByText("HTTP")).toBeTruthy();
    expect(screen.getByText("CLI")).toBeTruthy();
    expect(screen.getByText("Docker")).toBeTruthy();
    expect(screen.getByText(/ghcr\.io\/zuchka\/free-design-md:latest/))
      .toBeTruthy();
    expect(screen.getByText("Markdown")).toBeTruthy();
    expect(screen.getByText("HTML")).toBeTruthy();
    expect(screen.getByText("MDX")).toBeTruthy();
    expect(screen.getByText("Enrich with AI")).toBeTruthy();
    expect(screen.getByText("Free example library")).toBeTruthy();
    expect(screen.getAllByText("Stripe").length).toBeGreaterThan(0);
  });

  it("launches extraction when a curated sample chip is selected", () => {
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
