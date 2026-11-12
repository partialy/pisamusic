const VISITOR_ID_KEY = "pm_site_visitor_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let memoryVisitorId = "";
let lastPagePath: string | null = null;

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getVisitorId(): string {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const saved = localStorage.getItem(VISITOR_ID_KEY);
    if (saved && UUID_RE.test(saved)) return (memoryVisitorId = saved);
  } catch { /* 隐私模式下使用当前页面的访客身份。 */ }
  memoryVisitorId = uuid();
  try { localStorage.setItem(VISITOR_ID_KEY, memoryVisitorId); } catch { /* 存储不可用不影响页面。 */ }
  return memoryVisitorId;
}

function publicPath(path: string): string {
  const entry = path.split("/").filter(Boolean)[0];
  return entry && ["listen", "scan", "download", "app-share", "agreement"].includes(entry) ? `/${entry}/` : "/";
}

function safeReferrer(raw: string): string {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol)
      ? `${url.origin}${url.origin === window.location.origin ? publicPath(url.pathname) : url.pathname}` : "";
  } catch { return ""; }
}

export function reportPageView({ restoredFromCache = false }: { restoredFromCache?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  // 无尾斜杠的静态入口即将跳转，交由落地页采集。
  if (["/scan", "/download", "/app-share"].includes(window.location.pathname)) return;
  const path = /^#\/listen(?:[/?#]|$)/.test(window.location.hash) ? "/listen/" : publicPath(window.location.pathname);
  if (!restoredFromCache && lastPagePath === path) return;
  // BFCache 恢复属于新导航，但 document.referrer 仍是旧文档首次打开时的来源。
  const referrer = restoredFromCache ? "" : lastPagePath ? `${window.location.origin}${lastPagePath}` : safeReferrer(document.referrer);
  // 导航身份在模块中维护，StrictMode 重建 Effect 不会创建第二个 PV。
  lastPagePath = path;
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* 使用空时区。 */ }
  const body = JSON.stringify({
    eventId: uuid(), visitorId: getVisitorId(), path, referrer,
    language: navigator.language || "", timezone,
    screenWidth: window.screen?.width || 0, screenHeight: window.screen?.height || 0,
  });
  void sendPageView(body);
}

async function sendPageView(body: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("/api/analytics/page-view", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        keepalive: true, body,
      });
      if (response.ok || response.status < 500) return;
    } catch { /* 短暂网络错误最多重试一次，同一事件复用 ID。 */ }
    if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
}
