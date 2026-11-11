import path from "node:path";
import { readDatabaseConfig } from "../db/core/createDatabase";
import { readOperationState } from "./maintenance";
import { activeTask } from "./migrationTasks";
import { openTarget, safeError, targetConfig } from "./mysqlTarget";
import { listSnapshots } from "./sqliteSnapshots";
import { redactedTarget } from "./databaseTarget";

export async function databaseStatus(){
  const config=readDatabaseConfig();
  const mysql:{configured:boolean;connected?:boolean;host?:string;port?:number;database?:string;version?:string;error?:string}={configured:!!process.env.MYSQL_URL};
  if(mysql.configured){
    let db;
    try{const target=targetConfig();if(target.type==="MYSQL"){mysql.host=target.host;mysql.port=target.port;mysql.database=target.database;}
      db=await openTarget();mysql.connected=true;mysql.version=(await db.queryOne<{version:string}>("SELECT VERSION() AS version"))?.version;
    }catch(e){mysql.connected=false;mysql.error=safeError(e);}finally{await db?.close();}
  }
  let target: ReturnType<typeof redactedTarget>|undefined;
  try { target=redactedTarget(); } catch { /* 另一种数据库未配置时仍允许当前库独立部署。 */ }
  return {dbType:config.type,sqliteFile:process.env.PISA_APP_DB_PATH?path.basename(process.env.PISA_APP_DB_PATH):config.type==="SQLITE"?path.basename(config.path):undefined,sqliteConfigured:!!process.env.PISA_APP_DB_PATH,maintenance:readOperationState().maintenance,activeTaskId:activeTask()?.id,target,mysql,snapshots:listSnapshots()};
}
