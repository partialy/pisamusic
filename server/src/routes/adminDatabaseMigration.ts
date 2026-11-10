import { Router, type RequestHandler } from "express";
import { ok,fail } from "../types/response";
import { databaseStatus } from "../operations/statusService";
import { createSnapshot,getSnapshot,parseSource,sourcePath } from "../operations/sqliteSnapshots";
import { activeTask,getTask,listTasks } from "../operations/migrationTasks";
import { cancelMaintenance,preflight,startMigration } from "../operations/migrationEngine";
import { databaseUpload,finishUpload,reserveUpload } from "../operations/uploadService";
import { safeError } from "../operations/mysqlTarget";
import { cleanupOperationFiles } from "../operations/retention";

export const adminDatabaseMigrationRouter=Router();
const action=(handler:RequestHandler):RequestHandler=>async(req,res,next)=>{
  res.setHeader("Cache-Control","no-store");
  try{await handler(req,res,next);}catch(e){if(!res.headersSent)res.status(422).json(fail(safeError(e),422));else next(e);}
};
adminDatabaseMigrationRouter.get("/status",action(async(_req,res)=>{res.json(ok(await databaseStatus()));}));
adminDatabaseMigrationRouter.post("/preflight",action(async(req,res)=>{res.json(ok(await preflight(parseSource(req.body),req.body?.retryTaskId)));}));
adminDatabaseMigrationRouter.post("/snapshots",action(async(req,res)=>{if(activeTask()){res.status(409).json(fail("迁移期间禁止另行生成快照",409));return;}cleanupOperationFiles();res.json(ok(await createSnapshot(parseSource(req.body))));}));
adminDatabaseMigrationRouter.get("/snapshots/:id/download",action(async(req,res,next)=>{
  const id=String(req.params.id);const snapshot=getSnapshot(id);
  res.setHeader("X-Content-Type-Options","nosniff");
  res.download(sourcePath({sourceType:"snapshot",sourceId:id}),`pm-backup-${new Date(snapshot.createdAt).toISOString().replace(/[:.]/g,"-")}.db`,error=>{if(error)next(error);});
}));
adminDatabaseMigrationRouter.post("/uploads",action(async(req,res)=>{
  if(activeTask()){res.status(409).json(fail("迁移期间禁止上传",409));return;}
  cleanupOperationFiles();const release=reserveUpload();req.setTimeout(5*60_000);
  try{
    await new Promise<void>((resolve,reject)=>databaseUpload(req,res,error=>error?reject(error):resolve()));
    if(!req.file)throw new Error("请选择完整 .db 文件");
    res.json(ok(finishUpload(req.file)));
  }finally{release();}
}));
adminDatabaseMigrationRouter.post("/tasks",action(async(req,res)=>{
  if(req.body?.confirm!==true){res.status(400).json(fail("需确认维护模式和空目标库",400));return;}
  if(activeTask()){res.status(409).json(fail("已有迁移任务正在执行",409));return;}
  res.status(202).json(ok(startMigration(parseSource(req.body),req.body?.retryTaskId)));
}));
adminDatabaseMigrationRouter.get("/tasks",action(async(_req,res)=>{res.json(ok(listTasks()));}));
adminDatabaseMigrationRouter.get("/tasks/:id",action(async(req,res)=>{res.json(ok(getTask(String(req.params.id))));}));
adminDatabaseMigrationRouter.get("/tasks/:id/report",action(async(req,res)=>{res.setHeader("Content-Disposition",`attachment; filename="migration-report.json"`);res.json(ok(getTask(String(req.params.id))));}));
adminDatabaseMigrationRouter.post("/maintenance/exit",action(async(req,res)=>{
  if(req.body?.confirm!==true){res.status(400).json(fail("需确认安全恢复 SQLite",400));return;}
  await cancelMaintenance();res.json(ok({maintenance:false}));
}));
