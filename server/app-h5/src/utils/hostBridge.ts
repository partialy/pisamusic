export type HostBridge = {
  isDarkMode?: () => boolean;
  hasHeaderBar?: () => boolean;
  close?: () => void;
  navigateBack?: () => void;
  getSafeAreaInsets?: () => string;
  verifyHostAccess?: (nonce: string) => string;
};

declare global {
  interface Window {
    AndroidWebHost?: HostBridge;
    PisaDesktopHost?: HostBridge;
    NativeBridge?: HostBridge;
    AndroidBridge?: HostBridge;
    pmApplyAppTheme?: (isDark: boolean) => void;
  }
}

const HOST_CHALLENGE_SALT = "pisa-h5-host-guard-v1";
const HOST_SIG_PREFIX = "pmh5:";

export function getHostBridge(): HostBridge | null {
  if (typeof window === "undefined") return null;
  return (
    window.AndroidWebHost ||
    window.PisaDesktopHost ||
    window.NativeBridge ||
    window.AndroidBridge ||
    null
  );
}

export function readUrlQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const direct = new URLSearchParams(window.location.search).get(name);
    if (direct !== null) return direct;
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex >= 0) {
      return new URLSearchParams(hash.slice(qIndex + 1)).get(name);
    }
  } catch {
    // 忽略格式异常 URL
  }
  return null;
}

/** 宿主是否已经渲染了原生顶栏。默认 false（即无原生顶栏，需展示 H5 自绘返回键）。 */
export function hasNativeHeaderBar(): boolean {
  try {
    const bridge = getHostBridge();
    if (bridge && typeof bridge.hasHeaderBar === "function") {
      return Boolean(bridge.hasHeaderBar());
    }
    const flag = readUrlQueryParam("nativeHeader");
    if (flag === "1" || flag === "true") return true;
    if (flag === "0" || flag === "false") return false;
  } catch {
    // 忽略异常
  }
  return false;
}

export function requestHostBackOrClose(canGoBackInRouter: boolean, onRouterBack: () => void) {
  if (canGoBackInRouter) {
    onRouterBack();
    return;
  }
  const bridge = getHostBridge();
  if (bridge && typeof bridge.navigateBack === "function") {
    bridge.navigateBack();
    return;
  }
  if (bridge && typeof bridge.close === "function") {
    bridge.close();
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
  }
}

/** 若客户端已通过 getSafeAreaInsets 提供数值但尚未写入 CSS 变量，则兜底同步一次。 */
export function syncInitialSafeAreaFromBridge() {
  if (typeof document === "undefined") return;
  try {
    const bridge = getHostBridge();
    if (!bridge || typeof bridge.getSafeAreaInsets !== "function") return;
    const raw = bridge.getSafeAreaInsets();
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      statusBarHeight?: number;
      navigationBarHeight?: number;
    };
    const root = document.documentElement;
    if (typeof parsed.statusBarHeight === "number" && parsed.statusBarHeight > 0) {
      root.style.setProperty("--status-bar-height", `${parsed.statusBarHeight}px`);
    }
    if (typeof parsed.navigationBarHeight === "number" && parsed.navigationBarHeight > 0) {
      root.style.setProperty("--navigation-bar-height", `${parsed.navigationBarHeight}px`);
    }
  } catch {
    // 忽略非 JSON 或不支持环境
  }
}

/** 纯 JS SHA-256，用于兼容非安全上下文/离线本地校验客户端应答签名。 */
function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = ascii + "\x80";
  while ((padded.length % 64) - 56) padded += "\x00";
  for (let i = 0; i < padded.length; i++) {
    const j = padded.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] = (words[i >> 2] || 0) | (j << (((3 - i) % 4) * 8));
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;
      const a = hash[0]!;
      const e = hash[4]!;
      const temp1 =
        hash[7]! +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]!) ^ (~e & hash[6]!)) +
        k[i]! +
        (w[i] =
          i < 16
            ? w[i] || 0
            : (w[i - 16]! +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7]! +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]!) ^ (a & hash[2]!) ^ (hash[1]! & hash[2]!));
      hash[7] = hash[6]!;
      hash[6] = hash[5]!;
      hash[5] = hash[4]!;
      hash[4] = (hash[3]! + temp1) | 0;
      hash[3] = hash[2]!;
      hash[2] = hash[1]!;
      hash[1] = hash[0]!;
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i]! + oldHash[i]!) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i]! >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

export function computeExpectedHostSignature(nonce: string): string {
  const digest = sha256Hex(`${nonce}:${HOST_CHALLENGE_SALT}`);
  return `${HOST_SIG_PREFIX}${digest.slice(0, 32)}`;
}

function generateNonce(): string {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${Date.now()}_${hex}`;
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export type HostVerificationResult = {
  allowed: boolean;
  reason: "dev" | "verified" | "missing_bridge" | "missing_verifier" | "signature_mismatch";
};

/**
 * 防止普通浏览器直接打开 H5 页面：
 * - DEV 环境直接放行以便调试；
 * - 生产环境下校验 AndroidWebHost / PisaDesktopHost 是否存在且能正确响应动态挑战签名。
 */
export function verifyEmbeddedHostAccess(): HostVerificationResult {
  if (import.meta.env.DEV) {
    return { allowed: true, reason: "dev" };
  }
  const bridge = getHostBridge();
  if (!bridge) {
    return { allowed: false, reason: "missing_bridge" };
  }
  if (typeof bridge.verifyHostAccess !== "function") {
    return { allowed: false, reason: "missing_verifier" };
  }
  try {
    const nonce = generateNonce();
    const expected = computeExpectedHostSignature(nonce);
    const actual = String(bridge.verifyHostAccess(nonce) ?? "").trim();
    if (actual === expected) {
      return { allowed: true, reason: "verified" };
    }
  } catch {
    // 异常视为验证失败
  }
  return { allowed: false, reason: "signature_mismatch" };
}
