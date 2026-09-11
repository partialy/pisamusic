import { getColorFromUrl } from "@/utils/common";

export interface ImageColorAnalysis {
  isDark: boolean;
  luminance: number;
  dominantColor: string;
}

/**
 * 采样图片的平均感知亮度 (0-255) 与色彩指标
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<ImageColorAnalysis> {
  if (!imageUrl) {
    return { isDark: true, luminance: 128, dominantColor: "#2897ff" };
  }

  // 优先通过离屏 Canvas 采样整图平均感知亮度与通道均值
  try {
    const metrics = await sampleImageMetrics(imageUrl);
    const isDark = metrics.luminance < 165;
    const dominantColor = isDark ? "#38bdf8" : "#2897ff";
    return { isDark, luminance: metrics.luminance, dominantColor };
  } catch {
    // 降级：通过已有的 getColorFromUrl 提取主色并计算明度
    try {
      const color = await getColorFromUrl(imageUrl);
      const lum = getHexLuminance(color);
      const isDark = lum < 165;
      const dominant = color || (isDark ? "#38bdf8" : "#2897ff");
      return { isDark, luminance: lum, dominantColor: dominant };
    } catch {
      return { isDark: true, luminance: 128, dominantColor: "#2897ff" };
    }
  }
}

interface ImageMetrics {
  luminance: number;
  r: number;
  g: number;
  b: number;
}

function sampleImageMetrics(imageUrl: string): Promise<ImageMetrics> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Canvas context is null"));
          return;
        }

        // 采样缩放到 32x32，极快且能准确反映整图平均明暗与色彩
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const imgData = ctx.getImageData(0, 0, 32, 32).data;
        let totalLuminance = 0;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let sampleCount = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // 仅采样不透明像素
          if (a >= 64) {
            // ITU-R BT.709 感知明度权重
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            totalLuminance += lum;
            totalR += r;
            totalG += g;
            totalB += b;
            sampleCount++;
          }
        }

        if (sampleCount > 0) {
          resolve({
            luminance: totalLuminance / sampleCount,
            r: Math.round(totalR / sampleCount),
            g: Math.round(totalG / sampleCount),
            b: Math.round(totalB / sampleCount),
          });
        } else {
          resolve({ luminance: 128, r: 128, g: 128, b: 128 });
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);
    img.src = imageUrl;
  });
}

function getHexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return 128;
  const r = Number.parseInt(clean.slice(0, 2), 16) || 0;
  const g = Number.parseInt(clean.slice(2, 4), 16) || 0;
  const b = Number.parseInt(clean.slice(4, 6), 16) || 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 从图片链接中提取代表性主色（主要针对歌词背景图片、壁纸等）
 * 优先采用离屏 Canvas 采样分析，原生兼容所有 Chromium 支持的格式（WebP, PNG, JPG, AVIF, SVG 等）
 * 并通过量化色彩桶 + 饱和度/明度加权，选出最适合作为高亮/文本的饱满基色
 * 如遇跨域安全限制等异常，自动降级调用 Electron IPC 获取
 */
export async function extractDominantColorFromUrl(imageUrl: string): Promise<string> {
  if (!imageUrl) return "";

  // 1. 优先通过离屏 Canvas 在渲染进程中快速且精准地提取
  try {
    const color = await extractColorViaCanvas(imageUrl);
    if (color) return color;
  } catch (err) {
    console.warn("Canvas 提取图片颜色失败，尝试降级 Electron IPC:", err);
  }

  // 2. 降级：通过 Electron 主进程 IPC 提取
  try {
    const color = await getColorFromUrl(imageUrl);
    if (color && color !== "#2897ff") return color;
  } catch (err) {
    console.error("Electron IPC 提取颜色失败:", err);
  }

  // 3. 保底默认浅天蓝色
  return "#38bdf8";
}

function extractColorViaCanvas(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const SAMPLE_SIZE = 64;
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Canvas context is null"));
          return;
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const imgData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

        const palette = new Map<
          string,
          { r: number; g: number; b: number; count: number; weight: number }
        >();
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let validPixels = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // 忽略透明像素
          if (a < 96) continue;

          validPixels++;
          totalR += r;
          totalG += g;
          totalB += b;

          const hsl = rgbToHsl(r, g, b);
          if (!isAccentCandidate(hsl.saturation, hsl.lightness)) {
            continue;
          }

          // 量化色彩区间（步长 16，共 16 阶）
          const qr = Math.min(255, Math.floor(r / 16) * 16 + 8);
          const qg = Math.min(255, Math.floor(g / 16) * 16 + 8);
          const qb = Math.min(255, Math.floor(b / 16) * 16 + 8);
          const key = `${qr},${qg},${qb}`;

          const weight = computeAccentWeight(hsl.saturation, hsl.lightness);
          const bucket = palette.get(key) ?? {
            r: 0,
            g: 0,
            b: 0,
            count: 0,
            weight: 0,
          };
          bucket.count += 1;
          bucket.weight += weight;
          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          palette.set(key, bucket);
        }

        // 如果存在鲜明候选桶，挑选综合评分最高的主题色
        if (palette.size > 0) {
          let winner: { r: number; g: number; b: number } | null = null;
          let maxScore = -1;

          for (const bucket of palette.values()) {
            const divisor = bucket.weight || 1;
            const avgR = Math.round(bucket.r / divisor);
            const avgG = Math.round(bucket.g / divisor);
            const avgB = Math.round(bucket.b / divisor);
            const hsl = rgbToHsl(avgR, avgG, avgB);
            const score =
              bucket.weight * 0.65 +
              bucket.count * computeAccentWeight(hsl.saturation, hsl.lightness);

            if (score > maxScore) {
              maxScore = score;
              winner = { r: avgR, g: avgG, b: avgB };
            }
          }

          if (winner) {
            resolve(rgbToHex(winner.r, winner.g, winner.b));
            return;
          }
        }

        // 后备保底：若图片无高饱和色彩（如纯黑白素描、极简黑白摄影），计算全局非透明像素平均色
        if (validPixels > 0) {
          const avgR = Math.round(totalR / validPixels);
          const avgG = Math.round(totalG / validPixels);
          const avgB = Math.round(totalB / validPixels);
          resolve(rgbToHex(avgR, avgG, avgB));
          return;
        }

        resolve("#38bdf8");
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);
    img.src = imageUrl;
  });
}

function rgbToHsl(r: number, g: number, b: number): {
  hue: number;
  saturation: number;
  lightness: number;
} {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const denominator = 1 - Math.abs(2 * lightness - 1);
  const saturation = denominator <= 0 ? 0 : delta / denominator;

  let hue = 0;
  if (max === rf) {
    hue = 60 * (((gf - bf) / delta) % 6);
  } else if (max === gf) {
    hue = 60 * ((bf - rf) / delta + 2);
  } else {
    hue = 60 * ((rf - gf) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: Math.max(0, Math.min(1, saturation)),
    lightness,
  };
}

function isAccentCandidate(saturation: number, lightness: number): boolean {
  return saturation >= 0.12 && lightness >= 0.08 && lightness <= 0.92;
}

function computeAccentWeight(saturation: number, lightness: number): number {
  const lightnessBias = 1 - Math.abs(lightness - 0.55) * 1.3;
  return Math.max(0.1, Math.pow(saturation, 1.1) * Math.max(0.2, lightnessBias));
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

