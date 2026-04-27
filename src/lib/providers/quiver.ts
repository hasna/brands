import type { GenerateOptions, ProviderInterface, ProviderResult, SvgResult, VectorizeOptions } from "../../types/index.js";

const DEFAULT_MODEL = "arrow-1.1";
const API_BASE = "https://api.quiver.ai/v1";

function getApiKey(): string {
  const key = process.env["QUIVERAI_API_KEY"];
  if (!key) throw new Error("QUIVERAI_API_KEY not set");
  return key;
}

export class QuiverProvider implements ProviderInterface {
  name = "quiver" as const;
  supportsSvg = true;

  async generate(options: GenerateOptions): Promise<ProviderResult> {
    const result = await this.generateSvg(options);
    const data = Buffer.from(result.svg, "utf-8");

    return {
      data,
      format: "svg",
      metadata: result.metadata,
    };
  }

  async generateSvg(options: GenerateOptions): Promise<SvgResult> {
    const model = options.model || DEFAULT_MODEL;
    const apiKey = getApiKey();

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      stream: false,
    };

    if (options.instructions) {
      body.instructions = options.instructions;
    }
    if (options.n && options.n > 1) {
      body.n = Math.min(options.n, 16);
    }

    const response = await fetch(`${API_BASE}/svgs/generations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Quiver API error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      id: string;
      created: number;
      credits: number;
      data: Array<{ svg: string; mime_type: string }>;
    };

    const svgItem = json.data[0];
    if (!svgItem?.svg) throw new Error("No SVG data in Quiver response");

    return {
      svg: svgItem.svg,
      metadata: {
        model, provider: "quiver",
        responseId: json.id,
        credits: json.credits,
      },
    };
  }

  async vectorize(options: VectorizeOptions): Promise<SvgResult> {
    const model = options.model || DEFAULT_MODEL;
    const apiKey = getApiKey();

    const { readFileSync } = await import("node:fs");
    const imageData = readFileSync(options.imagePath);
    const base64 = imageData.toString("base64");

    const body: Record<string, unknown> = {
      model,
      image: { base64 },
      stream: false,
    };

    if (options.autoCrop) {
      body.auto_crop = true;
    }

    const response = await fetch(`${API_BASE}/svgs/vectorizations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Quiver vectorize error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      id: string;
      credits: number;
      data: Array<{ svg: string; mime_type: string }>;
    };

    const svgItem = json.data[0];
    if (!svgItem?.svg) throw new Error("No SVG in Quiver vectorize response");

    return {
      svg: svgItem.svg,
      metadata: {
        model, provider: "quiver",
        responseId: json.id,
        credits: json.credits,
        vectorized: true,
      },
    };
  }
}
