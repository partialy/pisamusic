import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { atomicWrite, operationsRoot, resourcePath } from "./stateStore";
import { inspectSqlite, type Upload } from "./sqliteSnapshots";

function positiveLimit(value:string|undefined,fallback:number):number{
  const n=Number(value??fallback);if(!Number.isSafeInteger(n)||n<1)throw new Error("迁移上传大小配置无效");return n;
}
export const uploadMaxBytes=positiveLimit(process.env.DB_MIGRATION_UPLOAD_MAX_BYTES,2147483648);
const uploadRoot=path.join(operationsRoot,"uploads");
let uploading=false;
export function reserveUpload():()=>void{
  if(uploading)throw new Error("已有数据库文件正在上传");
  fs.mkdirSync(uploadRoot,{recursive:true});
  const size=fs.readdirSync(uploadRoot).filter(n=>/^[a-f0-9-]{36}\.db$/.test(n)).reduce((sum,n)=>sum+fs.statSync(path.join(uploadRoot,n)).size,0);
  if(size+uploadMaxBytes>positiveLimit(process.env.DB_MIGRATION_STORAGE_MAX_BYTES,10*1024*1024*1024))throw new Error("迁移临时文件配额不足，请检查运维存储");
  uploading=true;return()=>{uploading=false;};
}
export const databaseUpload=multer({
  storage:multer.diskStorage({
    destination:(_req,_file,cb)=>{fs.mkdirSync(uploadRoot,{recursive:true});cb(null,uploadRoot);},
    filename:(_req,_file,cb)=>cb(null,randomUUID()+".db"),
  }),
  limits:{fileSize:uploadMaxBytes,files:1,fields:0,parts:1},
  fileFilter:(_req,file,cb)=>{if(!file.originalname.toLowerCase().endsWith(".db"))cb(new Error("仅接受完整 .db 快照"));else cb(null,true);},
}).single("file");
export function finishUpload(file:Express.Multer.File):Upload{
  try{
    const id=path.basename(file.filename,".db");
    const result:Upload={id,size:file.size,createdAt:Date.now(),tables:inspectSqlite(file.path)};
    atomicWrite(resourcePath("uploads",id),result);return result;
  }catch(error){fs.unlinkSync(file.path);throw error;}
}
