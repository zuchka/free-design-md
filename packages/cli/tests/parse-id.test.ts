import { describe, expect, it } from "vitest";
import { parseId } from "../src/parse-id.js";

describe("parseId", () => {
  it("returns a bare nanoid as-is", () => {
    expect(parseId("abc123XYZ_-")).toBe("abc123XYZ_-");
  });

  it("returns a catalog slug as-is", () => {
    expect(parseId("stripe")).toBe("stripe");
  });

  it("returns a dotted catalog slug as-is", () => {
    expect(parseId("linear.app")).toBe("linear.app");
  });

  it("extracts id from a share URL with /d/<id>", () => {
    expect(parseId("https://free-design-md.example.com/d/abc123xyz")).toBe(
      "abc123xyz",
    );
  });

  it("extracts id from a share URL with trailing slash", () => {
    expect(parseId("https://free-design-md.example.com/d/abc123xyz/")).toBe(
      "abc123xyz",
    );
  });

  it("extracts id from a share URL with query string", () => {
    expect(
      parseId("https://free-design-md.example.com/d/abc123xyz?ref=cli"),
    ).toBe("abc123xyz");
  });

  it("rejects empty input", () => {
    expect(() => parseId("")).toThrow(/required/i);
  });

  it("rejects an http URL that is not a /d/<id> path", () => {
    expect(() => parseId("https://free-design-md.example.com/other")).toThrow(
      /could not extract/i,
    );
  });

  it("rejects a string with disallowed characters", () => {
    expect(() => parseId("has spaces")).toThrow(/invalid/i);
  });
});
