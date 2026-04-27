export async function removeWhiteBackground(inputPath: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const image = sharp(inputPath);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Could not read image dimensions");

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const threshold = 240;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    if (r >= threshold && g >= threshold && b >= threshold) {
      pixels[i + 3] = 0;
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function recolorToBlack(transparentPng: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const { data, info } = await sharp(transparentPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]!;
    if (alpha > 0) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function recolorToWhite(transparentPng: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const { data, info } = await sharp(transparentPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]!;
    if (alpha > 0) {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export async function recolorToColor(transparentPng: Buffer, hex: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const { r, g, b } = hexToRgb(hex);

  const { data, info } = await sharp(transparentPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]!;
    if (alpha > 0) {
      const luminance = 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!;
      const factor = luminance / 255;
      pixels[i] = Math.round(r * factor);
      pixels[i + 1] = Math.round(g * factor);
      pixels[i + 2] = Math.round(b * factor);
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function compositeOnBackground(
  transparentPng: Buffer,
  bgColor: { r: number; g: number; b: number },
  width: number,
  height: number,
  padding: number = 0.15,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const innerSize = Math.round(Math.min(width, height) * (1 - padding * 2));

  const resizedLogo = await sharp(transparentPng)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 4, background: { ...bgColor, alpha: 255 } },
  })
    .composite([{ input: resizedLogo, gravity: "centre" }])
    .png()
    .toBuffer();
}

export async function compositeOnBackgroundJpeg(
  transparentPng: Buffer,
  bgColor: { r: number; g: number; b: number },
  width: number,
  height: number,
  padding: number = 0.15,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const innerSize = Math.round(Math.min(width, height) * (1 - padding * 2));

  const resizedLogo = await sharp(transparentPng)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 4, background: { ...bgColor, alpha: 255 } },
  })
    .composite([{ input: resizedLogo, gravity: "centre" }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function resizePng(input: Buffer, width: number, height: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
