// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountMenu from "./AccountMenu";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  magicLink: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: authMocks.useSession,
    signIn: { magicLink: authMocks.magicLink },
    signOut: authMocks.signOut,
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountMenu", () => {
  it("gives signed-out visitors a persistent magic-link sign-in", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "anonymous@example.com", isAnonymous: true } },
      isPending: false,
    });
    authMocks.magicLink.mockResolvedValue({ error: null });

    render(<AccountMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      screen.getByRole("heading", { name: "Sign in to Free design.md" }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "returning@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => {
      expect(authMocks.magicLink).toHaveBeenCalledWith({
        email: "returning@example.com",
        callbackURL: window.location.href,
      });
    });
    expect(await screen.findByText("Sign-in link sent")).toBeTruthy();
  });

  it("shows the verified account and signs it out", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "person@example.com", isAnonymous: false } },
      isPending: false,
    });
    authMocks.signOut.mockResolvedValue({ error: null });

    render(<AccountMenu />);

    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Account menu for person@example.com",
      }),
    );
    expect(await screen.findByText("person@example.com")).toBeTruthy();

    fireEvent.click(screen.getByText("Sign out"));
    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce());
  });
});
