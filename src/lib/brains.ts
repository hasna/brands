import { getDb } from "../db/database.js";
import { getLogo } from "../db/logos.js";
import type { TrainingSet } from "../types/index.js";

function rowToTrainingSet(row: Record<string, unknown>): TrainingSet {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    provider: row["provider"] as string,
    logoIds: JSON.parse((row["logo_ids"] as string) || "[]"),
    brainsModelId: (row["brains_model_id"] as string) ?? undefined,
    status: row["status"] as string,
    createdAt: row["created_at"] as number,
  };
}

export interface CreateTrainingSetInput {
  name: string;
  logoIds: string[];
  provider?: string;
}

export function createTrainingSet(input: CreateTrainingSetInput): TrainingSet {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  for (const logoId of input.logoIds) {
    const logo = getLogo(logoId);
    if (!logo) throw new Error(`Logo not found: ${logoId}`);
  }

  db.run(
    "INSERT INTO training_sets (id, name, provider, logo_ids, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    [id, input.name, input.provider ?? "bfl", JSON.stringify(input.logoIds), now]
  );

  return {
    id, name: input.name,
    provider: input.provider ?? "bfl",
    logoIds: input.logoIds,
    status: "pending", createdAt: now,
  };
}

export function getTrainingSet(id: string): TrainingSet | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_sets WHERE id = ?").get(id) as Record<string, unknown> | null;
  return row ? rowToTrainingSet(row) : null;
}

export function listTrainingSets(): TrainingSet[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM training_sets ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToTrainingSet);
}

export function updateTrainingSetStatus(id: string, status: string, brainsModelId?: string): void {
  const db = getDb();
  if (brainsModelId) {
    db.run("UPDATE training_sets SET status = ?, brains_model_id = ? WHERE id = ?", [status, brainsModelId, id]);
  } else {
    db.run("UPDATE training_sets SET status = ? WHERE id = ?", [status, id]);
  }
}
