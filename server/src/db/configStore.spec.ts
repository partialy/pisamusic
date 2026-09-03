import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before } from "node:test";

const dbPath = path.resolve(process.cwd(), "data/config-store-test.db");

before(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
  process.env.PISA_APP_DB_PATH = dbPath;
});

test("agreement version increments only when title or content changes", async () => {
  const { readAppConfig, saveAppConfigSections } = await import("./configStore.js");
  const first = saveAppConfigSections({
    agreement: { title: "服务协议", content: "第一段\n\n第二段" },
  });
  assert.equal(first.agreement.version, 1);

  const same = saveAppConfigSections({
    agreement: { title: "服务协议", content: "第一段\r\n\r\n第二段" },
  });
  assert.equal(same.agreement.version, 1);

  const contentChanged = saveAppConfigSections({
    agreement: { title: "服务协议", content: "第一段\n\n第二段\n\n第三段" },
  });
  assert.equal(contentChanged.agreement.version, 2);

  const titleChanged = saveAppConfigSections({
    agreement: { title: "服务协议（新版）", content: contentChanged.agreement.content },
  });
  assert.equal(titleChanged.agreement.version, 3);
  assert.equal(readAppConfig().agreement.version, 3);
});
