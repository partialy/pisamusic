import { randomInt, randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";
import { toShanghaiDay } from "../utils/analyticsDate";
import {
  type DownloadRecordInput,
  insertDownloadRecord,
} from "./analyticsStore";
export type TrackingIdentity = {
  deviceKind: "android";
  deviceId: string;
  userId: string | null;
  userName: string;
  deviceName: string;
};
export type TrackingRow = {
  id: string;
  code: string;
  device_kind: string;
  device_id: string;
  user_id: string | null;
  user_snapshot_json: string;
  device_snapshot_json: string;
  created_at: number;
  last_requested_at: number;
  last_visit_at: number | null;
  last_download_at: number | null;
  visit_count: number;
  download_count: number;
  android_download_count: number;
  desktop_download_count: number;
  valid: number;
  invalidated_at: number | null;
};
export function trackingTransaction<T>(action: () => T): T {
  const db = getAppDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function readTrackingCode(code: string): TrackingRow | undefined {
  return getAppDb()
    .prepare("SELECT * FROM app_share_records WHERE code=? AND valid=1")
    .get(code) as TrackingRow | undefined;
}
export function readTrackingDeviceName(id: string): string {
  return (
    (
      getAppDb()
        .prepare("SELECT device_name FROM device_info WHERE id=?")
        .get(id) as
        | {
            device_name: string;
          }
        | undefined
    )?.device_name ?? ""
  );
}
export function getOrCreateTrackingRecord(
  identity: TrackingIdentity,
  generateCode = () =>
    Array.from(
      { length: 6 },
      () =>
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[
          randomInt(62)
        ],
    ).join(""),
): TrackingRow {
  return trackingTransaction(() => {
    const db = getAppDb();
    const key = identity.userId ? `user:${identity.userId}` : "guest";
    const now = Date.now();
    const existing = db
      .prepare(
        "SELECT * FROM app_share_records WHERE device_kind=? AND device_id=? AND identity_key=? AND valid=1",
      )
      .get(identity.deviceKind, identity.deviceId, key) as
      TrackingRow | undefined;
    if (existing) {
      db.prepare(
        "UPDATE app_share_records SET last_requested_at=? WHERE id=?",
      ).run(now, existing.id);
      return existing;
    }
    for (let i = 0; i < 20; i++) {
      const code = generateCode();
      if (!/^[A-Za-z0-9]{6}$/.test(code))
        throw new Error("短码生成器返回无效值");
      if (db.prepare("SELECT 1 FROM app_share_records WHERE code=?").get(code))
        continue;
      db.prepare(
        `INSERT INTO app_share_records(id,code,device_kind,device_id,user_id,identity_key,user_snapshot_json,device_snapshot_json,created_at,last_requested_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        code,
        identity.deviceKind,
        identity.deviceId,
        identity.userId,
        key,
        JSON.stringify({ name: identity.userName }),
        JSON.stringify({ name: identity.deviceName }),
        now,
        now,
      );
      return readTrackingCode(code)!;
    }
    throw new Error("无法分配分享短码");
  });
}
function bumpDaily(
  recordId: string,
  day: string,
  bucket: string,
  pv: number,
  uv: number,
  downloads: number,
  now: number,
) {
  const db = getAppDb();
  db.prepare(
    `INSERT INTO app_share_daily_stats(day,scope,share_record_key,platform_bucket,visit_pv,visit_uv,download_triggers,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(day,scope,share_record_key,platform_bucket) DO UPDATE SET visit_pv=visit_pv+excluded.visit_pv,visit_uv=visit_uv+excluded.visit_uv,download_triggers=download_triggers+excluded.download_triggers,updated_at=excluded.updated_at`,
  ).run(
    day,
    recordId ? "record" : "global",
    recordId,
    bucket,
    pv,
    uv,
    downloads,
    now,
    now,
  );
}
export type VisitEvent = {
  eventId: string;
  code: string;
  visitorHash: string;
  openedAt: number;
  sequence: number;
  referrerPath: string;
  userAgent: string;
  browserDeviceType: string;
  now?: number;
};
export function recordTrackingVisit(input: VisitEvent): {
  accepted: boolean;
  code: string;
} {
  return trackingTransaction(() => {
    const db = getAppDb();
    const record = readTrackingCode(input.code);
    if (!record) throw new Error("分享链接无效");
    const previous = db
      .prepare(
        "SELECT code,visitor_hash FROM app_share_visits WHERE event_id=?",
      )
      .get(input.eventId) as
      | {
          code: string;
          visitor_hash: string;
        }
      | undefined;
    if (previous) {
      if (
        previous.code !== input.code ||
        previous.visitor_hash !== input.visitorHash
      )
        throw new Error("访问事件不匹配");
      return { accepted: false, code: previous.code };
    }
    const now = input.now ?? Date.now();
    const day = toShanghaiDay(now);
    const shareUv = db
      .prepare(
        "SELECT 1 FROM app_share_visits WHERE share_record_id=? AND visit_day=? AND visitor_hash=? LIMIT 1",
      )
      .get(record.id, day, input.visitorHash)
      ? 0
      : 1;
    const globalUv = db
      .prepare(
        "SELECT 1 FROM app_share_visits WHERE visit_day=? AND visitor_hash=? LIMIT 1",
      )
      .get(day, input.visitorHash)
      ? 0
      : 1;
    db.prepare(
      `INSERT INTO app_share_visits(event_id,share_record_id,code,visit_day,visitor_hash,opened_at,navigation_sequence,received_at,referrer_path,user_agent,browser_device_type,is_unique_for_share_day,is_unique_global_day) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      input.eventId,
      record.id,
      input.code,
      day,
      input.visitorHash,
      input.openedAt,
      input.sequence,
      now,
      input.referrerPath,
      input.userAgent,
      input.browserDeviceType,
      shareUv,
      globalUv,
    );
    db.prepare(
      "UPDATE app_share_records SET visit_count=visit_count+1,last_visit_at=? WHERE id=?",
    ).run(now, record.id);
    bumpDaily(record.id, day, "all", 1, shareUv, 0, now);
    bumpDaily("", day, "all", 1, globalUv, 0, now);
    return { accepted: true, code: input.code };
  });
}
export function latestTrackingTouch(
  visitorHash: string,
  now = Date.now(),
): TrackingRow | undefined {
  return getAppDb()
    .prepare(
      `SELECT r.* FROM app_share_visits v JOIN app_share_records r ON r.id=v.share_record_id WHERE v.visitor_hash=? AND v.opened_at>=? AND r.valid=1 ORDER BY v.opened_at DESC,v.navigation_sequence DESC,v.received_at DESC LIMIT 1`,
    )
    .get(visitorHash, now - 7 * 86400000) as TrackingRow | undefined;
}
export function recordTrackedDownload(
  input: DownloadRecordInput,
  attribution: {
    code?: string;
    explicit: boolean;
    visitorHash?: string;
    safeReferrerPath: string;
  },
): void {
  trackingTransaction(() => {
    const db = getAppDb();
    const now = input.occurredAt ?? Date.now();
    const downloadId = insertDownloadRecord(input);
    const record = attribution.explicit
      ? attribution.code
        ? readTrackingCode(attribution.code)
        : undefined
      : attribution.visitorHash
        ? latestTrackingTouch(attribution.visitorHash, now)
        : undefined;
    if (!record) return;
    const day = toShanghaiDay(now);
    db.prepare(
      `INSERT INTO app_share_downloads(id,share_record_id,download_record_id,visitor_hash,download_day,platform,version,file_record_id,attribution_source,triggered_at,safe_referrer_path,safe_user_agent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      randomUUID(),
      record.id,
      downloadId,
      attribution.visitorHash ?? null,
      day,
      input.platform,
      input.version,
      input.fileRecordId,
      attribution.explicit ? "explicit_code" : "cookie",
      now,
      attribution.safeReferrerPath,
      input.userAgent.slice(0, 512),
    );
    db.prepare(
      `UPDATE app_share_records SET download_count=download_count+1,${input.platform === "android" ? "android_download_count" : "desktop_download_count"}=${input.platform === "android" ? "android_download_count" : "desktop_download_count"}+1,last_download_at=? WHERE id=?`,
    ).run(now, record.id);
    for (const id of [record.id, ""]) {
      bumpDaily(id, day, "all", 0, 0, 1, now);
      bumpDaily(id, day, input.platform, 0, 0, 1, now);
    }
  });
}
export function invalidateTrackingRecord(id: string): boolean {
  return (
    Number(
      getAppDb()
        .prepare(
          "UPDATE app_share_records SET valid=0,invalidated_at=COALESCE(invalidated_at,?) WHERE id=?",
        )
        .run(Date.now(), id).changes,
    ) > 0
  );
}
