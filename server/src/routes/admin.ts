import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readInstallation } from "../db/installationStore";
import { readAdminUser } from "../db/configStore";
import { getAdminJwtSecret, requireAdminJwt } from "../middleware/requireAdminJwt";
import { fail, ok } from "../types/response";

import { adminAppShareRouter } from "./adminAppShare";
import { adminAppShareRecordsRouter } from "./adminAppShareRecords";
import { adminAnnouncementsRouter } from "./adminAnnouncements";
import { adminCloudMusicRouter } from "./adminCloudMusic";
import { adminDashboardRouter } from "./adminDashboard";
import { adminDatabaseMigrationRouter } from "./adminDatabaseMigration";
import { adminDevicesRouter } from "./admin/adminDevicesRouter";
import { adminDirectMessagesRouter } from "./adminDirectMessages";
import { adminDynamicConfigRouter } from "./adminDynamicConfig";
import { adminFaultReportsRouter } from "./adminFaultReports";
import { adminFeedbackRouter } from "./adminFeedback";
import { adminFilesRouter } from "./admin/adminFilesRouter";
import { adminListeningRouter } from "./adminListening";
import { adminListenTogetherRouter } from "./adminListenTogether";
import { adminRuntimeConfigRouter } from "./adminRuntimeConfig";
import { adminSharesRouter } from "./adminShares";
import { adminSystemRouter } from "./admin/adminSystemRouter";
import { adminUpdatesRouter } from "./admin/adminUpdatesRouter";
import { adminUsersRouter } from "./adminUsers";
import { adminVerificationCodesRouter } from "./adminVerificationCodes";
import { adminWebsiteRecordsRouter } from "./adminWebsiteRecords";

export const adminRouter = Router();

const JWT_EXPIRES: jwt.SignOptions["expiresIn"] = "7d";

// Public Login Endpoint
adminRouter.post("/login", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) return res.status(400).json(fail("用户名和密码不能为空", 400));

    const auth = await readAdminUser(username);
    if (!auth || !bcrypt.compareSync(password, auth.passwordHash)) {
      return res.status(401).json(fail("用户名或密码错误", 401));
    }

    const token = jwt.sign(
      { sub: username, installationId: (await readInstallation())?.installation_id },
      getAdminJwtSecret(),
      { expiresIn: JWT_EXPIRES },
    );
    return res.json(ok({ token, username }, "登录成功"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登录失败";
    return res.status(500).json(fail(message, 500));
  }
});

// Admin JWT Authentication Guard for all subsequent routes
adminRouter.use(requireAdminJwt);

// Modular Sub-Routers
adminRouter.use("/database-migration", adminDatabaseMigrationRouter);
adminRouter.use("/app-share", adminAppShareRouter);
adminRouter.use("/app-share-records", adminAppShareRecordsRouter);
adminRouter.use("/announcements", adminAnnouncementsRouter);
adminRouter.use("/messages", adminDirectMessagesRouter);
adminRouter.use("/cloud-music", adminCloudMusicRouter);
adminRouter.use("/listening", adminListeningRouter);
adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/dynamic-configs", adminDynamicConfigRouter);
adminRouter.use("/feedback", adminFeedbackRouter);
adminRouter.use("/fault-reports", adminFaultReportsRouter);
adminRouter.use("/shares", adminSharesRouter);
adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/verification-codes", adminVerificationCodesRouter);
adminRouter.use("/website-records", adminWebsiteRecordsRouter);
adminRouter.use("/runtime-config", adminRuntimeConfigRouter);
adminRouter.use("/listen-together", adminListenTogetherRouter);
adminRouter.use("/files", adminFilesRouter);
adminRouter.use("/", adminUpdatesRouter);
adminRouter.use("/", adminDevicesRouter);
adminRouter.use("/", adminSystemRouter);
