import { nativeImage, net } from "electron";

const MAX_CACHE = 100;
const cache = new Map<string, string>();

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function quantizeChannel(value: number, levels = 8): number {
  const step = 256 / levels;
  return Math.floor(value / step) * step + step / 2;
}

function extractDominantColor(image: Electron.NativeImage): string {
  const resized = image.resize({ width: 50, height: 50 });
  const bitmap = resized.toBitmap();
  const size = resized.getSize();

  const colorMap = new Map<string, number>();

  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const offset = (y * size.width + x) * 4;
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const a = bitmap[offset + 3];

      if (a < 128) continue;

      const key = `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
  }

  if (colorMap.size === 0) return "#000000";

  let maxCount = 0;
  let dominantKey = "";
  for (const [key, count] of colorMap) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }

  const [dr, dg, db] = dominantKey.split(",").map(Number);
  return rgbToHex(dr, dg, db);
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
    return "#000000";
  }
}
