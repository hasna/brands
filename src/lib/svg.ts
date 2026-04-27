import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { outputsDir } from "../db/database.js";
import { updateLogoSvgPath } from "../db/logos.js";
import { QuiverProvider } from "./providers/quiver.js";
import { GeminiProvider } from "./providers/gemini.js";
import type { Logo, SvgResult } from "../types/index.js";

export async function vectorizeLogo(
  logo: Logo,
  method: "quiver" | "gemini" = "quiver",
): Promise<string> {
  let result: SvgResult;

  if (method === "quiver") {
    const provider = new QuiverProvider();
    result = await provider.vectorize({
      imagePath: logo.filePath,
      autoCrop: true,
    });
  } else {
    const provider = new GeminiProvider();
    const description = logo.prompt || logo.name;
    result = await provider.generateSvg({
      prompt: `Recreate this logo as a clean SVG: ${description}`,
      instructions: "Create a precise vector version. Use clean paths, minimal nodes, and proper grouping.",
    });
  }

  const svgPath = join(outputsDir(), `${logo.id}.svg`);
  writeFileSync(svgPath, result.svg, "utf-8");
  updateLogoSvgPath(logo.id, svgPath);

  return svgPath;
}

export function saveSvg(logoId: string, svg: string): string {
  const svgPath = join(outputsDir(), `${logoId}.svg`);
  writeFileSync(svgPath, svg, "utf-8");
  updateLogoSvgPath(logoId, svgPath);
  return svgPath;
}

export function readSvg(path: string): string {
  return readFileSync(path, "utf-8");
}
