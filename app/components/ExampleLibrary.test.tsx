// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { ExampleCardGrid } from "./ExampleLibrary";
import { EXAMPLE_DESIGNS } from "@/lib/example-library";

afterEach(() => cleanup());

describe("ExampleCardGrid", () => {
  it("renders example cards with links, domains, descriptions, and categories", () => {
    render(
      <MemoryRouter>
        <ExampleCardGrid examples={EXAMPLE_DESIGNS.slice(0, 2)} />
      </MemoryRouter>,
    );

    const stripeLink = screen.getByRole("link", { name: /stripe/i });
    expect(stripeLink.getAttribute("href")).toBe("/examples/stripe");
    expect(stripeLink.querySelector('img[src="/assets/examples/logos/stripe.svg"]'))
      .toBeTruthy();
    expect(screen.getByText("stripe.com")).toBeTruthy();
    expect(screen.getByText("Developer platform")).toBeTruthy();
    expect(screen.getByText(/cool surfaces/i)).toBeTruthy();
  });
});
