import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportsDir } from "../db/database.js";
import { createAsset } from "../db/assets.js";
import type { ExportPreset, ExportSize, Logo, Asset } from "../types/index.js";

export const PRESETS: Record<string, ExportPreset> = {
  favicon: {
    name: "favicon",
    sizes: [
      { purpose: "favicon-16", width: 16, height: 16, format: "png" },
      { purpose: "favicon-32", width: 32, height: 32, format: "png" },
      { purpose: "favicon-48", width: 48, height: 48, format: "png" },
      { purpose: "apple-touch-icon", width: 180, height: 180, format: "png" },
      { purpose: "android-192", width: 192, height: 192, format: "png" },
      { purpose: "android-512", width: 512, height: 512, format: "png" },
      { purpose: "favicon-ico", width: 32, height: 32, format: "ico" },
    ],
  },
  social: {
    name: "social",
    sizes: [
      { purpose: "profile-400", width: 400, height: 400, format: "png" },
      { purpose: "og-image", width: 1200, height: 630, format: "png" },
      { purpose: "twitter-banner", width: 1500, height: 500, format: "png" },
      { purpose: "instagram-square", width: 800, height: 800, format: "png" },
      { purpose: "linkedin-banner", width: 1584, height: 396, format: "png" },
    ],
  },
  app: {
    name: "app",
    sizes: [
      { purpose: "ios-29", width: 29, height: 29, format: "png" },
      { purpose: "ios-40", width: 40, height: 40, format: "png" },
      { purpose: "ios-60", width: 60, height: 60, format: "png" },
      { purpose: "ios-76", width: 76, height: 76, format: "png" },
      { purpose: "ios-1024", width: 1024, height: 1024, format: "png" },
      { purpose: "android-48", width: 48, height: 48, format: "png" },
      { purpose: "android-72", width: 72, height: 72, format: "png" },
      { purpose: "android-96", width: 96, height: 96, format: "png" },
      { purpose: "android-144", width: 144, height: 144, format: "png" },
      { purpose: "android-192", width: 192, height: 192, format: "png" },
      { purpose: "android-512", width: 512, height: 512, format: "png" },
    ],
  },
  shortcut: {
    name: "shortcut",
    sizes: [
      { purpose: "shortcut-96", width: 96, height: 96, format: "png" },
      { purpose: "shortcut-128", width: 128, height: 128, format: "png" },
      { purpose: "shortcut-144", width: 144, height: 144, format: "png" },
      { purpose: "shortcut-192", width: 192, height: 192, format: "png" },
      { purpose: "shortcut-256", width: 256, height: 256, format: "png" },
      { purpose: "shortcut-512", width: 512, height: 512, format: "png" },
    ],
  },
};

export function getAllPresetSizes(): ExportSize[] {
  const seen = new Set<string>();
  const sizes: ExportSize[] = [];

  for (const preset of Object.values(PRESETS)) {
    for (const size of preset.sizes) {
      const key = `${size.purpose}-${size.width}x${size.height}`;
      if (!seen.has(key)) {
        seen.add(key);
        sizes.push(size);
      }
    }
  }

  return sizes;
}

export async function exportLogo(
  logo: Logo,
  sizes: ExportSize[],
  outputDir?: string,
): Promise<Asset[]> {
  const sharp = (await import("sharp")).default;
  const dir = outputDir || join(exportsDir(), logo.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sourceData = readFileSync(logo.filePath);
  const assets: Asset[] = [];

  for (const size of sizes) {
    const filename = `${size.purpose}.${size.format}`;
    const filePath = join(dir, filename);

    if (size.format === "ico") {
      const pngBuf = await sharp(sourceData)
        .resize(size.width, size.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      writeFileSync(filePath.replace(/\.ico$/, ".png"), pngBuf);

      const asset = createAsset({
        logoId: logo.id,
        purpose: size.purpose,
        width: size.width,
        height: size.height,
        format: "png",
        filePath: filePath.replace(/\.ico$/, ".png"),
      });
      assets.push(asset);
      continue;
    }

    let pipeline = sharp(sourceData).resize(size.width, size.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    if (size.format === "png") pipeline = pipeline.png();
    else if (size.format === "webp") pipeline = pipeline.webp();
    else if (size.format === "jpg") pipeline = pipeline.jpeg();

    const buf = await pipeline.toBuffer();
    writeFileSync(filePath, buf);

    const asset = createAsset({
      logoId: logo.id,
      purpose: size.purpose,
      width: size.width,
      height: size.height,
      format: size.format,
      filePath,
    });
    assets.push(asset);
  }

  return assets;
}

export function getPresetSizes(presetName: string): ExportSize[] {
  if (presetName === "all") return getAllPresetSizes();
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(", ")}, all`);
  return preset.sizes;
}
