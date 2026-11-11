/** 独立部署/安装/双向复制验收。只创建随机命名的隔离库，不写 env 指向的业务库。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const dist = name => require(path.join(__dirname, "../dist", name));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function worker(mode) {
  if(mode==="ddl-interrupt"){
    const db=await dist("db/core/createDatabase").createDatabase();
    const execute=db.execute.bind(db);let calls=0;
    db.execute=async(sql,params)=>{if(++calls===20)throw new Error("injected DDL interruption");return execute(sql,params);};
    try{
      await assert.rejects(dist("db/schema/runner").prepareDatabaseSchema(db,"test-ddl-interrupted"));
      assert.equal((await db.queryOne("SELECT transfer_status FROM app_installation WHERE id=1")).transfer_status,"incomplete");
      console.log("PASS 注入首次DDL中断，安装标记保持incomplete");
    }finally{await db.close();}return;
  }
  const { initializeDatabase } = dist("db/appDb");
  const { validateDatabaseSwitch } = dist("operations/startup");
  const { initializeInstallation, completeSetup, setupStatus } = dist("services/setupService");
  const { bindOperationDatabase, readOperationState } = dist("operations/maintenance");
  const { readInstallation, markTransferIncomplete } = dist("db/installationStore");
  if(mode==="blocked"){
    await assert.rejects(initializeDatabase(), /复制未完成|中断|未完成/);
    console.log("PASS 不完整目标拒绝普通启动及重新初始化");return;
  }
  const db = await initializeDatabase();
  try {
    await validateDatabaseSwitch(db); await initializeInstallation(); await bindOperationDatabase(db);
    if (mode === "fresh") {
      assert.equal((await setupStatus()).initialized, false);
      await assert.rejects(completeSetup({ setupToken: "wrong", username: "tester", password: "Test12345!", confirmPassword: "Test12345!" }));
      const input = { setupToken: process.env.SETUP_TOKEN, username: "tester", password: "Test12345!", confirmPassword: "Test12345!" };
      const settled = await Promise.allSettled([completeSetup(input), completeSetup(input)]);
      assert.equal(settled.filter(r => r.status === "fulfilled").length, 1, "并发安装只能成功一次");
      assert.equal((await setupStatus()).initialized, true);
      assert.equal(Number((await db.queryOne("SELECT COUNT(*) AS n FROM admin_users")).n), 1);
      assert.equal((await dist("db/listeningStore").readLevelConfig()).rules.length, 1);
      console.log("PASS 空库独立安装、令牌校验、并发首管与默认配置：" + db.dialect);
    } else if (mode === "seed") {
      await db.execute("INSERT INTO users(id,email,username,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)", ["user-1", "test@example.invalid", "中文🎵", "not-a-real-password", 1, 2]);
      await db.execute("INSERT INTO user_sync_items(user_id,item_type,item_key,payload_json,deleted,server_version,server_updated_at) VALUES(?,?,?,?,?,?,?)", ["user-1", "favorite_song", "kg:1", '{"name":"往返音乐🎶"}', 1, 9007199254740000, 4]);
      await db.execute("INSERT INTO dynamic_configs(id,type,content,created_at,updated_at) VALUES(?,?,?,?,?)", ["roundtrip", "string", "多行\n引号\" emoji🎶", 3, 4]);
      await db.execute("INSERT INTO user_listening_stats(user_id,total_ms,updated_at) VALUES(?,?,?)", ["user-1", 1234567890123, 5]);
      const marker = await readInstallation();
      fs.writeFileSync(path.join(process.cwd(), "installation-id.txt"), marker.installation_id);
    } else if (mode === "sync" || mode === "switch") {
      const { startMigration, preflight } = dist("operations/migrationEngine");
      const pre = await preflight({ sourceType: "server" });
      assert(pre.passed, JSON.stringify(pre.checks));
      const task = startMigration({ sourceType: "server" }, undefined, { mode, confirmOverwrite: true });
      const { getTask } = dist("operations/migrationTasks");
      const start = Date.now(); let latest;
      while (Date.now() - start < 180000) {
        latest = getTask(task.id);
        if (["COMPLETED", "READY_TO_SWITCH", "FAILED"].includes(latest.status)) break;
        await sleep(50);
      }
      assert.equal(latest.status, mode === "sync" ? "COMPLETED" : "READY_TO_SWITCH", latest.error+" "+JSON.stringify(latest.logs));
      assert(latest.tables.every(t => t.status === "VERIFIED")); assert(latest.targetBackupId);
      assert.equal(readOperationState().maintenance, mode === "switch");
      fs.writeFileSync(path.join(process.cwd(), "last-task.json"), JSON.stringify(latest));
      console.log(`PASS ${db.dialect} ${mode}：${latest.tables.length}表 / ${latest.processedRows}行 / 目标备份与逐字段摘要`);
    } else if (mode === "check") {
      const row = await db.queryOne("SELECT * FROM dynamic_configs WHERE id='roundtrip'"); assert.equal(row.content, "多行\n引号\" emoji🎶");
      const item = await db.queryOne("SELECT * FROM user_sync_items WHERE user_id='user-1'"); assert.equal(Number(item.deleted), 1); assert.equal(Number(item.server_version), 9007199254740000);
      assert.equal(Number((await db.queryOne("SELECT total_ms FROM user_listening_stats WHERE user_id='user-1'")).total_ms), 1234567890123);
      assert.equal((await readInstallation()).installation_id, fs.readFileSync(path.join(process.cwd(), "installation-id.txt"), "utf8"));
      assert.equal(Number((await db.queryOne("SELECT COUNT(*) AS n FROM dynamic_configs WHERE id='target-extra'")).n), 0);
      console.log("PASS 往返数据、删除标记、同步游标、大整数、安装身份、目标多余记录清理");
    } else if (mode === "extra") {
      await db.execute("INSERT INTO dynamic_configs(id,type,content,created_at,updated_at) VALUES(?,?,?,?,?)", ["target-extra", "string", "应被覆盖", 1, 1]);
    } else if (mode === "restore") {
      const task=JSON.parse(fs.readFileSync(path.join(process.cwd(),"last-task.json"),"utf8"));
      await dist("operations/migrationEngine").restoreTargetBackup(task.targetBackupId,true);
      console.log("PASS 覆盖前目标备份恢复并逐字段校验");
    } else if (mode === "check-restored") {
      assert.equal((await db.queryOne("SELECT content FROM dynamic_configs WHERE id='target-extra'")).content,"应被覆盖");
      console.log("PASS 目标原有记录已从备份恢复");
    } else if (mode === "reject-incomplete-backup") {
      const task=JSON.parse(fs.readFileSync(path.join(process.cwd(),"last-task.json"),"utf8"));
      await assert.rejects(dist("operations/migrationEngine").restoreTargetBackup(task.targetBackupId,true),/备份|完整|恢复/);
      console.log("PASS 未完成目标备份不能被恢复为ready，正常目标保持不变");
    } else if (mode === "incomplete") {
      await markTransferIncomplete(db, "test-interrupted");
    } else if (mode === "v1") {
      await db.execute("DELETE FROM schema_migrations WHERE version=2");
      await db.execute("DROP TABLE app_installation");
      const mysql = db.dialect === "mysql";
      await db.execute(mysql ? "INSERT IGNORE INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at,completed_at) VALUES(1,'old-fingerprint','applied','obsolete-task','[]',1,1)" : "INSERT OR IGNORE INTO schema_migrations(version,fingerprint,status,started_at,completed_at) VALUES(1,'old-fingerprint','applied',1,1)");
    } else if (mode === "adopt") {
      assert.equal((await setupStatus()).initialized, true);
      assert.equal(Number((await db.queryOne("SELECT MAX(version) AS n FROM schema_migrations")).n), 2);
      if(db.dialect==="sqlite")fs.writeFileSync(path.join(process.cwd(), "installation-id.txt"), (await readInstallation()).installation_id);
      console.log("PASS v1旧库升级、管理员兼容认领、不依赖本机旧迁移记录");
    } else if (mode === "rollback") {
      const { createSnapshot, sourcePath } = dist("operations/sqliteSnapshots");
      const { replaceFromSnapshot, ensureSqliteArchives } = dist("operations/databaseCopy");
      const { newTask } = dist("operations/migrationTasks");
      const { DatabaseSync } = require("node:sqlite");
      const snap = await createSnapshot({sourceType:"server"});
      const src = new DatabaseSync(sourcePath({sourceType:"snapshot",sourceId:snap.id}));
      try {
        src.exec("UPDATE users SET username='' WHERE id='user-1'");
        await db.execute("CREATE TRIGGER fail_copy BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT,'injected failure'); END");
        await ensureSqliteArchives(db); await markTransferIncomplete(db,"injected");
        await assert.rejects(replaceFromSnapshot(src,db,newTask({sourceType:"server"})));
        assert.equal((await db.queryOne("SELECT username FROM users WHERE id='user-1'")).username,"中文🎵");
        assert.equal((await readInstallation()).transfer_status,"incomplete");
        await db.execute("DROP TRIGGER fail_copy");
        await dist("db/installationStore").markTransferReady(db);
        console.log("PASS 注入复制失败事务回滚、原数据保留、目标中断标记持久化");
      } finally { src.close(); }
    } else if (mode === "restore-guard") {
      await markTransferIncomplete(db,"injected-backup-source");
      const snapshot=await dist("operations/databaseSnapshot").snapshotDatabase(db);
      process.env.MYSQL_URL="mysql://invalid:invalid@127.0.0.1:1/never_used";
      await assert.rejects(dist("operations/migrationEngine").restoreTargetBackup(snapshot.id,true),/备份|完整|恢复/);
      await dist("db/installationStore").markTransferReady(db);
      console.log("PASS incomplete备份在连接目标前被拒绝，不能提升为可用库");
    }
  } finally { await db.close(); }
}

async function main() {
  require("dotenv").config({path:path.join(__dirname,"../.env"),quiet:true});
  const {readDatabaseConfig}=dist("db/core/config");
  const id=randomBytes(5).toString("hex"), root=path.resolve(__dirname,"../data"), scratch=path.join(root,"independent-verify-"+id);
  const database="pm_independent_verify_"+id, sqlite=path.join(scratch,"source.db");
  const base={...process.env,PISA_APP_DB_PATH:sqlite,SETUP_TOKEN:"isolated-test-setup-token",ADMIN_JWT_SECRET:randomBytes(32).toString("hex"),USER_JWT_SECRET:randomBytes(32).toString("hex")};
  let admin,created=false;
  fs.mkdirSync(scratch,{recursive:true});
  const run=(mode,type="SQLITE",overrides={})=>{
    const result=spawnSync(process.execPath,[__filename,"worker",mode],{cwd:scratch,env:{...base,DB_TYPE:type,...overrides},encoding:"utf8",timeout:240000});
    if(result.stdout)process.stdout.write(result.stdout);
    if(result.status!==0)throw new Error(`隔离验收 ${mode}/${type} 失败：${result.stderr || result.error?.message || result.status}`);
  };
  try{
    run("fresh");run("seed");run("rollback");run("restore-guard");run("v1");run("adopt");
    if(process.argv.includes("--sqlite-only")){console.log("SQLite隔离验收通过（明确跳过MySQL）");return;}
    const config=readDatabaseConfig({...process.env,DB_TYPE:"MYSQL"});
    const mysql=require("mysql2/promise");
    admin=await mysql.createConnection({host:config.host,port:config.port,user:config.user,password:config.password,connectTimeout:config.connectTimeout});
    const [existing]=await admin.execute("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?",[database]);assert.equal(existing.length,0);
    await admin.query("CREATE DATABASE `"+database+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");created=true;
    const url=new URL(process.env.MYSQL_URL);url.pathname="/"+database;base.MYSQL_URL=url.toString();
    run("fresh","MYSQL");run("extra","MYSQL");run("sync");run("check","MYSQL");
    run("restore");run("check-restored","MYSQL");run("sync");
    // 目标中断仍允许原库重做完整同步；不依赖旧任务所有权。
    run("incomplete","MYSQL");run("blocked","MYSQL");run("switch");run("check","MYSQL");run("reject-incomplete-backup");run("check","MYSQL");
    // 新目标是不同SQLite路径，验证可独立建立反向副本。
    const reverse=path.join(scratch,"reverse.db");
    run("sync","MYSQL",{PISA_APP_DB_PATH:reverse});run("check","SQLITE",{PISA_APP_DB_PATH:reverse});
    run("v1","MYSQL");run("adopt","MYSQL");
    await admin.query("USE `"+database+"`");
    const cleanup=fs.readFileSync(path.join(__dirname,"sql/cleanup-legacy-migration-metadata.sql"),"utf8").split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
    for(const statement of cleanup.split(";").filter(s=>s.trim()))await admin.query(statement);
    const [ledger]=await admin.query("SELECT version,status FROM schema_migrations");assert.equal(ledger.length,1);assert.equal(Number(ledger[0].version),2);
    const [admins]=await admin.query("SELECT COUNT(*) AS n FROM admin_users");assert.equal(Number(admins[0].n),1);
    console.log("PASS 旧迁移元数据清理SQL保留当前Schema、安装与管理员");
    await admin.query("DROP DATABASE `"+database+"`");created=false;
    await admin.query("CREATE DATABASE `"+database+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");created=true;
    run("ddl-interrupt","MYSQL");run("blocked","MYSQL");run("sync");run("check","MYSQL");
    console.log("PASS 首次建表中断后从源库重新复制并完整恢复");
    console.log("全部隔离数据库验收通过；env业务库未写入。");
  }finally{
    try{if(created&&admin)await admin.query("DROP DATABASE `"+database+"`");}finally{await admin?.end();}
    const resolved=path.resolve(scratch);assert(resolved.startsWith(root+path.sep)&&path.basename(resolved).startsWith("independent-verify-"));fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(process.argv[2]==="worker")worker(process.argv[3]).catch(error=>{console.error(error);process.exitCode=1;});
else main().catch(error=>{console.error("VERIFY_FAILED:",error?.code || error.message);process.exitCode=1;});
