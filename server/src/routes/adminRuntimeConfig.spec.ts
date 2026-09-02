import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createConfigManager } from "../config/configManager";

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_configs (
      key         TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL DEFAULT '',
      value_json  TEXT    NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `);
  return db;
}

test("adminRuntimeConfig: DTO list contains label and name for all visible items", () => {
  const db = createTestDb();
  const manager = createConfigManager(db);
  manager.initialize();

  const dtos = manager.getAllDTOs();
  assert.ok(dtos.length >= 35);
  for (const dto of dtos) {
    assert.ok(dto.key);
    assert.ok(dto.label);
    assert.ok(dto.group);
    assert.ok(dto.groupLabel);
    assert.notStrictEqual(dto.value, undefined);
  }
});
