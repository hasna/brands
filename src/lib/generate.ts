import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { outputsDir } from "../db/database.js";
import { createLogo } from "../db/logos.js";
import { createGeneration, completeGeneration, failGeneration } from "../db/generations.js";
import { getProvider, DEFAULT_MODELS } from "./providers/index.js";
import { saveSvg } from "./svg.js";
import { QuiverProvider } from "./providers/quiver.js";
import type { GenerateOptions, Logo, Provider } from "../types/index.js";

async function vectorizeRasterToSvg(rasterPath: string): Promise<string> {
  const quiver = new QuiverProvider();
  const result = await quiver.vectorize({ imagePath: rasterPath, autoCrop: true });
  return result.svg;
}

export async function generate(options: GenerateOptions): Promise<Logo> {
  const providerName = options.provider || "openai";
  const model = options.model || DEFAULT_MODELS[providerName];
  const provider = getProvider(providerName);

  const gen = createGeneration({
    provider: providerName,
    model,
    prompt: options.prompt,
    instructions: options.instructions,
    params: {
      width: options.width,
      height: options.height,
      format: options.format,
      svg: options.svg,
      n: options.n,
    },
  });

  try {
    const result = await provider.generate(options);
    const ext = result.format || "png";
    const filePath = join(outputsDir(), `${crypto.randomUUID()}.${ext}`);
    writeFileSync(filePath, result.data);

    let svgPath: string | undefined;
    if (options.svg && ext !== "svg") {
      const svgContent = await vectorizeRasterToSvg(filePath);
      const logoId = crypto.randomUUID();
      svgPath = saveSvg(logoId, svgContent);
    }

    const logo = createLogo({
      name: options.name || `logo-${Date.now()}`,
      brandId: options.brandId,
      prompt: options.prompt,
      instructions: options.instructions,
      provider: providerName,
      model,
      format: ext === "svg" ? "svg" : result.format,
      filePath,
      svgPath,
      width: result.width,
      height: result.height,
      metadata: result.metadata ?? {},
      source: "generated",
    });

    completeGeneration(gen.id, logo.id);
    return logo;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failGeneration(gen.id, message);
    throw err;
  }
}

export async function generateMultiProvider(
  options: GenerateOptions,
  providers?: Provider[],
): Promise<Logo[]> {
  const targets = providers || (["openai", "gemini", "quiver"] as Provider[]);
  const results: Logo[] = [];

  for (const providerName of targets) {
    try {
      const logo = await generate({ ...options, provider: providerName });
      results.push(logo);
    } catch (err) {
      console.error(`${providerName} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return results;
}
