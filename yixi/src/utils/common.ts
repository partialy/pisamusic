import type { Song } from "@/types/song";
import { NIcon } from "naive-ui";
import { h, type Component } from "vue";
import defaultCover from "@/assets/images/default-cover.png";
import { getKgImageUrl, getSongCoverUrl, getWyCoverUrl } from "./songCoverUrl";
interface IconOptions {
  style?: Record<string, string | number>;
  class?: string | Record<string, boolean> | Array<string>;
  [key: string]: any;
}

export function renderIcon(
  icon: Component,
  options?: IconOptions,
  NIocnOptions?: {
    size?: number;
    color?: string;
  }
) {
  return () => {
    return h(
      NIcon,
      {
        ...NIocnOptions,
      },
      {
        default: () =>
          h(icon, {
            class: options?.class,
            style: options?.style,
            ...options,
          }),
      }
    );
  };
}

/**
 * 处理动态尺寸的图片url
 * @param url 源url
 * @param size 尺寸
 * @returns 新url
 */
export function getKgImage(
  url?: string,
  size: 120 | 240 | 360 | 480 = 120
): string {
  return getKgImageUrl(url, size, defaultCover);
}
/**
 * 格式化日期时间
 * @param timestamp 时间戳
 * @param clock 是否带时分秒
 * @returns 时间串
 */
export function formatTime(timestamp: number, clock: boolean = true) {
  if (!clock) return new Date(timestamp).toLocaleDateString();
  return new Date(timestamp).toLocaleString();
}

/**
 * 格式化歌曲时间
 * @param time 时间
 * @returns 格式化的00:00
 */
export function formatDuration(time: number): string {
  if (time < 0 || !time) return "00:00";
  if (time > 10000) {
    time /= 1000;
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}

/**
 * 获取大小
 * @param size bit大小
 * @returns 00.00MB
 */
export function formatSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)}KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)}MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)}GB )`;
}

export function debounce(fn: Function, delay: number) {
  let timer: any = null;
  return function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      fn.apply(this, arguments);
    }, delay);
  };
}

/**
 * 获取歌曲封面
 * @param song 歌曲对象
 * @param size 图片等级
 * @returns 图片的url
 */
export function getSongCover(song: Song, size: 120 | 240 | 360 | 480 = 120) {
  return getSongCoverUrl(song, size, defaultCover);
}

export const defaultSongCover = defaultCover;

export const kgUtils = {
  getCoverUrl: (item: any): string => {
    return (
      item.sizable_cover ||
      item.flexible_cover ||
      item.Image ||
      item.img ||
      item.cover_url ||
      item.cover ||
      item.cd_url ||
      item.album_sizable_cover ||
      item.pic ||
      (item.album || item.al)?.picUrl ||
      item.al?.xInfo?.picUrl
    );
  },
};

export const wyUtils = {
  // 获取图片的 url
  getCoverUrl: (item: any): {
    cover: string;
    coverSize: {
      s: string;
      m: string;
      l: string;
      xl: string;
    }
  } => {
    return getWyCoverUrl(item, defaultCover);
  },

  // 获取图片不同尺寸
  getCoverSizeUrl: (url: string, size: number | null = null) => {
    try {
      if (!url) return defaultCover;
      const sizeUrl = size
        ? typeof size === "number"
          ? `?param=${size}y${size}`
          : `?param=${size}`
        : "";
      const imageUrl = url?.replace(/^http:/, "https:");
      if (imageUrl.endsWith(".jpg")) {
        return imageUrl + sizeUrl;
      }
      if (imageUrl.endsWith("&")) {
        const url = imageUrl + "cl";
        return url.replace(
          /(thumbnail=[0-9]+y[0-9]+&cl)/,
          `thumbnail=${size}y${size}&`
        );
      }
      return imageUrl;
    } catch (error) {
      console.error("图片链接处理出错：", error);
      return defaultCover;
    }
  },
};

export function setThemeVars(vars: Record<string, string>) {
  let style = document.getElementById("dynamic-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "dynamic-theme";
    document.head.appendChild(style);
  }
  style.textContent = `:root { ${Object.entries(vars)
    .map(([key, value]) => `--${key}: ${value};`)
    .join(" ")} }`;
}

/**
 * 
 * @param url 链接
 * @param filename 文件名
 * @param onProgress 进度回调
 * @param onDone 成功回调
 */
export async function downloadWithProgress(url: string, filename: string, onProgress?: (percentage: number) => void, onDone?: () => void) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const totalBytes = contentLength ? parseInt(contentLength) : 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取响应体');

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      onDone?.();
      break
    };

    chunks.push(value);
    receivedBytes += value.length;

    // 计算进度百分比
    const progress = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

    // 回调进度
    onProgress?.(progress);
  }

  // 合并所有chunk 
  // @ts-ignore
  const blob = new Blob(chunks);
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

export async function getColorFromUrl(url: string): Promise<string> {
  return window.electronAPI.getColorFromUrl(url);
}
