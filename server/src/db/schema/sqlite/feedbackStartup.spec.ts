import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initSchema } from "../../appDb";
import { SqliteClient } from "../../core/sqliteClient";
import { initializeSqliteSchemaMetadata, SCHEMA_VERSION } from "../runner";

const legacyFeedbackSql = `
  CREATE TABLE feedback (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, feedback_type TEXT NOT NULL,
    description TEXT NOT NULL, contact TEXT, device_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE feedback_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT, feedback_id TEXT NOT NULL,
    image_path TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
  );
  INSERT INTO feedback VALUES (
    'legacy', '2026-11-01T00:00:00.000Z', 'bug', 'keep this feedback', 'keep contact',
    '{"serverDeviceId":"existing-device"}'
  );
  INSERT INTO feedback_images(feedback_id, image_path) VALUES ('legacy', 'uploads/feedback/existing.png');
`;

function assertFeedbackIndexes(db: DatabaseSync): void {
  const names = new Set((db.prepare("PRAGMA index_list(feedback)").all() as Array<{ name: string }>).map(row => row.name));
  for (const name of ["idx_feedback_user_created", "idx_feedback_device_created", "idx_feedback_status_created_at"]) {
    assert.ok(names.has(name), `missing index: ${name}`);
  }
}

for (const hasStatus of [false, true]) test(`${hasStatus ? "v6" : "早期"}反馈表先补列再建索引，记录和附件保留`, async () => {
  const raw = new DatabaseSync(":memory:");
  const client = new SqliteClient(raw);
  try {
    raw.exec("PRAGMA foreign_keys=ON;");
    raw.exec(legacyFeedbackSql);
    if (hasStatus) raw.exec(`ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE feedback ADD COLUMN processed_at TEXT;`);
    initSchema(raw);
    await initializeSqliteSchemaMetadata(client);
    const feedback = raw.prepare("SELECT * FROM feedback WHERE id='legacy'").get();
    assert.equal(feedback?.description, "keep this feedback");
    assert.equal(feedback?.contact, "keep contact");
    assert.equal(feedback?.status, "pending");
    assert.equal(feedback?.user_id, null);
    assert.equal(feedback?.device_kind, "android");
    assert.equal(feedback?.device_id, "existing-device");
    assert.equal(raw.prepare("SELECT image_path FROM feedback_images WHERE feedback_id='legacy'").get()?.image_path,
      "uploads/feedback/existing.png");
    assertFeedbackIndexes(raw);
    // 重复执行真实启动的两阶段初始化，不重复添列、不丢记录或附件。
    initSchema(raw);
    await initializeSqliteSchemaMetadata(client);
    assert.equal(raw.prepare("SELECT count(*) AS n FROM feedback").get()?.n, 1);
    assert.equal(raw.prepare("SELECT count(*) AS n FROM feedback_images").get()?.n, 1);
    assertFeedbackIndexes(raw);
  } finally { await client.close(); }
});

test("部分升级的反馈表补齐剩余列且保留已有账号、状态与设备归属", async () => {
  const raw = new DatabaseSync(":memory:");
  const client = new SqliteClient(raw);
  try {
    raw.exec(legacyFeedbackSql);
    raw.exec(`ALTER TABLE feedback ADD COLUMN user_id TEXT;
      ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE feedback ADD COLUMN processed_at TEXT;
      ALTER TABLE feedback ADD COLUMN device_id TEXT;
      UPDATE feedback SET user_id='existing-user', status='processed', processed_at='2026-11-02', device_id='kept-device';`);
    initSchema(raw);
    await initializeSqliteSchemaMetadata(client);
    const feedback = raw.prepare("SELECT * FROM feedback WHERE id='legacy'").get();
    assert.equal(feedback?.user_id, "existing-user");
    assert.equal(feedback?.status, "processed");
    assert.equal(feedback?.processed_at, "2026-11-02");
    assert.equal(feedback?.device_id, "kept-device");
    assertFeedbackIndexes(raw);
  } finally { await client.close(); }
});

test("全新 SQLite 仍能初始化最新结构与反馈索引并重复启动", async () => {
  const raw = new DatabaseSync(":memory:");
  const client = new SqliteClient(raw);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      initSchema(raw);
      await initializeSqliteSchemaMetadata(client);
      assertFeedbackIndexes(raw);
      assert.equal(raw.prepare("SELECT max(version) AS version FROM schema_migrations WHERE status='applied'").get()?.version,
        SCHEMA_VERSION);
    }
  } finally { await client.close(); }
});
