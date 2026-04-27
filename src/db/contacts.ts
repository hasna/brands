import { getDb } from "./database.js";

export interface BrandContact {
  id: string;
  brandId: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
  socialInstagram?: string;
  socialGithub?: string;
  tagline?: string;
  isDefault: boolean;
  createdAt: number;
}

export interface CreateContactInput {
  brandId: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
  socialInstagram?: string;
  socialGithub?: string;
  tagline?: string;
  isDefault?: boolean;
}

function rowToContact(row: Record<string, unknown>): BrandContact {
  return {
    id: row["id"] as string,
    brandId: row["brand_id"] as string,
    name: (row["name"] as string) ?? undefined,
    title: (row["title"] as string) ?? undefined,
    email: (row["email"] as string) ?? undefined,
    phone: (row["phone"] as string) ?? undefined,
    website: (row["website"] as string) ?? undefined,
    address: (row["address"] as string) ?? undefined,
    socialTwitter: (row["social_twitter"] as string) ?? undefined,
    socialLinkedin: (row["social_linkedin"] as string) ?? undefined,
    socialInstagram: (row["social_instagram"] as string) ?? undefined,
    socialGithub: (row["social_github"] as string) ?? undefined,
    tagline: (row["tagline"] as string) ?? undefined,
    isDefault: (row["is_default"] as number) === 1,
    createdAt: row["created_at"] as number,
  };
}

export function createContact(input: CreateContactInput): BrandContact {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const isDefault = input.isDefault !== false;

  if (isDefault) {
    db.run("UPDATE brand_contacts SET is_default = 0 WHERE brand_id = ?", [input.brandId]);
  }

  db.run(
    `INSERT INTO brand_contacts (id, brand_id, name, title, email, phone, website, address,
       social_twitter, social_linkedin, social_instagram, social_github, tagline, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.brandId, input.name ?? null, input.title ?? null,
      input.email ?? null, input.phone ?? null, input.website ?? null, input.address ?? null,
      input.socialTwitter ?? null, input.socialLinkedin ?? null,
      input.socialInstagram ?? null, input.socialGithub ?? null,
      input.tagline ?? null, isDefault ? 1 : 0, now,
    ]
  );

  return { id, ...input, isDefault, createdAt: now };
}

export function getDefaultContact(brandId: string): BrandContact | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM brand_contacts WHERE brand_id = ? AND is_default = 1 ORDER BY created_at DESC LIMIT 1"
  ).get(brandId) as Record<string, unknown> | null;
  return row ? rowToContact(row) : null;
}

export function listContacts(brandId: string): BrandContact[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM brand_contacts WHERE brand_id = ? ORDER BY is_default DESC, created_at DESC"
  ).all(brandId) as Record<string, unknown>[];
  return rows.map(rowToContact);
}

export function deleteContact(id: string): void {
  const db = getDb();
  db.run("DELETE FROM brand_contacts WHERE id = ?", [id]);
}
