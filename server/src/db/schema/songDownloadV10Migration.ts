import { DatabaseError, type DbClient } from "../core/types";
import { songDownloadTables } from "./mysql/songDownloads";
import { MYSQL_TABLES } from "./mysql/tables";
import { validateSongDownloadSchema } from "./songDownloadValidation";

const TASK_ID = "upgrade-v10-quota-vip-redeem";

const COLUMN_UPGRADES = [
  {
    table: "users",
    column: "vip_level",
    sqlite: "INTEGER NOT NULL DEFAULT 1",
    mysql: "BIGINT NOT NULL DEFAULT 1",
  },
  {
    table: "song_download_quota_states",
    column: "extra_balance",
    sqlite: "INTEGER NOT NULL DEFAULT 0",
    mysql: "BIGINT NOT NULL DEFAULT 0",
  },
  {
    table: "song_download_batches",
    column: "regular_charged_count",
    sqlite: "INTEGER NOT NULL DEFAULT 0",
    mysql: "BIGINT NOT NULL DEFAULT 0",
  },
  {
    table: "song_download_batches",
    column: "extra_charged_count",
    sqlite: "INTEGER NOT NULL DEFAULT 0",
    mysql: "BIGINT NOT NULL DEFAULT 0",
  },
  {
    table: "redemption_codes",
    column: "batch_name",
    sqlite: "TEXT NOT NULL DEFAULT ''",
    mysql: "VARCHAR(128) NOT NULL DEFAULT ''",
  },
] as const;

const NEW_TABLE_NAMES = [
  "song_download_vip_tiers",
  "song_download_extra_logs",
  "redemption_codes",
  "redemption_logs",
] as const;

export async function upgradeSqliteQuotaVipV10(client: DbClient): Promise<void> {
  await client.transaction(async (tx) => {
    for (const item of COLUMN_UPGRADES) {
      const cols = await tx.query<{ name: string }>(`PRAGMA table_info(${item.table})`);
      if (cols.length && !cols.some((c) => c.name === item.column)) {
        await tx.execute(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.sqlite}`);
      }
    }
  });
}

export async function seedDefaultVipTier(client: DbClient): Promise<void> {
  const sql =
    client.dialect === "mysql"
      ? "INSERT IGNORE INTO song_download_vip_tiers(level, name, daily_limit, weekly_limit, monthly_limit, total_limit, updated_at) VALUES (1, 'VIP 1档', NULL, NULL, NULL, NULL, 0)"
      : "INSERT OR IGNORE INTO song_download_vip_tiers(level, name, daily_limit, weekly_limit, monthly_limit, total_limit, updated_at) VALUES (1, 'VIP 1档', NULL, NULL, NULL, NULL, 0)";
  await client.execute(sql, []);
}

/** MySQL v9 -> v10：扩展 VIP 等级、额外次数与兑换码表结构并登记账本，支持幂等续迁。 */
export async function upgradeMysqlQuotaVipV10(
  client: DbClient,
  fingerprint: string,
  validate: (client: DbClient, name: string, ddl: string) => Promise<void>,
): Promise<void> {
  const previous = await client.queryOne<{ status: string }>("SELECT status FROM schema_migrations WHERE version=9");
  if (previous?.status !== "applied") {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v10 升级要求已完成 Schema v9");
  }
  const ledger = await client.queryOne<{
    status: string;
    task_id: string;
    fingerprint: string;
    created_objects_json: string;
  }>("SELECT status, task_id, fingerprint, created_objects_json FROM schema_migrations WHERE version=10");
  if (
    ledger &&
    (ledger.task_id !== TASK_ID ||
      ledger.fingerprint !== fingerprint ||
      !["failed", "applying"].includes(ledger.status))
  ) {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v10 账本不属于可续迁配额与兑换码任务");
  }

  const created: string[] = ledger ? JSON.parse(ledger.created_objects_json) : [];
  const newTables = songDownloadTables.filter((t) =>
    (NEW_TABLE_NAMES as readonly string[]).includes(t.name),
  );
  const allowed = [
    ...COLUMN_UPGRADES.map((c) => `${c.table}.${c.column}`),
    ...newTables.flatMap((t) => [
      t.name,
      ...t.foreignSql.map((sql) => /CONSTRAINT `([^`]+)`/.exec(sql)![1]!),
    ]),
  ];
  if (!Array.isArray(created) || created.some((n) => !allowed.includes(n))) {
    throw new DatabaseError("DB_SCHEMA_CONFLICT", "v10 账本对象无效");
  }

  if (!ledger) {
    await client.execute(
      "INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(10,?,?,?,?,?)",
      [fingerprint, "applying", TASK_ID, "[]", Date.now()],
    );
  } else {
    await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=10");
  }

  const record = async (name: string) => {
    if (!created.includes(name)) {
      created.push(name);
      await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=10", [
        JSON.stringify(created),
      ]);
    }
  };

  try {
    for (const item of COLUMN_UPGRADES) {
      await record(`${item.table}.${item.column}`);
      const col = await client.queryOne<{ name: string }>(
        "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
        [item.table, item.column],
      );
      if (!col) {
        await client.execute(`ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.column}\` ${item.mysql}`);
      }
    }

    for (const table of newTables) {
      const exists = await client.queryOne(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [table.name],
      );
      if (exists && !created.includes(table.name)) {
        throw new DatabaseError("DB_SCHEMA_CONFLICT", `配额与兑换码表 ${table.name} 未登记在本任务`);
      }
      await record(table.name);
      if (!exists) await client.execute(table.createSql);
      await validate(client, table.name, table.createSql);

      for (const ddl of table.foreignSql) {
        const fkName = /CONSTRAINT `([^`]+)`/.exec(ddl)![1]!;
        await record(fkName);
        const match = /FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)/.exec(ddl)!;
        const keys = await client.query<{ col: string; refTable: string; refCol: string; deleteRule: string }>(
          "SELECT k.COLUMN_NAME AS col,k.REFERENCED_TABLE_NAME AS refTable,k.REFERENCED_COLUMN_NAME AS refCol,r.DELETE_RULE AS deleteRule FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.CONSTRAINT_NAME=?",
          [table.name, fkName],
        );
        if (!keys.length) {
          await client.execute(ddl);
        } else if (
          keys.length !== 1 ||
          keys[0]!.col !== match[1] ||
          keys[0]!.refTable !== match[2] ||
          keys[0]!.refCol !== match[3] ||
          !["RESTRICT", "NO ACTION"].includes(keys[0]!.deleteRule)
        ) {
          throw new DatabaseError("DB_SCHEMA_CONFLICT", `配额与兑换码外键 ${fkName} 不匹配`);
        }
      }
    }

    const usersTable = MYSQL_TABLES.find((t) => t.name === "users")!;
    await validate(client, usersTable.name, usersTable.createSql);
    await validateSongDownloadSchema(client);
    await seedDefaultVipTier(client);

    await client.execute("UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=10", [
      Date.now(),
    ]);
  } catch (error) {
    await client
      .execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=10")
      .catch(() => undefined);
    throw error;
  }
}
