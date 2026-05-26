import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { readPlaintextPaths } from "./db/configStore";
import { importJsonBackups } from "./db/jsonImport";
import { logInterceptor } from "./interceptor/logInterceptor";
import { encryptionMiddleware, setPlaintextPaths } from "./middleware/encryption";
import { adminRouter } from "./routes/admin";
import { configRouter } from "./routes/config";
import { deviceRouter } from "./routes/device";
import { feedbackRouter } from "./routes/feedback";
import { syncRouter } from "./routes/sync";
import { fail } from "./types/response";

const app = express();
const port = Number(process.env.PORT ?? "53380");

app.set("trust proxy", 1);

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const discoverRoot = path.resolve(process.cwd(), "discover");

app.use(cors());
app.use(express.json());
app.use(logInterceptor);

const DEFAULT_PLAINTEXT_PATHS = [
  "/api/health",
  "/api/config/bootstrap",
  "/api/config/check-update",
  "/api/config/get",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/discover",
  "/api/config/update-history",
  "/api/config/agreement",
  "/api/config/service-agreement",
  "/api/config/privacy-policy",
  "/api/config/about",
  "/api/config/announcements",
  "/api/feedback/*",
  "/discover/*",
  "/uploads/*",
];

const MANDATORY_PLAINTEXT_PATHS = [
  "/api/config/get",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/discover",
  "/discover/*",
];

function loadPlaintextPaths(): string[] {
  const paths = readPlaintextPaths().filter((s) => s.length > 0);
  const base = paths.length > 0 ? paths : DEFAULT_PLAINTEXT_PATHS;
  return [...new Set([...base, ...MANDATORY_PLAINTEXT_PATHS])];
}

importJsonBackups();
setPlaintextPaths(loadPlaintextPaths());
app.use(encryptionMiddleware());

app.get("/api/health", (_req, res) => {
  res.json({ msg: "ok", code: 0, data: { status: "up" }, success: true });
});

app.use("/api/config", configRouter);
app.use("/api/admin", adminRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/device", deviceRouter);
app.use("/api/sync", syncRouter);

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

app.use((_req, res) => {
  res.status(404).json(fail("Not Found", 404));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json(fail(message, 500));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[bootstrap-server] listening on http://localhost:${port}`);
});
