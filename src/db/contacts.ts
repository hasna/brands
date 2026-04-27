import { getDb } from "./database.js";

export interface BrandContactLink {
  id: string;
  brandId: string;
  contactId: string;
  isDefault: boolean;
  createdAt: number;
}

export interface ResolvedBrandContact {
  contactId: string;
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
}

function rowToLink(row: Record<string, unknown>): BrandContactLink {
  return {
    id: row["id"] as string,
    brandId: row["brand_id"] as string,
    contactId: row["contact_id"] as string,
    isDefault: (row["is_default"] as number) === 1,
    createdAt: row["created_at"] as number,
  };
}

export function linkContact(brandId: string, contactId: string, isDefault: boolean = true): BrandContactLink {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  if (isDefault) {
    db.run("UPDATE brand_contacts SET is_default = 0 WHERE brand_id = ?", [brandId]);
  }

  db.run(
    "INSERT INTO brand_contacts (id, brand_id, contact_id, is_default, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, brandId, contactId, isDefault ? 1 : 0, now]
  );

  return { id, brandId, contactId, isDefault, createdAt: now };
}

export function getDefaultContactLink(brandId: string): BrandContactLink | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM brand_contacts WHERE brand_id = ? AND is_default = 1 ORDER BY created_at DESC LIMIT 1"
  ).get(brandId) as Record<string, unknown> | null;
  return row ? rowToLink(row) : null;
}

export function listContactLinks(brandId: string): BrandContactLink[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM brand_contacts WHERE brand_id = ? ORDER BY is_default DESC, created_at DESC"
  ).all(brandId) as Record<string, unknown>[];
  return rows.map(rowToLink);
}

export function unlinkContact(id: string): void {
  const db = getDb();
  db.run("DELETE FROM brand_contacts WHERE id = ?", [id]);
}

export async function resolveContact(contactId: string): Promise<ResolvedBrandContact | null> {
  try {
    const { getContact } = await import("@hasna/contacts");
    const contact = getContact(contactId);
    if (!contact) return null;

    const details = contact as unknown as {
      emails?: Array<{ address: string; is_primary: boolean }>;
      phones?: Array<{ number: string; is_primary: boolean }>;
      addresses?: Array<{ street?: string; city?: string; state?: string; zip?: string; country?: string; is_primary: boolean }>;
      social_profiles?: Array<{ platform: string; handle?: string; url?: string }>;
    };
    const emails = details.emails ?? [];
    const phones = details.phones ?? [];
    const addresses = details.addresses ?? [];
    const socials = details.social_profiles ?? [];

    const primaryEmail = emails.find(e => e.is_primary) ?? emails[0];
    const primaryPhone = phones.find(p => p.is_primary) ?? phones[0];
    const primaryAddress = addresses.find(a => a.is_primary) ?? addresses[0];

    const addressStr = primaryAddress
      ? [primaryAddress.street, primaryAddress.city, primaryAddress.state, primaryAddress.zip, primaryAddress.country].filter(Boolean).join(", ")
      : undefined;

    return {
      contactId,
      name: contact.display_name || `${contact.first_name} ${contact.last_name}`.trim(),
      title: contact.job_title ?? undefined,
      email: primaryEmail?.address,
      phone: primaryPhone?.number,
      website: contact.website ?? undefined,
      address: addressStr || undefined,
      socialTwitter: socials.find(s => s.platform === "twitter")?.handle ?? undefined,
      socialLinkedin: socials.find(s => s.platform === "linkedin")?.url ?? socials.find(s => s.platform === "linkedin")?.handle ?? undefined,
      socialInstagram: socials.find(s => s.platform === "instagram")?.handle ?? undefined,
      socialGithub: socials.find(s => s.platform === "github")?.handle ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveDefaultContact(brandId: string): Promise<ResolvedBrandContact | null> {
  const link = getDefaultContactLink(brandId);
  if (!link) return null;
  return resolveContact(link.contactId);
}
