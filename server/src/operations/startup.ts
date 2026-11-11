import type { DbClient } from "../db/core/types";
import { assertSchemaCurrent } from "../db/schema/runner";

/** 启动准入仅由当前数据库的 Schema 和安装状态决定。 */
export async function validateDatabaseSwitch(db: DbClient): Promise<void> {
  await assertSchemaCurrent(db);
}
