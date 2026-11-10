import fs from "node:fs";
import path from "node:path";
import { listTasks } from "./migrationTasks";
import { listJson, operationsRoot, resourcePath } from "./stateStore";
import type { Snapshot, Upload } from "./sqliteSnapshots";

/** 只清理运维模块自己签发的文件；保留被任务引用的备份及上传来源。 */
export function cleanupOperationFiles():void{
  const tasks=listTasks();const pinned=new Set(tasks.flatMap(t=>[t.snapshotId,t.source.sourceId].filter((id):id is string=>!!id)));
  for(const [kind,ttl] of [["snapshots",7*86400000],["uploads",86400000]] as const){
    for(const item of listJson<Snapshot|Upload>(kind)){
      if(pinned.has(item.id)||Date.now()-item.createdAt<ttl) continue;
      const file=resourcePath(kind,item.id,".db");const metadata=resourcePath(kind,item.id);
      const root=path.resolve(operationsRoot,kind)+path.sep;
      if(!file.startsWith(root)||!metadata.startsWith(root)) throw new Error("运维清理路径越界");
      if(fs.existsSync(file))fs.unlinkSync(file);
      if(fs.existsSync(metadata))fs.unlinkSync(metadata);
    }
  }
}
