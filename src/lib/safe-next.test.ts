import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/app", "/app/settings?tab=security", "/ops/verify?next=%2Fops"])("allows %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "app",
    "/app\nSet-Cookie: x",
    "/" + "a".repeat(600),
    undefined,
    42,
  ])("refuses %s", (path) => {
    expect(safeNext(path)).toBe("/app");
  });

  it("uses the given fallback", () => expect(safeNext(null, "/ops")).toBe("/ops"));
});
