import { describe, test, expect } from "bun:test";
import { getPresetSizes, getAllPresetSizes, PRESETS } from "./export.js";

describe("export presets", () => {
  test("favicon preset has correct sizes", () => {
    const sizes = getPresetSizes("favicon");
    expect(sizes.length).toBe(7);
    expect(sizes.some(s => s.purpose === "favicon-16")).toBe(true);
    expect(sizes.some(s => s.purpose === "favicon-32")).toBe(true);
    expect(sizes.some(s => s.purpose === "apple-touch-icon")).toBe(true);
    expect(sizes.some(s => s.purpose === "android-512")).toBe(true);
  });

  test("social preset has correct sizes", () => {
    const sizes = getPresetSizes("social");
    expect(sizes.length).toBe(5);
    expect(sizes.some(s => s.purpose === "og-image")).toBe(true);
    expect(sizes.some(s => s.purpose === "twitter-banner")).toBe(true);
  });

  test("app preset has iOS and Android sizes", () => {
    const sizes = getPresetSizes("app");
    expect(sizes.some(s => s.purpose.startsWith("ios-"))).toBe(true);
    expect(sizes.some(s => s.purpose.startsWith("android-"))).toBe(true);
  });

  test("all preset returns deduplicated sizes", () => {
    const all = getAllPresetSizes();
    const allFromPreset = getPresetSizes("all");
    expect(all.length).toBe(allFromPreset.length);
    expect(all.length).toBeGreaterThan(0);

    const purposes = all.map(s => `${s.purpose}-${s.width}x${s.height}`);
    const unique = new Set(purposes);
    expect(purposes.length).toBe(unique.size);
  });

  test("unknown preset throws", () => {
    expect(() => getPresetSizes("nonexistent")).toThrow("Unknown preset");
  });

  test("all presets defined", () => {
    expect(Object.keys(PRESETS)).toContain("favicon");
    expect(Object.keys(PRESETS)).toContain("social");
    expect(Object.keys(PRESETS)).toContain("app");
    expect(Object.keys(PRESETS)).toContain("shortcut");
  });
});
