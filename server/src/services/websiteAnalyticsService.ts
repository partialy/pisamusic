import { recordPageView, recordSiteVisit, type SiteVisitInput } from "../db/analyticsStore";
import { toShanghaiDay } from "../utils/analyticsDate";
import { normalizeWebsitePath, sanitizeWebsiteReferrer } from "../utils/websiteDomain";

export async function collectWebsiteAnalytics(input: SiteVisitInput, eventId?: string) {
  const visitDay = toShanghaiDay(Date.now());
  // 使用已识别爬虫名称，避免任意 bot 子串误伤 CUBOT 等手机品牌。
  if (/googlebot|bingbot|baiduspider|yandexbot|duckduckbot|bytespider|petalbot|applebot|facebookexternalhit|twitterbot|slurp|headlesschrome/i.test(input.userAgent)) {
    return eventId ? { pvAccepted: false, uvAccepted: false, visitDay } : { accepted: false, visitDay };
  }
  const normalized = {
    ...input, visitorId: input.visitorId.toLowerCase(),
    path: normalizeWebsitePath(input.path), referrer: sanitizeWebsiteReferrer(input.referrer),
  };
  return eventId ? recordPageView({ ...normalized, eventId }) : recordSiteVisit(normalized);
}
