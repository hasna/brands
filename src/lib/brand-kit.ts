import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../db/database.js";
import { getBrand, updateBrand } from "../db/brands.js";
import { getLogo, listLogos } from "../db/logos.js";
import { resolveDefaultContact } from "../db/contacts.js";
import { createKitRun, completeKitRun, failKitRun } from "../db/kit-runs.js";
import { generate } from "./generate.js";
import { OpenAIProvider } from "./providers/openai.js";
import { QuiverProvider } from "./providers/quiver.js";
import {
  removeWhiteBackground,
  recolorToBlack,
  recolorToWhite,
  recolorToColor,
  compositeOnBackground,
  compositeOnBackgroundJpeg,
  resizePng,
} from "./image-processing.js";
import type { Logo } from "../types/index.js";

export interface BrandKitOptions {
  brandId: string;
  logoId: string;
  contactInfo?: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
  };
  skipBusinessCards?: boolean;
  skipSocialCovers?: boolean;
}

export interface BrandKitResult {
  outputDir: string;
  files: string[];
  errors: string[];
  runId: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function kitDir(slug: string): string {
  const dir = join(dataDir(), "kits", slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureSubdir(base: string, ...parts: string[]): string {
  const dir = join(base, ...parts);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function write(dir: string, filename: string, data: Buffer | string): string {
  const filePath = join(dir, filename);
  writeFileSync(filePath, data);
  return filePath;
}

async function vectorizeBuffer(pngBuffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const resized = await sharp(pngBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    const quiver = new QuiverProvider();
    const tmpPath = join(dataDir(), `_tmp_vectorize_${Date.now()}.png`);
    writeFileSync(tmpPath, resized);

    const result = await quiver.vectorize({ imagePath: tmpPath, autoCrop: true });

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync(tmpPath); } catch {}

    return result.svg;
  } catch (err) {
    console.error(`  Vectorization failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function generateVariants(
  brandId: string,
  prompt: string,
  count: number = 4,
  instructions?: string,
): Promise<Logo[]> {
  const brand = getBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const colorHint = [brand.primaryColor, brand.secondaryColor, brand.accentColor]
    .filter(Boolean)
    .join(", ");

  const fullInstructions = [
    instructions || "Modern, clean, flat design. Icon only, no text. Suitable for app icons and favicons.",
    colorHint ? `Use these brand colors: ${colorHint}` : "",
    "White background. Square 1:1 aspect ratio.",
    "IMPORTANT: The logo/icon must fill approximately 85% of the canvas. Make it large and prominent — edge to edge with minimal padding. Do NOT make it small and centered with lots of whitespace.",
  ]
    .filter(Boolean)
    .join(" ");

  const concurrency = Math.min(count, 4);
  const logos: Logo[] = [];

  for (let batch = 0; batch < count; batch += concurrency) {
    const batchSize = Math.min(concurrency, count - batch);
    const promises = Array.from({ length: batchSize }, (_, i) => {
      const idx = batch + i + 1;
      return generate({
        prompt,
        provider: "openai",
        instructions: fullInstructions,
        name: `${brand.slug}-variant-${idx}`,
        brandId: brand.id,
      }).catch((err) => {
        console.error(`Variant ${idx} failed: ${err instanceof Error ? err.message : err}`);
        return null;
      });
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) logos.push(r);
    }
  }

  return logos;
}

export function selectLogo(brandId: string, logoId: string): void {
  const brand = getBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);
  const logo = getLogo(logoId);
  if (!logo) throw new Error(`Logo not found: ${logoId}`);

  updateBrand(brand.id, {
    metadata: { ...brand.metadata, selectedLogoId: logoId },
  });
}

export function getSelectedLogo(brandId: string): Logo | null {
  const brand = getBrand(brandId);
  if (!brand) return null;
  const selectedId = brand.metadata?.["selectedLogoId"] as string | undefined;
  if (selectedId) {
    const logo = getLogo(selectedId);
    if (logo) return logo;
  }
  const logos = listLogos({ brandId: brand.id });
  return logos[0] ?? null;
}

export async function buildBrandKit(options: BrandKitOptions): Promise<BrandKitResult> {
  const brand = getBrand(options.brandId);
  if (!brand) throw new Error(`Brand not found: ${options.brandId}`);

  const logo = getLogo(options.logoId);
  if (!logo) throw new Error(`Logo not found: ${options.logoId}`);

  const contactInfo = options.contactInfo ?? await (async () => {
    const resolved = await resolveDefaultContact(brand.id);
    if (!resolved) return undefined;
    return {
      name: resolved.name, title: resolved.title, email: resolved.email,
      phone: resolved.phone, website: resolved.website, address: resolved.address,
    };
  })();

  const skipCards = options.skipBusinessCards ?? !contactInfo;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const root = join(kitDir(brand.slug), timestamp);
  if (!existsSync(root)) mkdirSync(root, { recursive: true });

  const run = createKitRun(brand.id, logo.id, root);
  const files: string[] = [];
  const errors: string[] = [];

  const primaryColor = brand.primaryColor || "#6366F1";
  const secondaryColor = brand.secondaryColor || "#818CF8";
  const accentColor = brand.accentColor || "#F59E0B";
  const darkColor = "#1a1a2e";

  const primaryRgb = hexToRgb(primaryColor);
  void secondaryColor;
  const accentRgb = hexToRgb(accentColor);
  const darkRgb = hexToRgb(darkColor);
  const blackRgb = { r: 0, g: 0, b: 0 };
  const whiteRgb = { r: 255, g: 255, b: 255 };

  // ── Step 1: Remove background ──────────────────────────────────────────────
  console.log("  Removing background...");
  let transparent: Buffer;
  try {
    transparent = await removeWhiteBackground(logo.filePath);
  } catch (err) {
    throw new Error(`Background removal failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── Step 2: Create color variants ──────────────────────────────────────────
  console.log("  Creating color variants...");
  const blackVariant = await recolorToBlack(transparent);
  const whiteVariant = await recolorToWhite(transparent);
  const colorVariant = await recolorToColor(transparent, primaryColor);
  const darkVariant = await recolorToColor(transparent, darkColor);

  const variants = {
    original: transparent,
    black: blackVariant,
    white: whiteVariant,
    color: colorVariant,
    dark: darkVariant,
  };

  // ── Step 3: Save PNG Symbol variants ───────────────────────────────────────
  console.log("  Saving PNG symbols...");
  const pngSymbolDir = ensureSubdir(root, "Logo", "PNG", "Symbol");
  for (const [name, buf] of Object.entries(variants)) {
    const resized = await resizePng(buf, 1024, 1024);
    files.push(write(pngSymbolDir, `${brand.slug}-symbol-${name}@2x.png`, resized));
  }

  // ── Step 4: Vectorize to SVG ───────────────────────────────────────────────
  console.log("  Vectorizing to SVG...");
  const svgSymbolDir = ensureSubdir(root, "Logo", "SVG", "Symbol");
  for (const [name, buf] of Object.entries(variants)) {
    const onWhiteBg = await compositeOnBackground(buf, whiteRgb, 512, 512, 0.1);
    const svg = await vectorizeBuffer(onWhiteBg);
    if (svg) {
      files.push(write(svgSymbolDir, `${brand.slug}-symbol-${name}.svg`, svg));
    } else {
      errors.push(`SVG vectorization failed for ${name} variant`);
    }
  }

  // ── Step 5: Social Media Avatars ───────────────────────────────────────────
  console.log("  Creating social media avatars...");
  const avatarDir = ensureSubdir(root, "Social Media", "Avatar");
  const avatarSize = 800;

  const avatarCombos: Array<{ name: string; logoBuf: Buffer; bg: { r: number; g: number; b: number }; ext: string }> = [
    { name: "black-transparent", logoBuf: blackVariant, bg: { r: 0, g: 0, b: 0 }, ext: "png" },
    { name: "white-transparent", logoBuf: whiteVariant, bg: { r: 0, g: 0, b: 0 }, ext: "png" },
    { name: "dark-transparent", logoBuf: darkVariant, bg: { r: 0, g: 0, b: 0 }, ext: "png" },
    { name: "color-transparent", logoBuf: colorVariant, bg: { r: 0, g: 0, b: 0 }, ext: "png" },
    { name: "black-bg-w", logoBuf: blackVariant, bg: whiteRgb, ext: "jpg" },
    { name: "white-bg-d", logoBuf: whiteVariant, bg: darkRgb, ext: "jpg" },
    { name: "dark-bg-y", logoBuf: darkVariant, bg: accentRgb, ext: "jpg" },
    { name: "color-bg-d", logoBuf: colorVariant, bg: darkRgb, ext: "jpg" },
    { name: "white-bg-b", logoBuf: whiteVariant, bg: blackRgb, ext: "jpg" },
    { name: "color-bg-w", logoBuf: colorVariant, bg: whiteRgb, ext: "jpg" },
  ];

  for (const combo of avatarCombos) {
    if (combo.ext === "png") {
      const resized = await resizePng(combo.logoBuf, avatarSize, avatarSize);
      files.push(write(avatarDir, `${combo.name}@2x.png`, resized));
    } else {
      const composed = await compositeOnBackgroundJpeg(combo.logoBuf, combo.bg, avatarSize, avatarSize);
      files.push(write(avatarDir, `${combo.name}@2x.jpg`, composed));
    }
  }

  // ── Step 6: Favicon + App Icons ────────────────────────────────────────────
  console.log("  Creating icons...");
  const faviconDir = ensureSubdir(root, "Icons", "Favicon");
  const appDir = ensureSubdir(root, "Icons", "App");
  const shortcutDir = ensureSubdir(root, "Icons", "Shortcut");

  const faviconSizes = [16, 32, 48, 64, 128, 180, 192, 512];
  for (const size of faviconSizes) {
    const resized = await resizePng(transparent, size, size);
    files.push(write(faviconDir, `favicon-${size}.png`, resized));
  }

  const iosSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
  for (const size of iosSizes) {
    const resized = await resizePng(transparent, size, size);
    files.push(write(appDir, `ios-${size}.png`, resized));
  }

  const androidSizes = [36, 48, 72, 96, 144, 192, 512];
  for (const size of androidSizes) {
    const resized = await resizePng(transparent, size, size);
    files.push(write(appDir, `android-${size}.png`, resized));
  }

  const shortcutSizes = [96, 128, 144, 192, 256, 512];
  for (const size of shortcutSizes) {
    const onBlack = await compositeOnBackground(transparent, blackRgb, size, size);
    files.push(write(shortcutDir, `shortcut-black-${size}.png`, onBlack));
    const onColor = await compositeOnBackground(transparent, primaryRgb, size, size);
    files.push(write(shortcutDir, `shortcut-color-${size}.png`, onColor));
    const onWhite = await compositeOnBackground(transparent, whiteRgb, size, size);
    files.push(write(shortcutDir, `shortcut-white-${size}.png`, onWhite));
  }

  // ── Step 7: Social Covers (with logo reference) ────────────────────────────
  if (!options.skipSocialCovers) {
    console.log("  Generating social covers (with logo reference)...");
    const twitterDir = ensureSubdir(root, "Social Media", "Twitter");
    const linkedinDir = ensureSubdir(root, "Social Media", "LinkedIn");

    const openai = new OpenAIProvider();
    const { readFileSync } = await import("node:fs");
    const logoRef = readFileSync(logo.filePath);

    try {
      const coverPrompt = `Design a professional social media banner for the company "${brand.name}". ${brand.description || ""}. Use the provided logo — place it on the right side of the banner. Use exactly these brand colors: primary ${primaryColor}, secondary ${secondaryColor}, accent ${accentColor}. Modern, clean, professional tech aesthetic. Landscape orientation, minimal text. The logo in the reference image MUST appear in the banner.`;

      const twitterResult = await openai.generateWithReferences(
        `Twitter/X header banner. ${coverPrompt}`,
        [logoRef],
        { size: "1536x640" },
      );
      files.push(write(twitterDir, "cover@2x.png", twitterResult.data));

      const linkedinResult = await openai.generateWithReferences(
        `LinkedIn page banner. ${coverPrompt}`,
        [logoRef],
        { size: "1536x640" },
      );
      files.push(write(linkedinDir, "cover@2x.png", linkedinResult.data));
    } catch (err) {
      errors.push(`Social covers failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Step 8: Business Cards (with logo reference) ──────────────────────────
  if (!skipCards && contactInfo) {
    console.log("  Generating business cards (with logo reference)...");
    const cardDir = ensureSubdir(root, "Business Card");
    const ci = contactInfo;

    const openai = new OpenAIProvider();
    const { readFileSync } = await import("node:fs");
    const logoRef = readFileSync(logo.filePath);

    const contactLines = [ci.name, ci.title, ci.email, ci.phone, ci.website, ci.address]
      .filter(Boolean)
      .join("\n");

    try {
      const frontResult = await openai.generateWithReferences(
        `Design a professional business card FRONT for "${brand.name}". Use the provided logo — place it in the top-left corner. Use exactly these brand colors: primary ${primaryColor}, secondary ${secondaryColor}, accent ${accentColor}. White background with subtle brand color accents.\n\nInclude this contact information exactly as written, with perfect legible typography:\n${contactLines}\n\nBusiness card proportions (3.5x2 inches). Print-ready, high quality. The logo from the reference MUST appear on the card exactly as-is.`,
        [logoRef],
        { size: "1792x1024" },
      );
      files.push(write(cardDir, "front.png", frontResult.data));

      const frontSvg = await vectorizeBuffer(frontResult.data);
      if (frontSvg) files.push(write(cardDir, "front.svg", frontSvg));

      const backResult = await openai.generateWithReferences(
        `Design a professional business card BACK for "${brand.name}". Use the provided logo — place it centered on a solid ${primaryColor} background. Clean, elegant, minimal. No text, just the logo from the reference image centered on the colored background. Business card proportions (3.5x2 inches).`,
        [logoRef],
        { size: "1792x1024" },
      );
      files.push(write(cardDir, "back.png", backResult.data));

      const backSvg = await vectorizeBuffer(backResult.data);
      if (backSvg) files.push(write(cardDir, "back.svg", backSvg));
    } catch (err) {
      errors.push(`Business cards failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (errors.length && files.length === 0) {
    failKitRun(run.id, errors);
  } else {
    completeKitRun(run.id, files.length, errors);
  }

  return { outputDir: root, files, errors, runId: run.id };
}
