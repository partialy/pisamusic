const assert = require("node:assert/strict");
const { MYSQL_TABLES, MYSQL_ARCHIVE_TABLES } = require("../dist/db/schema/runner");

const tables = [...MYSQL_TABLES, ...MYSQL_ARCHIVE_TABLES];
const names = new Set();
let checkedIndexes = 0;

for (const table of tables) {
  assert(!names.has(table.name), `重复数据表：${table.name}`);
  names.add(table.name);
  assert(table.createSql.startsWith("CREATE TABLE "), `缺少建表语句：${table.name}`);
  assert(/ENGINE=InnoDB/.test(table.createSql), `未使用 InnoDB：${table.name}`);
  assert(/ROW_FORMAT=DYNAMIC/.test(table.createSql), `未启用 DYNAMIC：${table.name}`);

  if (!table.columns) continue; // 归档表仅包含固定存储列，无动态业务索引
  const columns = new Map(table.columns.map(col => [col.name, col]));
  const indexNames = new Set();
  for (const line of table.createSql.split("\n")) {
    if (!/^\s*(PRIMARY KEY|UNIQUE KEY|KEY)\b/.test(line)) continue;
    const namedIndex = /(?:UNIQUE KEY|KEY)\s+`([^`]+)`/.exec(line);
    if (namedIndex) {
      assert(!indexNames.has(namedIndex[1]), `重复索引名：${table.name}.${namedIndex[1]}`);
      indexNames.add(namedIndex[1]);
    }
    const begin = line.indexOf("(");
    const end = line.lastIndexOf(")");
    assert(begin >= 0 && end > begin, `索引语法异常：${table.name} ${line}`);
    const keys = [...line.slice(begin + 1, end).matchAll(/`([^`]+)`(?:\((\d+)\))?/g)];
    assert(keys.length > 0, `索引缺少字段：${table.name} ${line}`);
    let bytes = 0;
    for (const [, name, prefix] of keys) {
      const column = columns.get(name);
      assert(column, `未知索引字段：${table.name}.${name}`);
      const valueType = column.type.toUpperCase();
      const length = /^VARCHAR\((\d+)\)$/.exec(valueType);
      if (length) bytes += 4 * Math.min(Number(length[1]), prefix ? Number(prefix) : Infinity);
      else if (/^LONGTEXT|^TEXT/.test(valueType)) {
        assert(prefix, `TEXT 索引需要前缀：${table.name}.${name}`);
        bytes += Number(prefix) * 4;
      } else if (/^BIGINT|^DOUBLE/.test(valueType)) bytes += 8;
      else if (/^INT/.test(valueType)) bytes += 4;
      else if (/^TINYINT/.test(valueType)) bytes += 1;
      else throw new Error(`未识别的索引字段类型：${table.name}.${name}: ${column.type}`);
    }
    assert(bytes <= 3072, `复合索引长度超过 MySQL 5.7 InnoDB 16KB 页限制：${table.name} (${bytes} bytes)`);
    checkedIndexes++;
  }
}
assert.equal(MYSQL_TABLES.length, 49, "当前业务表清单发生变化，需要更新迁移映射");
console.log(`MySQL 5.7 静态 Schema 检查通过：业务表 ${MYSQL_TABLES.length}、历史归档表 ${MYSQL_ARCHIVE_TABLES.length}、索引 ${checkedIndexes}`);
console.log("注意：此检查不代替在真实 MySQL 5.7 实例上执行 DDL 和完整数据迁移。");
