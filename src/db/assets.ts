import { getDb } from "./database.js";
import type { Asset, ImageFormat } from "../types/index.js";

function rowToAsset(row: Record<string, unknown>): Asset {
  return {
    id: row["id"] as string,
    logoId: row["logo_id"] as string,
    purpose: row["purpose"] as string,
    width: row["width"] as number,
    height: row["height"] as number,
    format: row["format"] as ImageFormat,
    filePath: row["file_path"] as string,
    createdAt: row["created_at"] as number,
  };
}

export interface CreateAssetInput {
  logoId: string;
  purpose: string;
  width: number;
  height: number;
  format: ImageFormat;
  filePath: string;
}

export function createAsset(input: CreateAssetInput): Asset {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO assets (id, logo_id, purpose, width, height, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.logoId, input.purpose, input.width, input.height, input.format, input.filePath, now]
  );

  return { id, ...input, createdAt: now };
}

export function listAssets(logoId: string): Asset[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM assets WHERE logo_id = ? ORDER BY width ASC").all(logoId) as Record<string, unknown>[];
  return rows.map(rowToAsset);
}

export function deleteAssets(logoId: string): void {
  const db = getDb();
  db.run("DELETE FROM assets WHERE logo_id = ?", [logoId]);
}

export function getAsset(id: string): Asset | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as Record<string, unknown> | null;
  return row ? rowToAsset(row) : null;
}
