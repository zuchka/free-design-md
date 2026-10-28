import { expect, it } from "vitest";
import { action, loader } from "../../app/routes/$";

it("returns a small, inert 404 for unmatched reads and writes", async () => {
  for (const respond of [loader, action]) {
    const response = respond();
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("Not found\n");
  }
});
