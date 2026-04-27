import type { Brand } from "../types/index.js";
import { createBrand } from "../db/brands.js";
import { createPalette } from "../db/palettes.js";

export interface ExtractedBrandIdentity {
  brand: Brand;
  colors: string[];
  fonts: string[];
  borderRadius: string[];
  shadows: string[];
  spacing: string[];
}

export async function extractBrandFromUrl(
  url: string,
  options?: { name?: string; pages?: number; states?: boolean },
): Promise<ExtractedBrandIdentity> {
  const { extractStylesFromUrl, tokenizeStyles, enrichTokensWithAi } = await import("@hasna/styles");

  const raw = await extractStylesFromUrl(url, {
    pages: options?.pages ?? 3,
    states: options?.states ?? true,
  });
  const tokens = tokenizeStyles(raw);
  const enrichment = await enrichTokensWithAi(tokens, url);

  const topColors = tokens.colors.slice(0, 12).map((c) => c.value);
  const fonts = tokens.typography.fontFamilies.slice(0, 4);

  const brandName = options?.name || enrichment.suggestedName || new URL(url).hostname.replace("www.", "");

  const brand = createBrand({
    name: brandName,
    description: enrichment.profileDescription || `Extracted from ${url}`,
    primaryColor: topColors[0],
    secondaryColor: topColors[1],
    accentColor: topColors[2],
    fontPrimary: fonts[0],
    fontSecondary: fonts[1],
    metadata: {
      sourceUrl: url,
      detectedStyle: enrichment.detectedStyle,
      extractedAt: Date.now(),
    },
  });

  if (topColors.length > 0) {
    createPalette({
      brandId: brand.id,
      name: "extracted",
      colors: topColors,
    });
  }

  return {
    brand,
    colors: topColors,
    fonts,
    borderRadius: tokens.borderRadius,
    shadows: tokens.shadows,
    spacing: tokens.spacing,
  };
}

export async function extractBrandFromScreenshot(
  imagePath: string,
  options?: { name?: string },
): Promise<ExtractedBrandIdentity> {
  const { extractStylesFromScreenshot, tokenizeStyles } = await import("@hasna/styles");

  const raw = await extractStylesFromScreenshot(imagePath);
  const tokens = tokenizeStyles(raw);

  const topColors = tokens.colors.slice(0, 12).map((c) => c.value);
  const fonts = tokens.typography.fontFamilies.slice(0, 4);

  const brandName = options?.name || `brand-${Date.now()}`;

  const brand = createBrand({
    name: brandName,
    description: `Extracted from screenshot: ${imagePath}`,
    primaryColor: topColors[0],
    secondaryColor: topColors[1],
    accentColor: topColors[2],
    fontPrimary: fonts[0],
    fontSecondary: fonts[1],
    metadata: {
      sourceFile: imagePath,
      extractedAt: Date.now(),
    },
  });

  if (topColors.length > 0) {
    createPalette({
      brandId: brand.id,
      name: "extracted",
      colors: topColors,
    });
  }

  return {
    brand,
    colors: topColors,
    fonts,
    borderRadius: tokens.borderRadius,
    shadows: tokens.shadows,
    spacing: tokens.spacing,
  };
}

export async function extractBrandFromCssFile(
  filePath: string,
  options?: { name?: string },
): Promise<ExtractedBrandIdentity> {
  const { extractStylesFromFile, tokenizeStyles } = await import("@hasna/styles");

  const raw = extractStylesFromFile(filePath);
  const tokens = tokenizeStyles(raw);

  const topColors = tokens.colors.slice(0, 12).map((c) => c.value);
  const fonts = tokens.typography.fontFamilies.slice(0, 4);

  const brandName = options?.name || `brand-${Date.now()}`;

  const brand = createBrand({
    name: brandName,
    description: `Extracted from CSS: ${filePath}`,
    primaryColor: topColors[0],
    secondaryColor: topColors[1],
    accentColor: topColors[2],
    fontPrimary: fonts[0],
    fontSecondary: fonts[1],
    metadata: {
      sourceFile: filePath,
      extractedAt: Date.now(),
    },
  });

  if (topColors.length > 0) {
    createPalette({
      brandId: brand.id,
      name: "extracted",
      colors: topColors,
    });
  }

  return {
    brand,
    colors: topColors,
    fonts,
    borderRadius: tokens.borderRadius,
    shadows: tokens.shadows,
    spacing: tokens.spacing,
  };
}
