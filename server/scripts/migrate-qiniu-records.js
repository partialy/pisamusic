#!/usr/bin/env node

/**
 * 将线上 SQLite 中与七牛空间和自定义域名有关的记录切换到新空间。
 *
 * 默认只预览，不写入数据库。
 * 真正执行：node scripts/migrate-qiniu-records.js --apply
 * 指定数据库：node scripts/migrate-qiniu-records.js --db=./data/pm.db --apply
 *
 * 运行前建议停止服务，避免服务端同时写入 SQLite。
 * 本脚本不复制、不删除七牛对象，也不修改对象 Key。
 */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULTS = {
  oldPrivateBucket: "oss-music-partialy",
  newPrivateBucket: "qiniu-private-oss",
  oldPublicBucket: "oss-avatar-public",
  newPublicBucket: "qiniu-public-oss",
  oldPrivateDomain: "pm-qiniu.partialy.cn",
  newPrivateDomain: "qiniu-private-oss.partialy.cn",
  oldPublicDomain: "image-public-oss.partialy.cn",
  newPublicDomain: "qiniu-public-oss.partialy.cn",
};

function parseArgs(argv) {
  const options = {
    apply: false,
    dbPath: process.env.PISA_APP_DB_PATH || path.resolve(process.cwd(), "data/pm.db"),
    backupPath: "",
    ...DEFAULTS,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (!arg.startsWith("--") || !arg.includes("=")) {
      throw new Error(`不支持的参数：${arg}`);
    }
    const [rawName, ...valueParts] = arg.slice(2).split("=");
    const value = valueParts.join("=").trim();
    const nameMap = {
      db: "dbPath",
      backup: "backupPath",
      "old-private-bucket": "oldPrivateBucket",
      "new-private-bucket": "newPrivateBucket",
      "old-public-bucket": "oldPublicBucket",
      "new-public-bucket": "newPublicBucket",
      "old-private-domain": "oldPrivateDomain",
      "new-private-domain": "newPrivateDomain",
      "old-public-domain": "oldPublicDomain",
      "new-public-domain": "newPublicDomain",
    };
    const name = nameMap[rawName];
    if (!name || !value) throw new Error(`参数无效：${arg}`);
    options[name] = value;
  }

  options.dbPath = path.resolve(options.dbPath);
  return options;
}

function printUsage() {
  console.log(`用法：
  node scripts/migrate-qiniu-records.js
  node scripts/migrate-qiniu-records.js --apply
  node scripts/migrate-qiniu-records.js --db=./data/pm.db --apply

默认只预览，不修改数据库。--apply 执行前会生成 SQLite 快照备份。
`);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildDomainReplacements(options) {
  const replacements = [];
  const addDomainVariants = (oldDomain, newDomain) => {
    const variants = [
      `https://${oldDomain}`,
      `http://${oldDomain}`,
      `//${oldDomain}`,
      oldDomain,
    ];
    for (const oldValue of variants) {
      if (!replacements.some((item) => item.oldValue === oldValue)) {
        replacements.push({ oldValue, newValue: `https://${newDomain}` });
      }
    }
  };

  addDomainVariants(options.oldPrivateDomain, options.newPrivateDomain);
  addDomainVariants(options.oldPublicDomain, options.newPublicDomain);
  return replacements;
}

function listTables(db) {
  return db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name)
    .filter((name) => typeof name === "string" && name.length > 0);
}

function listTextColumns(db, tableName) {
  return db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .filter((column) => {
      const declaredType = String(column.type || "").toUpperCase();
      return declaredType.includes("CHAR") || declaredType.includes("CLOB") || declaredType.includes("TEXT");
    })
    .map((column) => column.name)
    .filter((name) => typeof name === "string" && name.length > 0);
}

function buildContainsWhere(columnName, replacements) {
  const column = quoteIdentifier(columnName);
  const clauses = replacements.map(() => `instr(${column}, ?) > 0`);
  return `typeof(${column}) = 'text' AND (${clauses.join(" OR ")})`;
}

