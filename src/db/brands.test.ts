import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getDb, closeDb, resetDb } from "./database.js";
import { createBrand, getBrand, listBrands, updateBrand, deleteBrand } from "./brands.js";

describe("brands CRUD", () => {
  beforeEach(() => {
    resetDb();
    process.env["BRANDS_DB_PATH"] = ":memory:";
    getDb();
  });

  afterEach(() => {
    closeDb();
    delete process.env["BRANDS_DB_PATH"];
  });

  test("create and get brand", () => {
    const brand = createBrand({
      name: "Acme Corp",
      description: "A test brand",
      primaryColor: "#FF0000",
    });

    expect(brand.name).toBe("Acme Corp");
    expect(brand.slug).toBe("acme-corp");
    expect(brand.primaryColor).toBe("#FF0000");
    expect(brand.id).toBeDefined();

    const fetched = getBrand(brand.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Acme Corp");
  });

  test("get brand by slug", () => {
    createBrand({ name: "Test Brand" });
    const found = getBrand("test-brand");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Test Brand");
  });

  test("list brands", () => {
    createBrand({ name: "Brand A" });
    createBrand({ name: "Brand B" });

    const brands = listBrands();
    expect(brands.length).toBe(2);
  });

  test("update brand", () => {
    const brand = createBrand({ name: "Old Name" });
    const updated = updateBrand(brand.id, { name: "New Name", primaryColor: "#00FF00" });

    expect(updated.name).toBe("New Name");
    expect(updated.primaryColor).toBe("#00FF00");
  });

  test("delete brand", () => {
    const brand = createBrand({ name: "To Delete" });
    deleteBrand(brand.id);

    const fetched = getBrand(brand.id);
    expect(fetched).toBeNull();
  });

  test("slug generation", () => {
    const brand = createBrand({ name: "My Awesome Brand!" });
    expect(brand.slug).toBe("my-awesome-brand");
  });

  test("custom slug", () => {
    const brand = createBrand({ name: "Test", slug: "custom-slug" });
    expect(brand.slug).toBe("custom-slug");
  });
});
