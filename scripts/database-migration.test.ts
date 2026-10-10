import { describe, expect, it } from "vitest";
import { digestRows } from "./database-migration.js";

describe("migration row digests", () => {
  it("is independent of database collation order", () => {
    const uppercaseFirst = [
      { id: "A-item", value: "one" },
      { id: "a-item", value: "two" },
    ];
    const lowercaseFirst = [...uppercaseFirst].reverse();

    expect(digestRows(uppercaseFirst, ["id", "value"])).toBe(
      digestRows(lowercaseFirst, ["id", "value"]),
    );
  });

  it("still changes when row content changes", () => {
    expect(digestRows([{ id: "one" }], ["id"])).not.toBe(
      digestRows([{ id: "two" }], ["id"]),
    );
  });
});
