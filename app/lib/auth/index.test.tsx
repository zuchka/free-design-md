// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useAuth, signIn, signOut, consumeQuota } from "./index";
import { _resetForTests } from "./mock-auth";

/**
 * Regression test for "Maximum update depth exceeded": the original
 * useAuth implementation called refreshSnapshot() + cb() inside the
 * useSyncExternalStore subscribe at mount time, which produced a new
 * snapshot reference on every mount/effect cycle and caused React to
 * infinite-loop. These tests render a component that uses useAuth and
 * exercise the four state transitions — if the loop comes back, the
 * test framework hangs or throws, not silently passes.
 */

function AuthProbe() {
  const { user, remaining } = useAuth();
  return (
    <div>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <span data-testid="remaining">{remaining}</span>
    </div>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    _resetForTests();
  });
  afterEach(() => {
    cleanup();
    _resetForTests();
  });

  it("mounts cleanly without an infinite update loop, signed-out", () => {
    render(<AuthProbe />);
    expect(screen.getByTestId("email").textContent).toBe("none");
    expect(screen.getByTestId("remaining").textContent).toBe("3");
  });

  it("re-renders when signIn fires the change event", () => {
    render(<AuthProbe />);
    act(() => {
      signIn("matt@builder.io");
    });
    expect(screen.getByTestId("email").textContent).toBe("matt@builder.io");
    expect(screen.getByTestId("remaining").textContent).toBe("3");
  });

  it("re-renders when consumeQuota decrements", () => {
    render(<AuthProbe />);
    act(() => {
      signIn("matt@builder.io");
    });
    act(() => {
      consumeQuota();
    });
    expect(screen.getByTestId("remaining").textContent).toBe("2");
  });

  it("re-renders when signOut clears the user", () => {
    render(<AuthProbe />);
    act(() => {
      signIn("matt@builder.io");
    });
    act(() => {
      signOut();
    });
    expect(screen.getByTestId("email").textContent).toBe("none");
  });
});
