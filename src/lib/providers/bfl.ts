import type { GenerateOptions, ProviderInterface, ProviderResult } from "../../types/index.js";

const DEFAULT_MODEL = "flux.2-pro";
const API_BASE = "https://api.bfl.ai";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150;

function getApiKey(): string {
  const key = process.env["BFL_API_KEY"];
  if (!key) throw new Error("BFL_API_KEY not set");
  return key;
}

function modelToEndpoint(model: string): string {
  const map: Record<string, string> = {
    "flux.2-pro": "/v1/flux-2-pro",
    "flux.2-pro-preview": "/v1/flux-2-pro-preview",
    "flux.2-max": "/v1/flux-2-max",
    "flux.2-flex": "/v1/flux-2-flex",
    "flux.2-klein-4b": "/v1/flux-2-klein-4b",
    "flux.2-klein-9b": "/v1/flux-2-klein-9b",
    "flux-1.1-pro": "/v1/flux-pro-1.1",
    "flux-1.1-pro-ultra": "/v1/flux-pro-1.1-ultra",
  };
  return map[model] || `/v1/${model}`;
}

export class BflProvider implements ProviderInterface {
  name = "bfl" as const;
  supportsSvg = false;

  async generate(options: GenerateOptions): Promise<ProviderResult> {
    const model = options.model || DEFAULT_MODEL;
    const apiKey = getApiKey();
    const endpoint = modelToEndpoint(model);

    const prompt = options.instructions
      ? `${options.instructions}\n\n${options.prompt}`
      : options.prompt;

    const body: Record<string, unknown> = {
      prompt,
      width: options.width || 1024,
      height: options.height || 1024,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "x-key": apiKey,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`BFL API error ${response.status}: ${err}`);
    }

    const submitResult = await response.json() as { id: string; polling_url: string };
    const imageUrl = await this.pollForResult(submitResult.polling_url, apiKey);

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to download BFL image: ${imgRes.status}`);

    const data = Buffer.from(await imgRes.arrayBuffer());

    return {
      data,
      format: "png",
      width: options.width || 1024,
      height: options.height || 1024,
      metadata: { model, provider: "bfl", jobId: submitResult.id },
    };
  }

  private async pollForResult(pollingUrl: string, apiKey: string): Promise<string> {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(pollingUrl, {
        headers: {
          "x-key": apiKey,
          "accept": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`BFL polling error ${res.status}: ${err}`);
      }

      const result = await res.json() as {
        status: string;
        result?: { sample: string };
      };

      if (result.status === "Ready" && result.result?.sample) {
        return result.result.sample;
      }
      if (result.status === "Error" || result.status === "Failed") {
        throw new Error(`BFL generation failed: ${result.status}`);
      }
    }

    throw new Error("BFL generation timed out");
  }
}
