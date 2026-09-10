import { getColorFromUrl } from "@/utils/common";

export interface ImageColorAnalysis {
  isDark: boolean;
  dominantColor: string;
  textColor: string;
  secondaryTextColor: string;
}

/**
 * 采样图片的平均感知亮度 (0-255)
 * 亮度 >= 175 判定为浅色/亮色背景（高亮纯白、极浅亮底），需使用深黑文字与深色图标
 * 亮度 < 175 判定为深色/暗色背景（风景、落霞、深蓝夜空、二次元插画等），需使用纯白亮色文字与亮色图标
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<ImageColorAnalysis> {
  if (!imageUrl) {
    return {
      isDark: true,
      dominantColor: "#2897ff",
      textColor: "#ffffff",
      secondaryTextColor: "rgba(255, 255, 255, 0.82)",
    };
  }

  // 优先通过离屏 Canvas 采样整图平均感知亮度
  try {
    const avgLuminance = await sampleImageLuminance(imageUrl);
    const isDark = avgLuminance < 175;
    return {
      isDark,
      dominantColor: isDark ? "#38bdf8" : "#2897ff",
      textColor: isDark ? "#ffffff" : "#111827",
      secondaryTextColor: isDark ? "rgba(255, 255, 255, 0.82)" : "rgba(17, 24, 39, 0.78)",
    };
  } catch {
    // 降级：通过已有的 getColorFromUrl 提取主色并计算明度
    try {
      const color = await getColorFromUrl(imageUrl);
      const isDark = getHexLuminance(color) < 175;
      return {
        isDark,
        dominantColor: color || (isDark ? "#38bdf8" : "#2897ff"),
        textColor: isDark ? "#ffffff" : "#111827",
        secondaryTextColor: isDark ? "rgba(255, 255, 255, 0.82)" : "rgba(17, 24, 39, 0.78)",
      };
    } catch {
      return {
        isDark: true,
        dominantColor: "#2897ff",
        textColor: "#ffffff",
        secondaryTextColor: "rgba(255, 255, 255, 0.82)",
      };
    }
  }
}

function sampleImageLuminance(imageUrl: string): Promise<number> {
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

        // 采样缩放到 32x32，极快且能准确反映整图平均明暗
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const imgData = ctx.getImageData(0, 0, 32, 32).data;
        let totalLuminance = 0;
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
            sampleCount++;
          }
        }

        resolve(sampleCount ? totalLuminance / sampleCount : 128);
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
