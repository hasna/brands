import { getDb } from "./database.js";
import type { Palette } from "../types/index.js";

function rowToPalette(row: Record<string, unknown>): Palette {
  return {
    id: row["id"] as string,
    brandId: row["brand_id"] as string,
    name: row["name"] as string,
    colors: JSON.parse((row["colors"] as string) || "[]"),
    createdAt: row["created_at"] as number,
  };
}

export interface CreatePaletteInput {
  brandId: string;
  name: string;
  colors: string[];
}

export function createPalette(input: CreatePaletteInput): Palette {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    "INSERT INTO palettes (id, brand_id, name, colors, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.brandId, input.name, JSON.stringify(input.colors), now]
  );

  return { id, ...input, createdAt: now };
}

export function listPalettes(brandId: string): Palette[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM palettes WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as Record<string, unknown>[];
  return rows.map(rowToPalette);
}

export function deletePalette(id: string): void {
  const db = getDb();
  db.run("DELETE FROM palettes WHERE id = ?", [id]);
}
