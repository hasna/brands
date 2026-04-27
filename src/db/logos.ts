import { getDb } from "./database.js";
import type { Logo, Provider, ImageFormat, LogoSource } from "../types/index.js";

function rowToLogo(row: Record<string, unknown>): Logo {
  return {
    id: row["id"] as string,
    brandId: (row["brand_id"] as string) ?? undefined,
    name: row["name"] as string,
    prompt: (row["prompt"] as string) ?? undefined,
    instructions: (row["instructions"] as string) ?? undefined,
    provider: row["provider"] as Provider,
    model: row["model"] as string,
    format: row["format"] as ImageFormat,
    filePath: row["file_path"] as string,
    svgPath: (row["svg_path"] as string) ?? undefined,
    width: (row["width"] as number) ?? undefined,
    height: (row["height"] as number) ?? undefined,
    metadata: JSON.parse((row["metadata"] as string) || "{}"),
    source: row["source"] as LogoSource,
    createdAt: row["created_at"] as number,
  };
}

export interface CreateLogoInput {
  name: string;
  brandId?: string;
  prompt?: string;
  instructions?: string;
  provider: Provider;
  model: string;
  format?: ImageFormat;
  filePath: string;
  svgPath?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
  source?: LogoSource;
}

export function createLogo(input: CreateLogoInput): Logo {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO logos (id, brand_id, name, prompt, instructions, provider, model, format, file_path, svg_path, width, height, metadata, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.brandId ?? null, input.name,
      input.prompt ?? null, input.instructions ?? null,
      input.provider, input.model, input.format ?? "png",
      input.filePath, input.svgPath ?? null,
      input.width ?? null, input.height ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.source ?? "generated", now,
    ]
  );

  return {
    id, brandId: input.brandId, name: input.name,
    prompt: input.prompt, instructions: input.instructions,
    provider: input.provider, model: input.model,
    format: input.format ?? "png", filePath: input.filePath,
    svgPath: input.svgPath, width: input.width, height: input.height,
    metadata: input.metadata ?? {}, source: input.source ?? "generated",
    createdAt: now,
  };
}

export function getLogo(id: string): Logo | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM logos WHERE id = ?").get(id) as Record<string, unknown> | null;
  return row ? rowToLogo(row) : null;
}

export function listLogos(filter?: { brandId?: string; provider?: Provider; source?: LogoSource }): Logo[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.brandId) {
    conditions.push("brand_id = ?");
    params.push(filter.brandId);
  }
  if (filter?.provider) {
    conditions.push("provider = ?");
    params.push(filter.provider);
  }
  if (filter?.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const stmt = db.prepare(`SELECT * FROM logos${where} ORDER BY created_at DESC`);
  const rows = (params.length ? stmt.all(...params as [string]) : stmt.all()) as Record<string, unknown>[];
  return rows.map(rowToLogo);
}

export function updateLogoSvgPath(id: string, svgPath: string): void {
  const db = getDb();
  db.run("UPDATE logos SET svg_path = ? WHERE id = ?", [svgPath, id]);
}

export function deleteLogo(id: string): void {
  const db = getDb();
  db.run("DELETE FROM logos WHERE id = ?", [id]);
}
