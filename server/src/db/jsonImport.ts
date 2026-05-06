import fs from "node:fs";
import path from "node:path";
import { getAppDb } from "./appDb";
import {
  type AdminUser,
  type Announcement,
  type AppConfig,
  type FeedbackItem,
  type UpdateHistoryItem,
  getJsonImport,
  hasAppSettings,
  insertAnnouncement,
  insertFeedback,
  insertUpdateHistory,
  markJsonImported,
  replaceAppConfig,
  upsertAdminUser,
} from "./configStore";

const DATA_DIR = path.resolve(process.cwd(), "data");

function readJsonFile<T>(fileName: string): T | null {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, fileName), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function importOnce(source: string, importer: () => void) {
  if (getJsonImport(source)) return;
  importer();
  markJsonImported(source);
}

function importAppConfig() {
  importOnce("app-config.json", () => {
    const config = readJsonFile<AppConfig>("app-config.json");
    if (!config || hasAppSettings()) return;
    replaceAppConfig(config);
  });
}

function importAnnouncements() {
  importOnce("announcements.json", () => {
    const list = readJsonFile<Announcement[]>("announcements.json");
    if (!Array.isArray(list)) return;
    const db = getAppDb();
    list.forEach((item, index) => insertAnnouncement(db, item, index));
  });
}

function importUpdateHistory() {
  importOnce("update-history.json", () => {
    const list = readJsonFile<UpdateHistoryItem[]>("update-history.json");
    if (!Array.isArray(list)) return;
    const db = getAppDb();
    list.forEach((item, index) => insertUpdateHistory(db, item, Date.now() + index));
  });
}

function importAdminAuth() {
  importOnce("admin-auth.json", () => {
    const auth = readJsonFile<AdminUser>("admin-auth.json");
    if (!auth?.username || !auth.passwordHash) return;
    upsertAdminUser(auth);
  });
}

function importFeedback() {
  importOnce("feedback.json", () => {
    const store = readJsonFile<{ items?: FeedbackItem[] }>("feedback.json");
    const items = Array.isArray(store?.items) ? store.items : [];
    items.forEach((item) => insertFeedback(item));
  });
}

export function importJsonBackups() {
  importAppConfig();
  importAnnouncements();
  importUpdateHistory();
  importAdminAuth();
  importFeedback();
}
