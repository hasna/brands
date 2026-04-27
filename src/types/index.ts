export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontPrimary?: string;
  fontSecondary?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Logo {
  id: string;
  brandId?: string;
  name: string;
  prompt?: string;
  instructions?: string;
  provider: Provider;
  model: string;
  format: ImageFormat;
  filePath: string;
  svgPath?: string;
  width?: number;
  height?: number;
  metadata: Record<string, unknown>;
  source: LogoSource;
  createdAt: number;
}

export interface Asset {
  id: string;
  logoId: string;
  purpose: string;
  width: number;
  height: number;
  format: ImageFormat;
  filePath: string;
  createdAt: number;
}

export interface Palette {
  id: string;
  brandId: string;
  name: string;
  colors: string[];
  createdAt: number;
}

export interface Generation {
  id: string;
  logoId?: string;
  provider: Provider;
  model: string;
  prompt: string;
  instructions?: string;
  status: GenerationStatus;
  params: Record<string, unknown>;
  error?: string;
  creditsUsed?: number;
  createdAt: number;
  completedAt?: number;
}

export interface TrainingSet {
  id: string;
  name: string;
  provider: string;
  logoIds: string[];
  brainsModelId?: string;
  status: string;
  createdAt: number;
}

export type Provider = "openai" | "gemini" | "bfl" | "quiver";
export type ImageFormat = "png" | "svg" | "webp" | "jpg" | "ico";
export type LogoSource = "generated" | "imported" | "vectorized";
export type GenerationStatus = "pending" | "running" | "completed" | "failed";

export interface GenerateOptions {
  prompt: string;
  instructions?: string;
  provider?: Provider;
  model?: string;
  format?: ImageFormat;
  width?: number;
  height?: number;
  n?: number;
  brandId?: string;
  name?: string;
  svg?: boolean;
  referenceImage?: string;
}

export interface ExportPreset {
  name: string;
  sizes: ExportSize[];
}

export interface ExportSize {
  purpose: string;
  width: number;
  height: number;
  format: ImageFormat;
}

export interface ProviderResult {
  data: Buffer;
  format: ImageFormat;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface SvgResult {
  svg: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderInterface {
  name: Provider;
  generate(options: GenerateOptions): Promise<ProviderResult>;
  generateSvg?(options: GenerateOptions): Promise<SvgResult>;
  supportsSvg: boolean;
}

export interface VectorizeOptions {
  imagePath: string;
  model?: string;
  autoCrop?: boolean;
}
