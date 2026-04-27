import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { outputsDir } from "../db/database.js";
import { createLogo } from "../db/logos.js";
import { createGeneration, completeGeneration, failGeneration } from "../db/generations.js";
import { getProvider, DEFAULT_MODELS } from "./providers/index.js";
import { saveSvg } from "./svg.js";
import type { GenerateOptions, Logo, Provider } from "../types/index.js";

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
    if (options.svg && provider.supportsSvg && provider.generateSvg) {
      const result = await provider.generateSvg(options);
      const logoId = crypto.randomUUID();
      const svgPath = saveSvg(logoId, result.svg);

      const logo = createLogo({
        name: options.name || `logo-${Date.now()}`,
        brandId: options.brandId,
        prompt: options.prompt,
        instructions: options.instructions,
        provider: providerName,
        model,
        format: "svg",
        filePath: svgPath,
        svgPath,
        metadata: result.metadata ?? {},
        source: "generated",
      });

      completeGeneration(gen.id, logo.id, (result.metadata?.["credits"] as number) ?? undefined);
      return logo;
    }

    const result = await provider.generate(options);
    const ext = result.format || "png";
    const filePath = join(outputsDir(), `${crypto.randomUUID()}.${ext}`);
    writeFileSync(filePath, result.data);

    const logo = createLogo({
      name: options.name || `logo-${Date.now()}`,
      brandId: options.brandId,
      prompt: options.prompt,
      instructions: options.instructions,
      provider: providerName,
      model,
      format: result.format,
      filePath,
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
