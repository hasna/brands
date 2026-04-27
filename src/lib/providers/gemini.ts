import type { GenerateOptions, ProviderInterface, ProviderResult, SvgResult } from "../../types/index.js";

const DEFAULT_MODEL = "gemini-3.1-flash-preview-image-generation";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

export class GeminiProvider implements ProviderInterface {
  name = "gemini" as const;
  supportsSvg = true;

  async generate(options: GenerateOptions): Promise<ProviderResult> {
    const model = options.model || DEFAULT_MODEL;
    const apiKey = getApiKey();

    const prompt = options.instructions
      ? `${options.instructions}\n\n${options.prompt}`
      : options.prompt;

    const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageMimeType: "image/png",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      candidates: Array<{
        content: {
          parts: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    const parts = json.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No content in Gemini response");

    const imagePart = parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("No image data in Gemini response");

    const data = Buffer.from(imagePart.inlineData.data, "base64");

    return {
      data,
      format: "png",
      metadata: { model, provider: "gemini" },
    };
  }

  async generateSvg(options: GenerateOptions): Promise<SvgResult> {
    const model = options.model || "gemini-3.1-flash";
    const apiKey = getApiKey();

    const prompt = options.instructions
      ? `${options.instructions}\n\nGenerate SVG code for: ${options.prompt}\n\nReturn ONLY the SVG markup, starting with <svg and ending with </svg>.`
      : `Generate SVG code for: ${options.prompt}\n\nReturn ONLY the SVG markup, starting with <svg and ending with </svg>.`;

    const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "text/plain",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini SVG API error ${response.status}: ${err}`);
    }

    const json = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text?: string }> };
      }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    if (!text) throw new Error("No text in Gemini SVG response");

    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    if (!svgMatch) throw new Error("No valid SVG found in Gemini response");

    return {
      svg: svgMatch[0],
      metadata: { model, provider: "gemini" },
    };
  }
}
