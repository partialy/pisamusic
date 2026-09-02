import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { configManager } from "./config/configManager";
import { readPlaintextPaths } from "./db/configStore";
import { logInterceptor } from "./interceptor/logInterceptor";
import { encryptionMiddleware, setPlaintextPaths } from "./middleware/encryption";
import { createIpRateLimitMiddleware } from "./middleware/ipRateLimit";
import { createObviousBotBlocker } from "./middleware/obviousBotBlocker";
import { initRealtimeServer } from "./realtime";
import { adminRouter } from "./routes/admin";
import { analyticsRouter } from "./routes/analytics";
import { authRouter } from "./routes/auth";
import { cloudMusicRouter } from "./routes/cloudMusic";
import { configRouter } from "./routes/config";
import { deviceRouter } from "./routes/device";
import { feedbackRouter } from "./routes/feedback";
import { faultReportsRouter } from "./routes/faultReports";
import { listenTogetherRouter } from "./routes/listenTogether";
import { listeningRouter } from "./routes/listening";
import { messagesRouter } from "./routes/messages";
import { sharesRouter } from "./routes/shares";
import { syncRouter } from "./routes/sync";
import { fail } from "./types/response";
import { closeStaleActiveRoomRecords } from "./db/listenTogetherHistoryStore";

// 启动优先初始化运行时策略管理器
configManager.initialize();

// 回收上次进程遗留的 active 一起听房间记录
closeStaleActiveRoomRecords(Date.now());

const app = express();
const port = Number(process.env.PORT ?? "53380");

app.set("trust proxy", 1);

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const discoverRoot = path.resolve(process.cwd(), "discover");
const staticRoot = path.resolve(process.cwd(), "static");

app.use(cors());

// 挂载明显爬虫拦截中间件（排在限流之前，防爬虫消耗正常额度）
app.use(
  createObviousBotBlocker(() => ({
    paths: ["/api/config/download/*"],
    userAgentSubstrings: configManager.get("security.websiteDownloadBotUserAgentSubstrings", [
      "python/",
      "aiohttp/",
      "python-requests",
      "scrapy",
      "curl/",
      "wget/",
      "httpx",
      "go-http-client",
      "libwww-perl",
    ]),
    blockEmptyUserAgent: configManager.get("security.websiteDownloadBlockEmptyUserAgent", false),
  })),
);

// 挂载下载入口共享 IP 滑动窗口限流中间件
app.use(
  createIpRateLimitMiddleware({
    group: "download",
    getPolicy: () => ({
      paths: configManager.get("security.downloadRateLimitPaths", [
        "/api/config/download/*",
        "/api/config/release-files/*",
        "/api/config/desktop-updates/win32/x64/latest.yml",
        "/api/config/desktop-updates/win32/x64/*",
      ]),
      windowSeconds: configManager.get("security.downloadRateLimitWindowSeconds", 60),
      maxRequests: configManager.get("security.downloadRateLimitMaxRequests", 5),
    }),
  }),
);

app.use(
  "/api/fault-reports",
  express.json({ limit: configManager.get("http.faultReportBodyLimit", "5mb") }),
);
app.use(express.json({ limit: configManager.get("http.jsonBodyLimit", "1mb") }));
app.use(logInterceptor);

const DEFAULT_PLAINTEXT_PATHS = [
  "/api/health",
  "/api/config/bootstrap",
  "/api/config/check-update",
  "/api/config/get",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/desktop-updates/*",
  "/api/config/download/*",
  "/api/config/discover",
  "/api/config/update-history",
  "/api/config/agreement",
  "/api/config/service-agreement",
  "/api/config/privacy-policy",
  "/api/config/about",
  "/api/config/announcements",
  "/api/analytics/site-visit",
  "/api/cloud-music/tracks/*/cover",
  "/api/listen-together/config",
  "/api/shares/public/*",
  "/api/feedback/*",
  "/discover/*",
  "/static/*",
  "/uploads/*",
];

const MANDATORY_PLAINTEXT_PATHS = [
  "/api/config/get",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/desktop-updates/*",
  "/api/config/download/*",
  "/api/config/discover",
  "/api/analytics/site-visit",
  "/api/cloud-music/tracks/*/cover",
  "/api/listen-together/config",
  "/api/shares/public/*",
  "/discover/*",
  "/static/*",
  "/uploads/*",
];

function loadPlaintextPaths(): string[] {
  const paths = readPlaintextPaths().filter((s) => s.length > 0);
  const base = paths.length > 0 ? paths : DEFAULT_PLAINTEXT_PATHS;
  return [...new Set([...base, ...MANDATORY_PLAINTEXT_PATHS])];
}

setPlaintextPaths(loadPlaintextPaths());
app.use(encryptionMiddleware());

app.get("/api/health", (_req, res) => {
  res.json({ msg: "ok", code: 0, data: { status: "up" }, success: true });
});

app.use("/api/config", configRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/fault-reports", faultReportsRouter);
app.use("/api/device", deviceRouter);
app.use("/api/sync", syncRouter);
app.use("/api/listen-together", listenTogetherRouter);
app.use("/api/listening", listeningRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/cloud-music", cloudMusicRouter);

app.use(
  "/discover",
  express.static(discoverRoot, {
    index: "index.html",
    fallthrough: false,
  }),
);

app.use(
  "/uploads",
  express.static(uploadsRoot, {
    index: false,
    fallthrough: false,
  }),
);

app.use(
  "/static",
  express.static(staticRoot, {
    index: false,
    fallthrough: false,
  }),
);

app.use((_req, res) => {
  res.status(404).json(fail("Not Found", 404));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json(fail(message, 500));
});

const httpServer = createServer(app);
initRealtimeServer(httpServer);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[bootstrap-server] listening on http://localhost:${port}`);
});
