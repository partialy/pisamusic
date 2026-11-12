/** 所有公开页面的普通 PV/UV 采集，与 App 分享归因独立。 */
(function () {
  "use strict";
  if (window.__pmSiteAnalyticsLoaded) return;
  window.__pmSiteAnalyticsLoaded = true;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function uuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function visitorId() {
    try {
      const saved = localStorage.getItem("pm_site_visitor_id");
      if (saved && UUID_RE.test(saved)) return saved;
    } catch { /* 存储受限时使用当前文档的身份。 */ }
    const id = uuid();
    try { localStorage.setItem("pm_site_visitor_id", id); } catch { /* 统计失败不影响页面。 */ }
    return id;
  }

  function publicPath(path) {
    const entry = path.split("/").filter(Boolean)[0];
    return entry && ["listen", "scan", "download", "app-share", "agreement"].includes(entry) ? `/${entry}/` : "/";
  }

  function safeReferrer(raw) {
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol)
        ? `${url.origin}${url.origin === window.location.origin ? publicPath(url.pathname) : url.pathname}` : "";
    } catch { return ""; }
  }

  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* 使用空时区。 */ }
  const documentVisitorId = visitorId();

  function reportPageView(restoredFromCache = false) {
    // 新文档或 BFCache 导航创建事件；恢复时保留内存访客身份，重试固定同一请求体。
    const body = JSON.stringify({
      eventId: uuid(), visitorId: documentVisitorId, path: publicPath(window.location.pathname),
      referrer: restoredFromCache ? "" : safeReferrer(document.referrer), language: navigator.language || "", timezone,
      screenWidth: window.screen ? window.screen.width : 0,
      screenHeight: window.screen ? window.screen.height : 0,
    });
    void report(body);
  }

  async function report(body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch("/api/analytics/page-view", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          keepalive: true, body,
        });
        if (response.ok || response.status < 500) return;
      } catch { /* 网络异常最多重试一次。 */ }
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
  }
  reportPageView();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reportPageView(true);
  });
})();
