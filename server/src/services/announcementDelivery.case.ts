import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import express from "express";
import { initializeDatabase, initSchema } from "../db/appDb";
import { readAppConfig, saveAppConfigSections } from "../db/configStore";
import { AnnouncementWriteConflict, readAnnouncements, saveAnnouncement } from "../db/announcements/announcementStore";
import { configRouter } from "../routes/config";
import { normalizeAnnouncementDraft } from "./announcementDraft";
import { saveManagedAnnouncement } from "./announcementService";
import { executeAndroidStartup, executeDesktopStartup } from "./startupService";

test("冷启动与实际 GET 按相同规则下发", async () => {
  const dbPath = resolve(__dirname, "../../data/announcement-test-" + randomUUID() + ".db");
  process.env.DB_TYPE = "SQLITE";
  process.env.PISA_APP_DB_PATH = dbPath;
  const db = await initializeDatabase();
  const app = express();
  app.use("/api/config", configRouter);
  const server = app.listen(0, "127.0.0.1");
  try {
    const config = await readAppConfig();
    await saveAppConfigSections({
      releases: {
        android: { ...config.releases.android, latestVersion: "2.8.7" },
        desktop: { ...config.releases.desktop, latestVersion: "2.0.3" },
      },
    });
    await db.execute("INSERT INTO announcements(id,content_json,time,publisher,confirm_text) VALUES(?,?,?,?,?)", [
      "legacy", '{"schemaVersion":1,"blocks":[{"type":"text","text":"旧公告"}]}', "2026-11-25", "Team", "我知道了",
    ]);
    const draft = {
      content: {
        schemaVersion: 1,
        blocks: [
          { type: "text", text: "新版", italic: true, color: "#ffaa44" },
          { type: "highlight", text: "设置", color: "primary", action: { type: "page", page: "settings" } },
        ],
      },
      time: "2026-11-25",
      publisher: "Team",
      confirmText: "我知道了",
      waitSeconds: 10,
      showGotoButton: true,
      gotoAction: { type: "page", page: "discover" },
    };
    const saveDraft = async (fields: Record<string, unknown>) => {
      const result = await normalizeAnnouncementDraft({ ...draft, ...fields });
      if (!result.ok) assert.fail(result.msg);
      return saveManagedAnnouncement(result.value, null);
    };
    const current = await saveDraft({ id: "current", versionRule: { mode: "current" } });
    await saveDraft({ id: "mobile", platform: "mobile", versionRule: { mode: "gte", version: "v2.8.7" } });
    await saveDraft({ id: "desktop", platform: "pc", versionRule: { mode: "lte", version: "2.0.3" } });
    await saveDraft({ id: "specified", versionRule: { mode: "specified", versions: ["2.0.3", "2.9.9"] } });
    await saveDraft({ id: "disabled", enabled: false });
    const [legacy] = await readAnnouncements({ id: "legacy" });
    const ordinaryEdit = await normalizeAnnouncementDraft({ ...legacy, publisher: "New team" }, legacy);
    assert.ok(ordinaryEdit.ok);
    assert.equal(ordinaryEdit.value.announcementVersion, 1);
    assert.equal((await normalizeAnnouncementDraft({ ...legacy, waitSeconds: 5 }, legacy)).ok, false);
    const upgraded = await normalizeAnnouncementDraft({ ...legacy, waitSeconds: 5, announcementVersion: 2 }, legacy);
    assert.ok(upgraded.ok);
    assert.equal(upgraded.value.announcementVersion, 2);

    if (!server.listening) await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = "http://127.0.0.1:" + address.port + "/api/config/announcements";
    async function ids(query = ""): Promise<string[]> {
      const response = await fetch(base + query);
      assert.equal(response.status, 200);
      const body = await response.json() as { data: { id: string }[] };
      return body.data.map(({ id }) => id);
    }
    assert.deepEqual(await ids(), ["legacy"]);
    assert.deepEqual(await ids("?announcementVersion=2"), ["legacy", "current", "mobile", "desktop", "specified"]);
    assert.deepEqual(await ids("?announcementVersion=2&type=mobile&appVersion=v2.8.7"), ["legacy", "current", "mobile"]);
    assert.deepEqual(await ids("?announcementVersion=2&type=mobile&appVersion=2.10.0"), ["legacy", "mobile"]);
    assert.deepEqual(await ids("?announcementVersion=2&type=pc&appVersion=2.0.3"), ["legacy", "current", "desktop", "specified"]);
    assert.deepEqual(await ids("?announcementVersion=2&type=pc&appVersion=2.0.4"), ["legacy"]);
    assert.equal((await fetch(base + "?appVersion=bad")).status, 400);

    const releases = (await readAppConfig()).releases;
    await saveAppConfigSections({ releases: { ...releases, desktop: { ...releases.desktop, latestVersion: "2.0.4" } } });
    const ordinaryCurrentEdit = await normalizeAnnouncementDraft({ ...current, publisher: "Changed team" }, current);
    assert.ok(ordinaryCurrentEdit.ok);
    assert.deepEqual(ordinaryCurrentEdit.value.versionRule, current.versionRule);
    const recaptured = await normalizeAnnouncementDraft({ ...current, versionRule: { mode: "current" } }, current);
    assert.ok(recaptured.ok);
    assert.deepEqual(recaptured.value.versionRule, { mode: "current", versions: { mobile: "2.8.7", pc: "2.0.4" } });
    assert.deepEqual(await ids("?announcementVersion=2&type=pc&appVersion=2.0.4"), ["legacy"]);

    const common = { bearerToken: "", clientIp: "", absolutizeUrl: (url: string) => url };
    const androidDevice = {
      androidId: "mobile-test", deviceName: "mobile", brand: "test", model: "test",
      osVersion: "16", sdkVersion: 36, appVersionCode: 287, appVersion: "2.8.7",
    };
    const desktopDevice = {
      clientId: "desktop-test", deviceName: "pc", hostname: "test", osName: "Windows",
      osVersion: "11", platform: "win32", arch: "x64", appVersion: "2.0.3",
    };
    const old = await executeAndroidStartup({ ...common, rawBody: { device: androidDevice } });
    assert.deepEqual(old.announcements.map(({ id }) => id), ["legacy"]);
    const android = await executeAndroidStartup({ ...common, rawBody: { device: androidDevice, announcementVersion: 2 } });
    assert.deepEqual(android.announcements.map(({ id }) => id), ["legacy", "current", "mobile"]);
    const desktop = await executeDesktopStartup({ ...common, rawBody: { device: desktopDevice, announcementVersion: 2 } });
    assert.deepEqual(desktop.announcements.map(({ id }) => id), ["legacy", "current", "desktop", "specified"]);
    assert.deepEqual(desktop.announcements[1].gotoAction, { type: "page", page: "discover" });
    assert.equal(desktop.announcements[1].waitSeconds, 10);

    await saveManagedAnnouncement(upgraded.value, 1);
    await assert.rejects(saveAnnouncement(ordinaryEdit.value, 1), AnnouncementWriteConflict);
    assert.deepEqual(await ids(), []);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    await db.close();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
  }
});

test("SQLite 旧公告表加列可重复执行并保留公告及回执", () => {
  const raw = new DatabaseSync(":memory:");
  try {
    initSchema(raw);
    raw.exec("ALTER TABLE announcements DROP COLUMN announcement_version; ALTER TABLE announcements DROP COLUMN delivery_json");
    raw.exec("INSERT INTO announcements(id,content_json,time,publisher,confirm_text) VALUES('old','{}','','','')");
    raw.exec("INSERT INTO announcement_reads(id,announcement_id,reader_key,platform,device_id,created_at,read_at) VALUES('receipt','old','reader','android','device',123,456)");
    initSchema(raw);
    initSchema(raw);
    const row = raw.prepare("SELECT * FROM announcements WHERE id='old'").get();
    assert.equal(row?.announcement_version, 1);
    assert.equal(row?.delivery_json, null);
    assert.equal(row?.content_json, "{}");
    assert.equal(raw.prepare("SELECT read_at FROM announcement_reads WHERE id=?").get("receipt")?.read_at, 456);
  } finally {
    raw.close();
  }
});
