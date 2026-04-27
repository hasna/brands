import { generate, generateMultiProvider } from "../lib/generate.js";
import { exportLogo, getPresetSizes } from "../lib/export.js";
import { vectorizeLogo } from "../lib/svg.js";
import { importFromFile, importFromUrl } from "../lib/library.js";
import { createBrand, getBrand, listBrands, updateBrand, deleteBrand } from "../db/brands.js";
import { getLogo, listLogos } from "../db/logos.js";
import { listAssets } from "../db/assets.js";
import { createPalette, listPalettes } from "../db/palettes.js";
import { createTrainingSet, getTrainingSet, listTrainingSets } from "../lib/brains.js";
import { listGenerations } from "../db/generations.js";
import { extractBrandFromUrl, extractBrandFromScreenshot, extractBrandFromCssFile } from "../lib/styles.js";
import type { ExtractedBrandIdentity } from "../lib/styles.js";
import type {
  Brand, Logo, Asset, Palette, Generation, TrainingSet,
  GenerateOptions, Provider, LogoSource,
} from "../types/index.js";
import type { CreateBrandInput } from "../db/brands.js";

export class BrandsClient {
  async generate(options: GenerateOptions): Promise<Logo> {
    return generate(options);
  }

  async generateAll(options: GenerateOptions, providers?: Provider[]): Promise<Logo[]> {
    return generateMultiProvider(options, providers);
  }

  async exportLogo(logoId: string, preset: string = "favicon"): Promise<Asset[]> {
    const logo = getLogo(logoId);
    if (!logo) throw new Error(`Logo not found: ${logoId}`);
    const sizes = getPresetSizes(preset);
    return exportLogo(logo, sizes);
  }

  async vectorize(logoId: string, method: "quiver" | "gemini" = "quiver"): Promise<string> {
    const logo = getLogo(logoId);
    if (!logo) throw new Error(`Logo not found: ${logoId}`);
    return vectorizeLogo(logo, method);
  }

  async importFile(filePath: string, options?: { name?: string; brandId?: string }): Promise<Logo> {
    return importFromFile(filePath, options);
  }

  async importUrl(url: string, options?: { name?: string; brandId?: string }): Promise<Logo> {
    return importFromUrl(url, options);
  }

  createBrand(input: CreateBrandInput): Brand {
    return createBrand(input);
  }

  getBrand(id: string): Brand | null {
    return getBrand(id);
  }

  listBrands(): Brand[] {
    return listBrands();
  }

  updateBrand(id: string, patch: Partial<CreateBrandInput>): Brand {
    return updateBrand(id, patch);
  }

  deleteBrand(id: string): void {
    deleteBrand(id);
  }

  getLogo(id: string): Logo | null {
    return getLogo(id);
  }

  listLogos(filter?: { brandId?: string; provider?: Provider; source?: LogoSource }): Logo[] {
    return listLogos(filter);
  }

  listAssets(logoId: string): Asset[] {
    return listAssets(logoId);
  }

  createPalette(brandId: string, name: string, colors: string[]): Palette {
    return createPalette({ brandId, name, colors });
  }

  listPalettes(brandId: string): Palette[] {
    return listPalettes(brandId);
  }

  createTrainingSet(name: string, logoIds: string[], provider?: string): TrainingSet {
    return createTrainingSet({ name, logoIds, provider });
  }

  getTrainingSet(id: string): TrainingSet | null {
    return getTrainingSet(id);
  }

  listTrainingSets(): TrainingSet[] {
    return listTrainingSets();
  }

  listGenerations(filter?: { status?: string; provider?: string }): Generation[] {
    return listGenerations(filter as Parameters<typeof listGenerations>[0]);
  }

  async extractFromUrl(url: string, options?: { name?: string; pages?: number }): Promise<ExtractedBrandIdentity> {
    return extractBrandFromUrl(url, options);
  }

  async extractFromScreenshot(imagePath: string, options?: { name?: string }): Promise<ExtractedBrandIdentity> {
    return extractBrandFromScreenshot(imagePath, options);
  }

  async extractFromCss(filePath: string, options?: { name?: string }): Promise<ExtractedBrandIdentity> {
    return extractBrandFromCssFile(filePath, options);
  }
}
