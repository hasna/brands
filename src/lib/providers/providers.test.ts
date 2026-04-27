import { describe, test, expect } from "bun:test";
import { getProvider, listProviders, DEFAULT_MODELS } from "./index.js";

describe("providers registry", () => {
  test("list all providers", () => {
    const providers = listProviders();
    expect(providers).toContain("openai");
    expect(providers).toContain("gemini");
    expect(providers).toContain("bfl");
    expect(providers).toContain("quiver");
    expect(providers.length).toBe(4);
  });

  test("get each provider", () => {
    for (const name of listProviders()) {
      const provider = getProvider(name);
      expect(provider.name).toBe(name);
    }
  });

  test("quiver and gemini support SVG", () => {
    expect(getProvider("quiver").supportsSvg).toBe(true);
    expect(getProvider("gemini").supportsSvg).toBe(true);
  });

  test("openai and bfl do not support SVG", () => {
    expect(getProvider("openai").supportsSvg).toBe(false);
    expect(getProvider("bfl").supportsSvg).toBe(false);
  });

  test("default models are defined", () => {
    expect(DEFAULT_MODELS.openai).toBe("gpt-image-2");
    expect(DEFAULT_MODELS.gemini).toBe("gemini-3.1-flash-preview-image-generation");
    expect(DEFAULT_MODELS.bfl).toBe("flux.2-pro");
    expect(DEFAULT_MODELS.quiver).toBe("arrow-1.1");
  });

  test("unknown provider throws", () => {
    expect(() => getProvider("invalid" as "openai")).toThrow("Unknown provider");
  });
});
