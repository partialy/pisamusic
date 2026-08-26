const VISITOR_ID_KEY = "pm_site_visitor_id";
const VISIT_DAY_KEY = "pm_site_visit_day";

let reportPromise: Promise<void> | null = null;

function safeReferrerWithoutQueryOrHash(rawReferrer: string): string {
  if (!rawReferrer) return "";
  try {
    const url = new URL(rawReferrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

function getTodayShanghai(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  } catch {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
  } catch {
    // localStorage unavailable or restricted
  }

  let newId: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    newId = crypto.randomUUID();
  } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
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

export async function reportDailySiteVisit(): Promise<void> {
  if (typeof window === "undefined") return;

  if (reportPromise) {
    return reportPromise;
  }

  reportPromise = (async () => {
    try {
      const today = getTodayShanghai();
      try {
        const recordedDay = localStorage.getItem(VISIT_DAY_KEY);
        if (recordedDay === today) {
          return;
        }
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
        const body = (await res.json()) as { success?: boolean };
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
  })();

  return reportPromise;
}
