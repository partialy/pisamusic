import path from "node:path";
import { readDatabaseConfig } from "../db/core/createDatabase";
import { readOperationState } from "./maintenance";
import { activeTask } from "./migrationTasks";
import { openTarget, safeError, targetConfig } from "./mysqlTarget";
import { listSnapshots } from "./sqliteSnapshots";

export async function databaseStatus(){
  const config=readDatabaseConfig();
  const mysql:{configured:boolean;connected?:boolean;host?:string;port?:number;database?:string;version?:string;error?:string}={configured:!!process.env.MYSQL_URL};
  if(mysql.configured){
    let db;
    try{const target=targetConfig();if(target.type==="MYSQL"){mysql.host=target.host;mysql.port=target.port;mysql.database=target.database;}
      db=await openTarget();mysql.connected=true;mysql.version=(await db.queryOne<{version:string}>("SELECT VERSION() AS version"))?.version;
    }catch(e){mysql.connected=false;mysql.error=safeError(e);}finally{await db?.close();}
  }
  return {dbType:config.type,sqliteFile:config.type==="SQLITE"?path.basename(config.path):undefined,maintenance:readOperationState().maintenance,activeTaskId:activeTask()?.id,mysql,snapshots:listSnapshots()};
}
