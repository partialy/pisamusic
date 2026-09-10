import { getColorFromUrl } from "@/utils/common";

export interface ImageColorAnalysis {
  isDark: boolean;
  luminance: number;
  dominantColor: string;
  textColor: string;
  secondaryTextColor: string;
  thirdTextColor: string;
  settingHover: string;
  bgHover: string;
  cardBg: string;
  playerBarBorder: string;
  sliderRail: string;
}

/**
 * 采样图片的平均感知亮度 (0-255) 与色彩指标
 * 亮度 >= 165 判定为浅色/亮色背景（纯白、极浅亮底），派生柔和深炭文字与微暗透气悬浮
 * 亮度 < 165 判定为深色/暗色背景（落霞、夜空、风景、动漫等），派生通透软白文字与清透微光悬浮
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<ImageColorAnalysis> {
  if (!imageUrl) {
    return buildDarkAnalysis(128, "#2897ff");
  }

  // 优先通过离屏 Canvas 采样整图平均感知亮度与通道均值
  try {
    const metrics = await sampleImageMetrics(imageUrl);
    const isDark = metrics.luminance < 165;
    const dominantColor = isDark ? "#38bdf8" : "#2897ff";
    return isDark
      ? buildDarkAnalysis(metrics.luminance, dominantColor)
      : buildLightAnalysis(metrics.luminance, dominantColor);
  } catch {
    // 降级：通过已有的 getColorFromUrl 提取主色并计算明度
    try {
      const color = await getColorFromUrl(imageUrl);
      const lum = getHexLuminance(color);
      const isDark = lum < 165;
      const dominant = color || (isDark ? "#38bdf8" : "#2897ff");
      return isDark
        ? buildDarkAnalysis(lum, dominant)
        : buildLightAnalysis(lum, dominant);
    } catch {
      return buildDarkAnalysis(128, "#2897ff");
    }
  }
}

function buildDarkAnalysis(luminance: number, dominantColor: string): ImageColorAnalysis {
  return {
    isDark: true,
    luminance,
    dominantColor,
    // 软白高质感文字，避免 100% 惨白刺眼（“不要那么白色”）
    textColor: "rgba(255, 255, 255, 0.90)",
    secondaryTextColor: "rgba(255, 255, 255, 0.68)",
    thirdTextColor: "rgba(255, 255, 255, 0.45)",
    // 半透明微亮光晕悬浮，壁纸通透呈现，杜绝死板黑块（“不要么么黑”）
    settingHover: "color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, 0.08))",
    bgHover: "rgba(255, 255, 255, 0.07)",
    cardBg: "rgba(20, 26, 38, 0.42)",
    playerBarBorder: "rgba(255, 255, 255, 0.10)",
    sliderRail: "rgba(255, 255, 255, 0.20)",
  };
}

function buildLightAnalysis(luminance: number, dominantColor: string): ImageColorAnalysis {
  return {
    isDark: false,
    luminance,
    dominantColor,
    // 高级深炭色文字，避免生硬死黑（“不要么么黑”）
    textColor: "rgba(28, 33, 44, 0.88)",
    secondaryTextColor: "rgba(30, 41, 59, 0.68)",
    thirdTextColor: "rgba(30, 41, 59, 0.45)",
    // 半透明柔和微暗悬浮，绝非厚重死白（“不要那么白色”）
    settingHover: "color-mix(in srgb, var(--color-primary) 10%, rgba(0, 0, 0, 0.05))",
    bgHover: "rgba(0, 0, 0, 0.04)",
    cardBg: "rgba(255, 255, 255, 0.55)",
    playerBarBorder: "rgba(0, 0, 0, 0.06)",
    sliderRail: "rgba(0, 0, 0, 0.12)",
  };
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
