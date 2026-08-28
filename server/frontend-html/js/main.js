/**
 * PisaMusic 官网首页核心业务交互脚本
 */
(function () {
  "use strict";

  // --- 1. 滚动渐入交互 ---
  function initScrollReveal() {
    const targets = Array.from(document.querySelectorAll(".rise-in, [data-reveal]"));
    if (targets.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -6% 0px",
      }
    );

    targets.forEach((el) => observer.observe(el));
  }

  // --- 2. 日访问统计上报 (日 UV) ---
  const VISITOR_ID_KEY = "pm_site_visitor_id";
  const VISIT_DAY_KEY = "pm_site_visit_day";

  function safeReferrerWithoutQueryOrHash(rawReferrer) {
    if (!rawReferrer) return "";
    try {
      const url = new URL(rawReferrer);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  }

  function getTodayShanghai() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
    } catch {
      return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
  }

  function getOrCreateVisitorId() {
    try {
      const existing = localStorage.getItem(VISITOR_ID_KEY);
      if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
        return existing;
      }
    } catch {
      // ignore
    }

    let newId;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      newId = crypto.randomUUID();
    } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      newId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } else {
      newId = "00000000-0000-4000-8000-000000000000";
    }

    try {
      localStorage.setItem(VISITOR_ID_KEY, newId);
    } catch {
      // ignore
    }
    return newId;
  }

  async function reportDailySiteVisit() {
    try {
      const today = getTodayShanghai();
      try {
        const recordedDay = localStorage.getItem(VISIT_DAY_KEY);
        if (recordedDay === today) return;
      } catch {
        // ignore
      }

      const visitorId = getOrCreateVisitorId();
      let timezone = "";
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        timezone = "";
      }

      const res = await fetch("/api/analytics/site-visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          visitorId,
          path: window.location.pathname || "/",
          referrer: safeReferrerWithoutQueryOrHash(document.referrer),
          language: navigator.language || "",
          timezone,
          screenWidth: window.screen ? window.screen.width : 0,
          screenHeight: window.screen ? window.screen.height : 0,
        }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && body.success) {
          try {
            localStorage.setItem(VISIT_DAY_KEY, today);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore network errors silently
    }
  }

  // --- 3. 设备识别与下载上下文 ---
  function getDownloadContext() {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("downloadPlatform");
    const type = params.get("type") || "";
    const roomId = params.get("roomId") || "";
    const validInvite = type === "listen-together-join" && /^\d{4,8}$/.test(roomId);
    const recommendedType = platform === "android" ? "android" : platform === "windows" ? "desktop" : null;

    return {
      recommendedType,
      continueJoinHref: validInvite ? `/scan/?${new URLSearchParams({ type, roomId }).toString()}` : null,
      roomId: validInvite ? roomId : null,
    };
  }

  function applyDownloadContext() {
    const context = getDownloadContext();

    if (context.recommendedType) {
      const androidCard = document.querySelector('[data-download-card="android"]');
      const desktopCard = document.querySelector('[data-download-card="desktop"]');
      const targetCard = context.recommendedType === "android" ? androidCard : desktopCard;

      if (targetCard) {
        targetCard.classList.remove("border-slate-100", "shadow-[0_15px_45px_rgba(148,163,184,0.06)]");
        targetCard.classList.add("border-2", "border-sky-300", "shadow-[0_25px_65px_rgba(14,165,233,0.14)]");
        const badgeSlot = targetCard.querySelector('[data-recommended-slot]');
        if (badgeSlot) {
          badgeSlot.innerHTML = `<span class="w-fit rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700">当前设备推荐</span>`;
        }
      }
    }

    if (context.continueJoinHref && context.roomId) {
      const banner = document.getElementById("listenTogetherContinuation");
      if (banner) {
        banner.classList.remove("hidden");
        const roomSpan = banner.querySelector("[data-room-id]");
        const link = banner.querySelector("[data-continue-link]");
        if (roomSpan) roomSpan.innerText = context.roomId;
        if (link) link.href = context.continueJoinHref;
      }
    }
  }

  // --- 4. 版本更新拉取与下载按钮更新 ---
  function splitUpdateLines(text) {
    if (!text) return [];
    return text
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function formatTrackedDownloadHref(platform, release) {
    return release && release.available && release.downloadUrl ? `/api/config/download/${platform}` : "#download";
  }

  async function fetchReleaseConfig() {
    try {
      const res = await fetch("/api/config/releases", {
        headers: { Accept: "application/json" },
      });
      const body = await res.json();
      if (!res.ok || !body.success || body.data == null) {
        throw new Error(body.msg || `HTTP ${res.status}`);
      }
      return body.data;
    } catch {
      const fallbackRes = await fetch("/api/config/check-update", {
        headers: { Accept: "application/json" },
      });
      const fallbackBody = await fallbackRes.json();
      if (!fallbackRes.ok || !fallbackBody.success || fallbackBody.data == null) {
        throw new Error(fallbackBody.msg || `HTTP ${fallbackRes.status}`);
      }
      const androidData = fallbackBody.data;
      return {
        android: {
          ...androidData,
          platformLabel: "Android",
          fileSizeText: "",
          available: Boolean(androidData.downloadUrl),
        },
        desktop: {
          latestVersion: "即将开放",
          updateTime: "",
          forceUpdate: false,
          downloadUrl: "",
          officialUrl: "https://pisamusic.partialy.cn",
          updateContent: "PC 版正在准备中。",
          platformLabel: "PC 版",
          fileSizeText: "",
          available: false,
        },
      };
    }
  }

  function updateDownloadCards(releases) {
    const android = releases?.android;
    const desktop = releases?.desktop;

    // 1. 更新首屏 Hero 区域
    const heroAndroidVersion = document.getElementById("heroAndroidVersion");
    const heroDesktopVersion = document.getElementById("heroDesktopVersion");
    const heroAndroidBtn = document.getElementById("heroAndroidBtn");
    const heroDesktopBtn = document.getElementById("heroDesktopBtn");

    if (heroAndroidVersion && android?.latestVersion) {
      heroAndroidVersion.innerText = `Android：${android.latestVersion}`;
    }
    if (heroDesktopVersion) {
      heroDesktopVersion.innerText = `PC：${desktop?.available ? desktop.latestVersion : "即将开放"}`;
    }
    if (heroAndroidBtn && android) {
      heroAndroidBtn.href = formatTrackedDownloadHref("android", android);
      if (!android.available) heroAndroidBtn.classList.add("pill-cta-disabled");
    }
    if (heroDesktopBtn && desktop) {
      heroDesktopBtn.href = formatTrackedDownloadHref("desktop", desktop);
      const span = heroDesktopBtn.querySelector("span");
      if (span) {
        span.innerText = desktop.available ? "下载 PisaMusic 桌面版" : "桌面版即将开放";
      }
      if (!desktop.available) heroDesktopBtn.classList.add("pill-cta-disabled");
    }

    // 2. 更新下载板块 Android 卡片
    const androidCard = document.querySelector('[data-download-card="android"]');
    if (androidCard && android) {
      const verEl = androidCard.querySelector('[data-card-version]');
      const timeEl = androidCard.querySelector('[data-card-time]');
      const statusEl = androidCard.querySelector('[data-card-status]');
      const logEl = androidCard.querySelector('[data-card-logs]');
      const btnEl = androidCard.querySelector('[data-card-btn]');

      if (verEl) verEl.innerText = android.latestVersion || "v2.1.0";
      if (timeEl) timeEl.innerText = android.updateTime || (android.available ? "更新时间暂不可用" : "下载通道暂未开启");
      if (statusEl) {
        statusEl.innerText = android.available ? `可下载${android.fileSizeText ? ` · ${android.fileSizeText}` : ""}` : "即将开放";
        statusEl.className = `w-fit rounded-full px-3.5 py-1.5 text-xs font-bold border ${
          android.available ? "bg-emerald-50 text-emerald-600 border-emerald-100/60" : "bg-slate-100 text-slate-500 border-slate-200/50"
        }`;
      }
      if (logEl) {
        const lines = splitUpdateLines(android.updateContent);
        if (lines.length > 0) {
          logEl.innerHTML = `<ul class="space-y-3.5 text-sm leading-relaxed text-slate-600">${lines
            .map((line) => `<li class="relative pl-5 before:absolute before:left-1.5 before:top-[10px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky-400/80 font-medium">${line}</li>`)
            .join("")}</ul>`;
        }
      }
      if (btnEl) {
        btnEl.href = formatTrackedDownloadHref("android", android);
        const btnSpan = btnEl.querySelector("span");
        if (btnSpan) btnSpan.innerText = android.available ? "下载 Android 版" : "Android 版即将开放";
        if (android.available) {
          btnEl.className =
            "mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-bold transition duration-300 sm:h-14 bg-gradient-to-r from-sky-500 to-sky-450 text-white shadow-lg shadow-sky-500/10 hover:-translate-y-0.5 hover:from-sky-600 hover:to-sky-500 hover:shadow-sky-600/20";
        } else {
          btnEl.className =
            "mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-bold transition duration-300 sm:h-14 cursor-not-allowed bg-slate-200 text-slate-400 pointer-events-none";
        }
      }
    }

    // 3. 更新下载板块 PC 卡片
    const desktopCard = document.querySelector('[data-download-card="desktop"]');
    if (desktopCard && desktop) {
      const verEl = desktopCard.querySelector('[data-card-version]');
      const timeEl = desktopCard.querySelector('[data-card-time]');
      const statusEl = desktopCard.querySelector('[data-card-status]');
      const logEl = desktopCard.querySelector('[data-card-logs]');
      const btnEl = desktopCard.querySelector('[data-card-btn]');

      if (verEl) verEl.innerText = desktop.available ? desktop.latestVersion : "即将开放";
      if (timeEl) timeEl.innerText = desktop.updateTime || (desktop.available ? "更新时间暂不可用" : "下载通道暂未开启");
      if (statusEl) {
        statusEl.innerText = desktop.available ? `可下载${desktop.fileSizeText ? ` · ${desktop.fileSizeText}` : ""}` : "即将开放";
        statusEl.className = `w-fit rounded-full px-3.5 py-1.5 text-xs font-bold border ${
          desktop.available ? "bg-emerald-50 text-emerald-600 border-emerald-100/60" : "bg-slate-100 text-slate-500 border-slate-200/50"
        }`;
      }
      if (logEl) {
        const lines = splitUpdateLines(desktop.updateContent);
        if (lines.length > 0) {
          logEl.innerHTML = `<ul class="space-y-3.5 text-sm leading-relaxed text-slate-600">${lines
            .map((line) => `<li class="relative pl-5 before:absolute before:left-1.5 before:top-[10px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky-400/80 font-medium">${line}</li>`)
            .join("")}</ul>`;
        }
      }
      if (btnEl) {
        btnEl.href = formatTrackedDownloadHref("desktop", desktop);
        const btnSpan = btnEl.querySelector("span");
        if (btnSpan) btnSpan.innerText = desktop.available ? "下载 PC 版" : "PC 版即将开放";
        if (desktop.available) {
          btnEl.className =
            "mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-bold transition duration-300 sm:h-14 bg-gradient-to-r from-sky-500 to-sky-450 text-white shadow-lg shadow-sky-500/10 hover:-translate-y-0.5 hover:from-sky-600 hover:to-sky-500 hover:shadow-sky-600/20";
        } else {
          btnEl.className =
            "mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-bold transition duration-300 sm:h-14 cursor-not-allowed bg-slate-200 text-slate-400 pointer-events-none";
        }
      }
    }
  }

  async function loadReleaseInfo() {
    try {
      const releases = await fetchReleaseConfig();
      updateDownloadCards(releases);
    } catch {
      const errorTip = document.getElementById("downloadErrorTip");
      if (errorTip) errorTip.classList.remove("hidden");
    }
  }

  // --- 5. 用户协议与隐私政策拟真弹窗 ---
  let activeLegalWin = null;

  async function openLegalDialog(kind, fallbackTitle) {
    if (activeLegalWin) {
      activeLegalWin.close();
      activeLegalWin = null;
    }

    const host = document.createElement("div");
    host.className = "legal-window-root";
    host.innerHTML = `
      <div class="legal-window-body">
        <div class="legal-window-state" id="legalLoading">
          <svg class="animate-spin h-5 w-5 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>正在加载…</span>
        </div>
        <div class="legal-window-state px-6 text-center hidden" id="legalError">
          <p class="m-0 text-sm font-medium text-rose-600" id="legalErrorText">内容加载失败，请稍后重试</p>
          <button type="button" class="legal-retry-button mt-3" id="legalRetryBtn">重新加载</button>
        </div>
        <div class="legal-scroll legal-content hidden" id="legalContent"></div>
      </div>
    `;

    const narrow = window.innerWidth <= 680;
    const margin = narrow ? 8 : 24;
    const width = narrow ? window.innerWidth - margin * 2 : Math.min(760, window.innerWidth - margin * 2);
    const height = narrow ? window.innerHeight - margin * 2 : Math.min(640, window.innerHeight - margin * 2);

    const win = new window.Win({
      title: fallbackTitle,
      theme: "win",
      content: host,
      width,
      height,
      x: Math.max(margin, (window.innerWidth - width) / 2),
      y: Math.max(margin, (window.innerHeight - height) / 2),
      minWidth: 360,
      minHeight: 280,
      onClose: () => {
        activeLegalWin = null;
      },
    });

    win.container.classList.add("legal-native-window");
    win.show();
    activeLegalWin = win;

    async function loadData() {
      const loadingEl = host.querySelector("#legalLoading");
      const errorEl = host.querySelector("#legalError");
      const errorTextEl = host.querySelector("#legalErrorText");
      const contentEl = host.querySelector("#legalContent");

      loadingEl.classList.remove("hidden");
      errorEl.classList.add("hidden");
      contentEl.classList.add("hidden");

      try {
        const res = await fetch(`/api/config/${kind}`, {
          headers: { Accept: "application/json" },
        });
        const body = await res.json();
        if (!res.ok || !body.success || !body.data) {
          throw new Error(body.msg || `HTTP ${res.status}`);
        }

        const data = body.data;
        const pageTitle = data.title || fallbackTitle;
        win.setTitle(pageTitle);

        loadingEl.classList.add("hidden");
        if (data.content && data.content.trim()) {
          contentEl.innerHTML = data.content;
          contentEl.classList.remove("hidden");
        } else {
          contentEl.innerHTML = '<div class="legal-window-state">暂无内容</div>';
          contentEl.classList.remove("hidden");
        }
      } catch (err) {
        loadingEl.classList.add("hidden");
        errorEl.classList.remove("hidden");
        if (errorTextEl) {
          errorTextEl.innerText = err instanceof Error ? err.message : "内容加载失败，请稍后重试";
        }
      }
    }

    const retryBtn = host.querySelector("#legalRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", loadData);
    }

    loadData();
  }

  function initLegalDialogs() {
    document.querySelectorAll("[data-open-legal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const kind = btn.getAttribute("data-open-legal");
        const title = btn.getAttribute("data-legal-title") || "法律协议";
        openLegalDialog(kind, title);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeLegalWin) {
        activeLegalWin.close();
        activeLegalWin = null;
      }
    });
  }

  // --- 初始化启动 ---
  document.addEventListener("DOMContentLoaded", () => {
    initScrollReveal();
    applyDownloadContext();
    loadReleaseInfo();
    reportDailySiteVisit();
    initLegalDialogs();
  });
})();
