import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../db/database.js";
import { getBrand, updateBrand } from "../db/brands.js";
import { getLogo, listLogos } from "../db/logos.js";
import { generate } from "./generate.js";
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
    "White or transparent background.",
  ]
    .filter(Boolean)
    .join(" ");

  const logos: Logo[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const logo = await generate({
        prompt,
        provider: "openai",
        instructions: fullInstructions,
        name: `${brand.slug}-variant-${i + 1}`,
        brandId: brand.id,
      });
      logos.push(logo);
    } catch (err) {
      console.error(`Variant ${i + 1} failed: ${err instanceof Error ? err.message : err}`);
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

  const root = kitDir(brand.slug);
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

  // ── Step 7: Social Covers ─────────────────────────────────────────────────
  if (!options.skipSocialCovers) {
    console.log("  Generating social covers...");
    const twitterDir = ensureSubdir(root, "Social Media", "Twitter");
    const linkedinDir = ensureSubdir(root, "Social Media", "LinkedIn");

    try {
      const coverPrompt = `Professional social media banner for "${brand.name}". ${brand.description || ""}. Feature the brand logo subtly on the right side. Use brand colors: ${primaryColor}, ${secondaryColor}. Modern, clean, professional tech company aesthetic. No placeholder text.`;

      const twitterCover = await generate({
        prompt: coverPrompt,
        provider: "openai",
        instructions: "Twitter/X header banner, 1500x500 aspect ratio, landscape, minimal text.",
        name: `${brand.slug}-twitter-cover`,
        brandId: brand.id,
        width: 1500,
        height: 500,
      });
      const { readFileSync } = await import("node:fs");
      const twitterBuf = readFileSync(twitterCover.filePath);
      files.push(write(twitterDir, "cover@2x.jpg", twitterBuf));

      const linkedinCover = await generate({
        prompt: coverPrompt,
        provider: "openai",
        instructions: "LinkedIn banner, 1584x396 aspect ratio, landscape, minimal text, professional.",
        name: `${brand.slug}-linkedin-cover`,
        brandId: brand.id,
        width: 1584,
        height: 396,
      });
      const linkedinBuf = readFileSync(linkedinCover.filePath);
      files.push(write(linkedinDir, "cover@2x.jpg", linkedinBuf));
    } catch (err) {
      errors.push(`Social covers failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Step 8: Business Cards ─────────────────────────────────────────────────
  if (!options.skipBusinessCards && options.contactInfo) {
    console.log("  Generating business cards...");
    const cardDir = ensureSubdir(root, "Business Card");
    const ci = options.contactInfo;

    const contactLines = [ci.name, ci.title, ci.email, ci.phone, ci.website, ci.address]
      .filter(Boolean)
      .join("\n");

    try {
      const frontCard = await generate({
        prompt: `Professional business card FRONT for "${brand.name}". Clean, modern design using brand colors ${primaryColor} and ${secondaryColor}. Include the company logo prominently. Include this contact information exactly as written:\n${contactLines}\n\nStandard business card proportions (3.5x2 inches). High quality print-ready design.`,
        provider: "openai",
        instructions: "Business card front. Exact 1050x600 pixels (3.5x2 inches at 300dpi). Render all text perfectly legible. Professional typography.",
        name: `${brand.slug}-card-front`,
        brandId: brand.id,
        width: 1792,
        height: 1024,
      });
      const { readFileSync } = await import("node:fs");
      const frontBuf = readFileSync(frontCard.filePath);
      files.push(write(cardDir, "front.png", frontBuf));

      const frontSvg = await vectorizeBuffer(frontBuf);
      if (frontSvg) files.push(write(cardDir, "front.svg", frontSvg));

      const backCard = await generate({
        prompt: `Professional business card BACK for "${brand.name}". Minimal design with the logo centered on a ${primaryColor} background. Clean, elegant, no text — just the logo.`,
        provider: "openai",
        instructions: "Business card back. Same dimensions as front (1050x600). Minimal, elegant.",
        name: `${brand.slug}-card-back`,
        brandId: brand.id,
        width: 1792,
        height: 1024,
      });
      const backBuf = readFileSync(backCard.filePath);
      files.push(write(cardDir, "back.png", backBuf));

      const backSvg = await vectorizeBuffer(backBuf);
      if (backSvg) files.push(write(cardDir, "back.svg", backSvg));
    } catch (err) {
      errors.push(`Business cards failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return { outputDir: root, files, errors };
}
