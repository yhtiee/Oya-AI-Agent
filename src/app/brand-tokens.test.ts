import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import brand from "../../config/oya-brand.json";

// Keeps globals.css and config/oya-brand.json from drifting apart (SPEC §14.6, Appendix E).
describe("brand tokens", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("defines every colour token from oya-brand.json with the same value", () => {
    const colorVars = Object.entries(brand.cssVariables).filter(([, v]) => v.startsWith("#"));
    expect(colorVars.length).toBeGreaterThan(0);
    for (const [name, hex] of colorVars) {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m?.[1]?.toLowerCase(), name).toBe(hex.toLowerCase());
    }
  });

  it("never uses pure white or black", () => {
    expect(css).not.toMatch(/#fff(fff)?\b/i);
    expect(css).not.toMatch(/#000(000)?\b/i);
  });
});
