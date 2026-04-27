import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ensureSchema } from "./schema.js";

describe("database schema", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    ensureSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  test("creates all tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("brands");
    expect(tableNames).toContain("logos");
    expect(tableNames).toContain("assets");
    expect(tableNames).toContain("palettes");
    expect(tableNames).toContain("generations");
    expect(tableNames).toContain("training_sets");
  });

  test("ensureSchema is idempotent", () => {
    ensureSchema(db);
    ensureSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.length).toBeGreaterThan(0);
  });

  test("creates indexes", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];

    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_logos_brand_id");
    expect(names).toContain("idx_logos_provider");
    expect(names).toContain("idx_assets_logo_id");
    expect(names).toContain("idx_palettes_brand_id");
    expect(names).toContain("idx_generations_status");
  });

  test("foreign keys work", () => {
    const now = Date.now();
    db.run(
      "INSERT INTO brands (id, name, slug, metadata, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)",
      ["b1", "Test", "test", now, now]
    );

    db.run(
      "INSERT INTO logos (id, brand_id, name, provider, model, format, file_path, metadata, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 'generated', ?)",
      ["l1", "b1", "Logo", "openai", "gpt-image-2", "png", "/tmp/test.png", now]
    );

    const logo = db.prepare("SELECT * FROM logos WHERE id = 'l1'").get() as Record<string, unknown>;
    expect(logo["brand_id"]).toBe("b1");
  });
});
