import { nativeImage, net } from "electron";

const MAX_CACHE = 100;
const cache = new Map<string, string>();
const DEFAULT_COLOR = "#2897ff";
const SAMPLE_SIZE = 96;

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function quantizeChannel(value: number, levels = 12): number {
  const step = 256 / levels;
  return Math.floor(value / step) * step + step / 2;
}

type PaletteBucket = {
  count: number;
  weight: number;
  r: number;
  g: number;
  b: number;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function extractDominantColor(image: Electron.NativeImage): string {
  if (image.isEmpty()) return DEFAULT_COLOR;

  const resized = image.resize({ width: SAMPLE_SIZE, height: SAMPLE_SIZE });
  const bitmap = resized.toBitmap();
  const size = resized.getSize();

  const palette = new Map<string, PaletteBucket>();
  const fallbackSamples: RgbColor[] = [];

  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const offset = (y * size.width + x) * 4;
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const a = bitmap[offset + 3];

      if (a < 128) continue;

      const color = { r, g, b };
      fallbackSamples.push(color);

      const { saturation, lightness } = rgbToHsl(color);
      if (!isAccentCandidate(saturation, lightness)) continue;

      const key = `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
      const bucket = palette.get(key) ?? {
        count: 0,
        weight: 0,
        r: 0,
        g: 0,
        b: 0,
      };
      const weight = computeAccentWeight(saturation, lightness);
      bucket.count += 1;
      bucket.weight += weight;
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      palette.set(key, bucket);
    }
  }

  if (palette.size === 0) {
    return rgbColorToHex(getAverageColor(fallbackSamples));
  }

  let winner: PaletteBucket | null = null;
  let maxScore = -1;
  for (const bucket of palette.values()) {
    const average = getBucketAverage(bucket);
    const { saturation, lightness } = rgbToHsl(average);
    const score = bucket.weight * 0.7 + bucket.count * computeAccentWeight(saturation, lightness);
    if (score > maxScore) {
      maxScore = score;
      winner = bucket;
    }
  }

  return winner ? rgbColorToHex(getBucketAverage(winner)) : DEFAULT_COLOR;
}

export async function getColorFromUrl(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;

  try {
    let image: Electron.NativeImage;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await net.fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      image = nativeImage.createFromBuffer(buffer);
    } else if (url.startsWith("file://")) {
      image = nativeImage.createFromPath(url.replace("file://", ""));
    } else {
      image = nativeImage.createFromPath(url);
    }

    const color = extractDominantColor(image);

    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(url, color);
    return color;
  } catch {
    return DEFAULT_COLOR;
  }
}

function isAccentCandidate(saturation: number, lightness: number) {
  return saturation >= 0.18 && lightness >= 0.12 && lightness <= 0.88;
}

function computeAccentWeight(saturation: number, lightness: number) {
  const lightnessBias = 1 - Math.abs(lightness - 0.5) * 1.2;
  return Math.max(0.1, saturation * Math.max(0.2, lightnessBias));
}

function rgbToHsl(color: RgbColor) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation =
    delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation,
    lightness,
  };
}

function getAverageColor(colors: RgbColor[]): RgbColor {
  if (!colors.length) return hexToRgb(DEFAULT_COLOR);
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );
  return {
    r: Math.round(total.r / colors.length),
    g: Math.round(total.g / colors.length),
    b: Math.round(total.b / colors.length),
  };
}

function getBucketAverage(bucket: PaletteBucket): RgbColor {
  const divisor = bucket.weight || 1;
  return {
    r: Math.round(bucket.r / divisor),
    g: Math.round(bucket.g / divisor),
    b: Math.round(bucket.b / divisor),
  };
}

function rgbColorToHex(color: RgbColor) {
  return rgbToHex(clampChannel(color.r), clampChannel(color.g), clampChannel(color.b));
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}
