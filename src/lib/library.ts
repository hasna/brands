import { copyFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { importsDir } from "../db/database.js";
import { createLogo } from "../db/logos.js";
import type { Logo, ImageFormat } from "../types/index.js";

export async function importFromFile(
  filePath: string,
  options?: { name?: string; brandId?: string },
): Promise<Logo> {
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const ext = extname(filePath).slice(1).toLowerCase();
  const validFormats = ["png", "svg", "webp", "jpg", "jpeg", "ico"];
  if (!validFormats.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${validFormats.join(", ")}`);
  }

  const id = crypto.randomUUID();
  const normalizedExt = ext === "jpeg" ? "jpg" : ext;
  const destPath = join(importsDir(), `${id}.${normalizedExt}`);
  copyFileSync(filePath, destPath);

  const format = normalizedExt as ImageFormat;
  const name = options?.name || basename(filePath, `.${ext}`);

  return createLogo({
    name,
    brandId: options?.brandId,
    provider: "openai",
    model: "imported",
    format,
    filePath: destPath,
    svgPath: format === "svg" ? destPath : undefined,
    source: "imported",
    metadata: { originalPath: filePath },
  });
}

export async function importFromUrl(
  url: string,
  options?: { name?: string; brandId?: string },
): Promise<Logo> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${url}`);

  const contentType = response.headers.get("content-type") || "";
  let format: ImageFormat = "png";
  if (contentType.includes("svg")) format = "svg";
  else if (contentType.includes("webp")) format = "webp";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) format = "jpg";

  const id = crypto.randomUUID();
  const destPath = join(importsDir(), `${id}.${format}`);
  const data = Buffer.from(await response.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(destPath, data);

  const name = options?.name || new URL(url).pathname.split("/").pop()?.replace(/\.[^.]+$/, "") || "imported";

  return createLogo({
    name,
    brandId: options?.brandId,
    provider: "openai",
    model: "imported",
    format,
    filePath: destPath,
    svgPath: format === "svg" ? destPath : undefined,
    source: "imported",
    metadata: { sourceUrl: url },
  });
}