function countDomainMatches(db, replacements) {
  const matches = [];
  for (const tableName of listTables(db)) {
    for (const columnName of listTextColumns(db, tableName)) {
      const where = buildContainsWhere(columnName, replacements);
      const params = replacements.map((item) => item.oldValue);
      const row = db
        .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} WHERE ${where}`)
        .get(...params);
      const count = Number(row?.count || 0);
      if (count > 0) matches.push({ tableName, columnName, count });
    }
  }
  return matches;
}

function buildReplaceExpression(columnName, replacements) {
  let expression = quoteIdentifier(columnName);
  for (const replacement of replacements) {
    expression = `replace(${expression}, ?, ?)`;
  }
  return expression;
}

function replaceDomainsInTextColumns(db, replacements) {
  const changed = [];
  for (const tableName of listTables(db)) {
    for (const columnName of listTextColumns(db, tableName)) {
      const where = buildContainsWhere(columnName, replacements);
      const expression = buildReplaceExpression(columnName, replacements);
      const replacementParams = replacements.flatMap((item) => [item.oldValue, item.newValue]);
      const whereParams = replacements.map((item) => item.oldValue);
      const result = db
        .prepare(`UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)} = ${expression} WHERE ${where}`)
        .run(...replacementParams, ...whereParams);
      const count = Number(result?.changes || 0);
      if (count > 0) changed.push({ tableName, columnName, count });
    }
  }
  return changed;
}

function findBucketCollisions(db, options) {
  return db
    .prepare(`
      SELECT src.provider, src.bucket, src.object_key, src.id AS old_id, dst.id AS target_id
      FROM file_records src
      JOIN file_records dst
        ON dst.provider = src.provider
       AND dst.object_key = src.object_key
       AND dst.bucket IN (?, ?)
      WHERE src.provider = 'qiniu'
        AND src.bucket IN (?, ?)
    `)
    .all(
      options.newPrivateBucket,
      options.newPublicBucket,
      options.oldPrivateBucket,
      options.oldPublicBucket,
    );
}

function replaceFileRecordBuckets(db, options) {
  const result = db
    .prepare(`
      UPDATE file_records
      SET bucket = CASE bucket
        WHEN ? THEN ?
        WHEN ? THEN ?
        ELSE bucket
      END
      WHERE provider = 'qiniu'
        AND bucket IN (?, ?)
    `)
    .run(
      options.oldPrivateBucket,
      options.newPrivateBucket,
      options.oldPublicBucket,
      options.newPublicBucket,
      options.oldPrivateBucket,
      options.oldPublicBucket,
    );
  return Number(result?.changes || 0);
}

function createBackup(db, dbPath, requestedPath) {
  const backupPath = requestedPath
    ? path.resolve(requestedPath)
    : `${dbPath}.before-qiniu-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.bak`;
  if (fs.existsSync(backupPath)) throw new Error(`备份文件已存在，为避免覆盖而停止：${backupPath}`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  db.exec(`VACUUM INTO ${quoteLiteral(backupPath)}`);
  return backupPath;
}

function printSummary(title, rows) {
  console.log(title);
  if (rows.length === 0) {
    console.log("  无");
    return;
  }
  for (const row of rows) {
    console.log(`  ${row.tableName}.${row.columnName}: ${row.count} 行`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.dbPath)) throw new Error(`数据库不存在：${options.dbPath}`);

  const replacements = buildDomainReplacements(options);
  const db = new DatabaseSync(options.dbPath);
  db.exec("PRAGMA busy_timeout = 15000; PRAGMA foreign_keys = ON;");

  try {
    const beforeDomainMatches = countDomainMatches(db, replacements);
    const oldBucketCounts = db
      .prepare(`
        SELECT bucket, COUNT(*) AS count
        FROM file_records
        WHERE provider = 'qiniu' AND bucket IN (?, ?)
        GROUP BY bucket
        ORDER BY bucket
      `)
      .all(options.oldPrivateBucket, options.oldPublicBucket);
    const collisions = findBucketCollisions(db, options);

    console.log(`数据库：${options.dbPath}`);
    console.log(`模式：${options.apply ? "执行更新" : "只读预览"}`);
    console.log(`旧私有空间：${options.oldPrivateBucket} -> ${options.newPrivateBucket}`);
    console.log(`旧公开空间：${options.oldPublicBucket} -> ${options.newPublicBucket}`);
    console.log(`旧私有域名：https://${options.oldPrivateDomain} -> https://${options.newPrivateDomain}`);
    console.log(`旧公开域名：https://${options.oldPublicDomain} -> https://${options.newPublicDomain}`);
    console.log("文件记录：");
    if (oldBucketCounts.length === 0) console.log("  无旧 bucket 记录");
    for (const row of oldBucketCounts) console.log(`  ${row.bucket}: ${row.count} 行`);
    printSummary("域名/URL 文本记录：", beforeDomainMatches);

    if (collisions.length > 0) {
      throw new Error(`发现 ${collisions.length} 个目标 bucket 对象记录冲突，未执行任何修改`);
    }
    if (!options.apply) {
      console.log("只读预览结束。确认对象已复制且需要写入时，再加 --apply 执行。");
      return;
    }

    const backupPath = createBackup(db, options.dbPath, options.backupPath);
    console.log(`SQLite 备份：${backupPath}`);

    db.exec("BEGIN IMMEDIATE");
    try {
      const bucketChanges = replaceFileRecordBuckets(db, options);
      const domainChanges = replaceDomainsInTextColumns(db, replacements);
      const remainingDomains = countDomainMatches(db, replacements);
      const remainingBuckets = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM file_records
          WHERE provider = 'qiniu' AND bucket IN (?, ?)
        `)
        .get(options.oldPrivateBucket, options.oldPublicBucket);

      if (remainingDomains.length > 0 || Number(remainingBuckets?.count || 0) > 0) {
        throw new Error("更新后仍发现旧域名或旧 bucket，事务将回滚");
      }

      db.exec("COMMIT");
      console.log(`file_records bucket 更新：${bucketChanges} 行`);
      printSummary("域名/URL 更新：", domainChanges);
      console.log("迁移记录切换完成，事务已提交。");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
