import { getDb } from "./database.js";
import type { Generation, GenerationStatus, Provider } from "../types/index.js";

function rowToGeneration(row: Record<string, unknown>): Generation {
  return {
    id: row["id"] as string,
    logoId: (row["logo_id"] as string) ?? undefined,
    provider: row["provider"] as Provider,
    model: row["model"] as string,
    prompt: row["prompt"] as string,
    instructions: (row["instructions"] as string) ?? undefined,
    status: row["status"] as GenerationStatus,
    params: JSON.parse((row["params"] as string) || "{}"),
    error: (row["error"] as string) ?? undefined,
    creditsUsed: (row["credits_used"] as number) ?? undefined,
    createdAt: row["created_at"] as number,
    completedAt: (row["completed_at"] as number) ?? undefined,
  };
}

export interface CreateGenerationInput {
  provider: Provider;
  model: string;
  prompt: string;
  instructions?: string;
  params?: Record<string, unknown>;
}

export function createGeneration(input: CreateGenerationInput): Generation {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO generations (id, provider, model, prompt, instructions, status, params, created_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
    [id, input.provider, input.model, input.prompt, input.instructions ?? null, JSON.stringify(input.params ?? {}), now]
  );

  return {
    id, provider: input.provider, model: input.model,
    prompt: input.prompt, instructions: input.instructions,
    status: "running", params: input.params ?? {},
    createdAt: now,
  };
}

export function completeGeneration(id: string, logoId: string, creditsUsed?: number): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    "UPDATE generations SET status = 'completed', logo_id = ?, credits_used = ?, completed_at = ? WHERE id = ?",
    [logoId, creditsUsed ?? null, now, id]
  );
}

export function failGeneration(id: string, error: string): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    "UPDATE generations SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
    [error, now, id]
  );
}

export function listGenerations(filter?: { status?: GenerationStatus; provider?: Provider }): Generation[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status) {
    conditions.push("status = ?");
    params.push(filter.status);
  }
  if (filter?.provider) {
    conditions.push("provider = ?");
    params.push(filter.provider);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const stmt = db.prepare(`SELECT * FROM generations${where} ORDER BY created_at DESC`);
  const rows = (params.length ? stmt.all(...params as [string]) : stmt.all()) as Record<string, unknown>[];
  return rows.map(rowToGeneration);
}
