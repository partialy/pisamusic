import type { DbClient } from "../db/core/types";
import { assertSchemaCurrent, schemaFingerprint as expectedSchemaFingerprint } from "../db/schema/runner";
import { readOperationState, writeOperationState } from "./maintenance";
import { getTask } from "./migrationTasks";
import { schemaFingerprint, targetFingerprint } from "./mysqlTarget";

export async function validateDatabaseSwitch(db: DbClient): Promise<void> {
  const state=readOperationState();
  if(db.dialect!=="mysql") {
    if(state.activatedMysql) throw new Error("MySQL 已正式启用，禁止直接以旧 SQLite 启动，请先核对增量数据");
    return;
  }
  await assertSchemaCurrent(db);
  if(!state.taskId) throw new Error("缺少本机迁移完成记录，禁止启用 MySQL");
  const task=getTask(state.taskId);
  if(task.status!=="READY_TO_SWITCH" || task.schemaFingerprint!==expectedSchemaFingerprint || task.targetFingerprint!==targetFingerprint()) throw new Error("迁移任务、目标库或 Schema 版本不匹配");
  if(state.targetFingerprint!==await schemaFingerprint(db)) throw new Error("目标库 Schema 指纹已变化，保持关闭");
  if(task.tables.some(table=>table.status!=="VERIFIED")) throw new Error("迁移数据尚未全量校验");
  const ledger=await db.queryOne<{task_id:string}>("SELECT task_id FROM schema_migrations WHERE version=1");
  if(ledger?.task_id!==task.id) throw new Error("目标迁移账本不匹配");
  writeOperationState({activatedMysql:true,maintenance:false});
}
