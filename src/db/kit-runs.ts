import { getDb } from "./database.js";

export interface KitRun {
  id: string;
  brandId: string;
  logoId: string;
  status: "running" | "completed" | "failed";
  outputDir: string;
  fileCount: number;
  errors: string[];
  isFinal: boolean;
  notes?: string;
  createdAt: number;
  completedAt?: number;
}

function rowToRun(row: Record<string, unknown>): KitRun {
  return {
    id: row["id"] as string,
    brandId: row["brand_id"] as string,
    logoId: row["logo_id"] as string,
    status: row["status"] as KitRun["status"],
    outputDir: row["output_dir"] as string,
    fileCount: row["file_count"] as number,
    errors: JSON.parse((row["errors"] as string) || "[]"),
    isFinal: (row["is_final"] as number) === 1,
    notes: (row["notes"] as string) ?? undefined,
    createdAt: row["created_at"] as number,
    completedAt: (row["completed_at"] as number) ?? undefined,
  };
}

export function createKitRun(brandId: string, logoId: string, outputDir: string): KitRun {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO kit_runs (id, brand_id, logo_id, status, output_dir, created_at)
     VALUES (?, ?, ?, 'running', ?, ?)`,
    [id, brandId, logoId, outputDir, now]
  );

  return {
    id, brandId, logoId, status: "running", outputDir,
    fileCount: 0, errors: [], isFinal: false, createdAt: now,
  };
}

export function completeKitRun(id: string, fileCount: number, errors: string[]): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    "UPDATE kit_runs SET status = 'completed', file_count = ?, errors = ?, completed_at = ? WHERE id = ?",
    [fileCount, JSON.stringify(errors), now, id]
  );
}

export function failKitRun(id: string, errors: string[]): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    "UPDATE kit_runs SET status = 'failed', errors = ?, completed_at = ? WHERE id = ?",
    [JSON.stringify(errors), now, id]
  );
}

export function markKitRunFinal(id: string): void {
  const db = getDb();
  const run = getKitRun(id);
  if (!run) throw new Error(`Kit run not found: ${id}`);
  db.run("UPDATE kit_runs SET is_final = 0 WHERE brand_id = ?", [run.brandId]);
  db.run("UPDATE kit_runs SET is_final = 1 WHERE id = ?", [id]);
}

export function addKitRunNotes(id: string, notes: string): void {
  const db = getDb();
  db.run("UPDATE kit_runs SET notes = ? WHERE id = ?", [notes, id]);
}

export function getKitRun(id: string): KitRun | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM kit_runs WHERE id = ?").get(id) as Record<string, unknown> | null;
  return row ? rowToRun(row) : null;
}

export function listKitRuns(brandId: string): KitRun[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM kit_runs WHERE brand_id = ? ORDER BY created_at DESC"
  ).all(brandId) as Record<string, unknown>[];
  return rows.map(rowToRun);
}

export function getFinalKitRun(brandId: string): KitRun | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM kit_runs WHERE brand_id = ? AND is_final = 1 LIMIT 1"
  ).get(brandId) as Record<string, unknown> | null;
  return row ? rowToRun(row) : null;
}
