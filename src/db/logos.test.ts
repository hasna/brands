import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getDb, closeDb, resetDb } from "./database.js";
import { createLogo, getLogo, listLogos, updateLogoSvgPath, deleteLogo } from "./logos.js";
import { createBrand } from "./brands.js";

describe("logos CRUD", () => {
  beforeEach(() => {
    resetDb();
    process.env["BRANDS_DB_PATH"] = ":memory:";
    getDb();
  });

  afterEach(() => {
    closeDb();
    delete process.env["BRANDS_DB_PATH"];
  });

  test("create and get logo", () => {
    const logo = createLogo({
      name: "Test Logo",
      provider: "openai",
      model: "gpt-image-2",
      format: "png",
      filePath: "/tmp/test.png",
      prompt: "a cool logo",
    });

    expect(logo.name).toBe("Test Logo");
    expect(logo.provider).toBe("openai");
    expect(logo.source).toBe("generated");

    const fetched = getLogo(logo.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.prompt).toBe("a cool logo");
  });

  test("create logo with brand", () => {
    const brand = createBrand({ name: "Test Brand" });
    const logo = createLogo({
      name: "Brand Logo",
      brandId: brand.id,
      provider: "quiver",
      model: "arrow-1.1",
      format: "svg",
      filePath: "/tmp/test.svg",
    });

    expect(logo.brandId).toBe(brand.id);
  });

  test("list logos with filters", () => {
    createLogo({ name: "Logo A", provider: "openai", model: "gpt-image-2", filePath: "/a.png" });
    createLogo({ name: "Logo B", provider: "gemini", model: "gemini-3.1", filePath: "/b.png" });
    createLogo({ name: "Logo C", provider: "openai", model: "gpt-image-2", filePath: "/c.png", source: "imported" });

    expect(listLogos().length).toBe(3);
    expect(listLogos({ provider: "openai" }).length).toBe(2);
    expect(listLogos({ source: "imported" }).length).toBe(1);
  });

  test("update SVG path", () => {
    const logo = createLogo({
      name: "Raster Logo",
      provider: "bfl",
      model: "flux.2-pro",
      filePath: "/tmp/test.png",
    });

    updateLogoSvgPath(logo.id, "/tmp/test.svg");

    const fetched = getLogo(logo.id);
    expect(fetched!.svgPath).toBe("/tmp/test.svg");
  });

  test("delete logo", () => {
    const logo = createLogo({
      name: "Delete Me",
      provider: "openai",
      model: "gpt-image-2",
      filePath: "/tmp/del.png",
    });

    deleteLogo(logo.id);
    expect(getLogo(logo.id)).toBeNull();
  });
});
