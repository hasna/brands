import { Database } from "bun:sqlite";

export function ensureSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      accent_color TEXT,
      font_primary TEXT,
      font_secondary TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS logos (
      id TEXT PRIMARY KEY,
      brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      prompt TEXT,
      instructions TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'png',
      file_path TEXT NOT NULL,
      svg_path TEXT,
      width INTEGER,
      height INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'generated',
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      logo_id TEXT NOT NULL REFERENCES logos(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      format TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS palettes (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      colors TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      logo_id TEXT REFERENCES logos(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      instructions TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      params TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      credits_used INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS training_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'bfl',
      logo_ids TEXT NOT NULL DEFAULT '[]',
      brains_model_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_logos_brand_id ON logos(brand_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_logos_provider ON logos(provider)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_assets_logo_id ON assets(logo_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_palettes_brand_id ON palettes(brand_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status)");
}
