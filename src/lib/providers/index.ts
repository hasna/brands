import type { Provider, ProviderInterface } from "../../types/index.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { BflProvider } from "./bfl.js";
import { QuiverProvider } from "./quiver.js";

export { OpenAIProvider } from "./openai.js";
export { GeminiProvider } from "./gemini.js";
export { BflProvider } from "./bfl.js";
export { QuiverProvider } from "./quiver.js";

const providers: Record<Provider, () => ProviderInterface> = {
  openai: () => new OpenAIProvider(),
  gemini: () => new GeminiProvider(),
  bfl: () => new BflProvider(),
  quiver: () => new QuiverProvider(),
};

export function getProvider(name: Provider): ProviderInterface {
  const factory = providers[name];
  if (!factory) throw new Error(`Unknown provider: ${name}`);
  return factory();
}

export function listProviders(): Provider[] {
  return Object.keys(providers) as Provider[];
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-image-2",
  gemini: "gemini-3.1-flash-preview-image-generation",
  bfl: "flux.2-pro",
  quiver: "arrow-1.1",
};
