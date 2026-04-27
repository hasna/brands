import { getDb } from "./database.js";
import type { Brand } from "../types/index.js";

function rowToBrand(row: Record<string, unknown>): Brand {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    slug: row["slug"] as string,
    description: (row["description"] as string) ?? undefined,
    primaryColor: (row["primary_color"] as string) ?? undefined,
    secondaryColor: (row["secondary_color"] as string) ?? undefined,
    accentColor: (row["accent_color"] as string) ?? undefined,
    fontPrimary: (row["font_primary"] as string) ?? undefined,
    fontSecondary: (row["font_secondary"] as string) ?? undefined,
    metadata: JSON.parse((row["metadata"] as string) || "{}"),
    createdAt: row["created_at"] as number,
    updatedAt: row["updated_at"] as number,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface CreateBrandInput {
  name: string;
  slug?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontPrimary?: string;
  fontSecondary?: string;
  metadata?: Record<string, unknown>;
}

export function createBrand(input: CreateBrandInput): Brand {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const slug = input.slug || slugify(input.name);

  db.run(
    `INSERT INTO brands (id, name, slug, description, primary_color, secondary_color, accent_color, font_primary, font_secondary, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.name, slug, input.description ?? null,
      input.primaryColor ?? null, input.secondaryColor ?? null, input.accentColor ?? null,
      input.fontPrimary ?? null, input.fontSecondary ?? null,
      JSON.stringify(input.metadata ?? {}), now, now,
    ]
  );

  return {
    id, name: input.name, slug,
    description: input.description,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    accentColor: input.accentColor,
    fontPrimary: input.fontPrimary,
    fontSecondary: input.fontSecondary,
    metadata: input.metadata ?? {},
    createdAt: now, updatedAt: now,
  };
}

export function getBrand(id: string): Brand | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM brands WHERE id = ? OR slug = ?").get(id, id) as Record<string, unknown> | null;
  return row ? rowToBrand(row) : null;
}

export function listBrands(): Brand[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM brands ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToBrand);
}

export function updateBrand(id: string, patch: Partial<CreateBrandInput>): Brand {
  const existing = getBrand(id);
  if (!existing) throw new Error(`Brand not found: ${id}`);

  const db = getDb();
  const now = Date.now();

  db.run(
    `UPDATE brands SET
       name = ?, slug = ?, description = ?,
       primary_color = ?, secondary_color = ?, accent_color = ?,
       font_primary = ?, font_secondary = ?, metadata = ?, updated_at = ?
     WHERE id = ?`,
    [
      patch.name ?? existing.name,
      patch.slug ?? existing.slug,
      patch.description ?? existing.description ?? null,
      patch.primaryColor ?? existing.primaryColor ?? null,
      patch.secondaryColor ?? existing.secondaryColor ?? null,
      patch.accentColor ?? existing.accentColor ?? null,
      patch.fontPrimary ?? existing.fontPrimary ?? null,
      patch.fontSecondary ?? existing.fontSecondary ?? null,
      JSON.stringify(patch.metadata ?? existing.metadata),
      now, existing.id,
    ]
  );

  return { ...existing, ...patch, updatedAt: now };
}

export function deleteBrand(id: string): void {
  const db = getDb();
  db.run("DELETE FROM brands WHERE id = ? OR slug = ?", [id, id]);
}
