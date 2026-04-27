import type { GenerateOptions, ProviderInterface, ProviderResult } from "../../types/index.js";

const DEFAULT_MODEL = "gpt-image-2";

function getApiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return key;
}

export class OpenAIProvider implements ProviderInterface {
  name = "openai" as const;
  supportsSvg = false;

  async generate(options: GenerateOptions): Promise<ProviderResult> {
    const model = options.model || DEFAULT_MODEL;
    const apiKey = getApiKey();

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      n: 1,
      size: this.resolveSize(options.width, options.height),
      output_format: options.format === "webp" ? "webp" : "png",
    };

    if (options.instructions) {
      body.prompt = `${options.instructions}\n\n${options.prompt}`;
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const item = json.data[0];
    if (!item) throw new Error("No image returned from OpenAI");

    let data: Buffer;
    if (item.b64_json) {
      data = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      data = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("No image data in OpenAI response");
    }

    return {
      data,
      format: options.format === "webp" ? "webp" : "png",
      metadata: { model, provider: "openai" },
    };
  }

  async generateWithReferences(
    prompt: string,
    referenceImages: Buffer[],
    options?: { size?: string; model?: string },
  ): Promise<ProviderResult> {
    const model = options?.model || DEFAULT_MODEL;
    const apiKey = getApiKey();
    const size = options?.size || "1792x1024";

    const formData = new FormData();
    formData.append("model", model);
    formData.append("prompt", prompt);
    formData.append("size", size);
    formData.append("output_format", "png");

    for (let i = 0; i < referenceImages.length; i++) {
      const blob = new Blob([new Uint8Array(referenceImages[i]!)], { type: "image/png" });
      formData.append("image[]", blob, `reference-${i}.png`);
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI edit API error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const item = json.data[0];
    if (!item) throw new Error("No image returned from OpenAI edit");

    let data: Buffer;
    if (item.b64_json) {
      data = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      data = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("No image data in OpenAI edit response");
    }

    return {
      data,
      format: "png",
      metadata: { model, provider: "openai", method: "edit" },
    };
  }

  private resolveSize(width?: number, height?: number): string {
    if (width && height) return `${width}x${height}`;
    if (width && width > 1024) return "1792x1024";
    return "1024x1024";
  }
}
