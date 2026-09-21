// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseCreditsButton from "./PurchaseCreditsButton";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  magicLink: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: authMocks.useSession,
    signIn: { magicLink: authMocks.magicLink },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PurchaseCreditsButton", () => {
  it("offers one run for $0.89 and 10 runs for $4.99", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "buyer@example.com", isAnonymous: false } },
      isPending: false,
    });

    render(<PurchaseCreditsButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Buy 10 AI runs — $4.99" }),
    );

    expect(screen.getByText("$0.89")).toBeTruthy();
    expect(screen.getByText("$4.99")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Buy 10 AI runs for $4.99" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /1 AI run.*\$0\.89/i }));
    expect(
      screen.getByRole("button", { name: "Buy 1 AI run for $0.89" }),
    ).toBeTruthy();
  });

  it("keeps both prices visible while asking an anonymous visitor to sign in", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "anonymous@example.com", isAnonymous: true } },
      isPending: false,
    });

    render(<PurchaseCreditsButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Buy 10 AI runs — $4.99" }),
    );

    expect(screen.getByText("$0.89")).toBeTruthy();
    expect(screen.getByText("$4.99")).toBeTruthy();
    expect(screen.getByLabelText("Sign in to keep your AI runs")).toBeTruthy();
  });
});
