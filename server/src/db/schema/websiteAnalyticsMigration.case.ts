import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CREATE_SQL, initSchema } from "../appDb";
import { SqliteClient } from "../core/sqliteClient";
import type { DbClient } from "../core/types";
import { upgradeMysqlWebsiteAnalytics, upgradeSqliteWebsiteAnalytics } from "./websiteAnalyticsMigration";

test("SQLite 旧 UV 和下载记录原样保留，跨域去重约束可重复升级", async () => {
  const raw = new DatabaseSync(":memory:");
  try {
    const legacy = CREATE_SQL.replace(/    domain\s+TEXT\s+NOT NULL DEFAULT '',\n/g, "")
      .replace(/CREATE TABLE IF NOT EXISTS site_page_view_records[\s\S]+?CREATE INDEX IF NOT EXISTS idx_site_pv_created[^;]+;/, "")
      .replace(/CREATE INDEX IF NOT EXISTS idx_(?:site_visit|download)_domain_day[^;]+;/g, "")
      .replace("ux_site_visit_day_domain_visitor", "ux_site_visit_day_visitor")
      .replace("ON site_visit_records (visit_day, domain, visitor_hash)", "ON site_visit_records (visit_day, visitor_hash)");
    raw.exec(legacy);
    raw.prepare("INSERT INTO site_visit_records(id,visit_day,visitor_hash,created_at) VALUES('legacy','2026-11-11','visitor',1)").run();
    raw.prepare("INSERT INTO download_records(id,download_day,platform,created_at) VALUES('download','2026-11-11','android',1)").run();
    await upgradeSqliteWebsiteAnalytics(new SqliteClient(raw));
    initSchema(raw);
    initSchema(raw);
    assert.equal(raw.prepare("SELECT domain FROM site_visit_records WHERE id='legacy'").get()!.domain, "");
    assert.equal(raw.prepare("SELECT domain FROM download_records WHERE id='download'").get()!.domain, "");
    const insert = raw.prepare("INSERT INTO site_visit_records(id,visit_day,domain,visitor_hash,created_at) VALUES(?,'2026-11-11',?,'visitor',1)");
    insert.run("a", "a.example.com");
    insert.run("b", "b.example.com");
    assert.throws(() => insert.run("a-again", "a.example.com"), /UNIQUE/);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM site_visit_records").get()!.n, 3);
  } finally { raw.close(); }
});

test("MySQL DDL 中断不标记成功，同任务重试只补缺失对象", async () => {
  let ledger: { status: string; task_id: string; fingerprint: string } | null = null;
  const domains = new Set<string>(), indexes = new Set<string>();
  let pvExists = false, fail = true, pvCreates = 0;
  const db = {
    dialect: "mysql",
    queryOne: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("WHERE version=2")) return { status: "applied" };
      if (sql.includes("WHERE version=3")) return ledger;
      if (sql.includes("COLUMN_NAME='domain'")) return domains.has(String(params[0])) ? { type: "varchar(253)", nullable: "NO", defaultValue: "" } : null;
      if (sql.includes("INFORMATION_SCHEMA.TABLES")) return pvExists ? { TABLE_NAME: "site_page_view_records" } : null;
      if (sql.includes("ux_site_visit_day_visitor")) return { INDEX_NAME: "ux_site_visit_day_visitor" };
      if (sql.includes("INFORMATION_SCHEMA.STATISTICS")) return indexes.has(String(params[1])) ? { INDEX_NAME: params[1] } : null;
      throw new Error(sql);
    },
    execute: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO schema_migrations")) ledger = { status: "applying", task_id: String(params[2]), fingerprint: String(params[0]) };
      if (sql.includes("status='failed'")) ledger!.status = "failed";
      if (sql.includes("status='applied'")) ledger!.status = "applied";
      if (sql.includes("status='applying'")) ledger!.status = "applying";
      const column = /^ALTER TABLE `([^`]+)` ADD COLUMN/.exec(sql);
      if (column) domains.add(column[1]!);
      if (sql.startsWith("CREATE TABLE `site_page_view_records`")) { pvExists = true; pvCreates++; }
      const index = /ADD (?:UNIQUE KEY|KEY) `([^`]+)`/.exec(sql);
      if (index) {
        if (fail) { fail = false; throw new Error("模拟 DDL 中断"); }
        indexes.add(index[1]!);
      }
      return { affectedRows: 1 };
    },
  } as unknown as DbClient;
  const validate = async () => undefined;
  await assert.rejects(upgradeMysqlWebsiteAnalytics(db, "fingerprint", validate), /DDL 中断/);
  assert.equal(ledger!.status, "failed");
  await upgradeMysqlWebsiteAnalytics(db, "fingerprint", validate);
  assert.equal(ledger!.status, "applied");
  assert.equal(pvCreates, 1);
  assert.equal(domains.size, 2);
  assert.equal(indexes.size, 3);
});
