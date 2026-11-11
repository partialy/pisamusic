/** 隔离HTTP验收；--serve 可供浏览器验收，控制文件只写项目data目录。 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {spawn}=require("node:child_process"),{randomBytes,createHash,randomUUID}=require("node:crypto");
const {DatabaseSync}=require("node:sqlite");
const {encrypt,decrypt,randomFullKey}=require("../dist/crypto/aesGcm");
const jwt=require("jsonwebtoken");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=http.createServer();await new Promise(r=>s.listen(0,"127.0.0.1",r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function main(){
  const data=path.resolve(__dirname,"../data"),scratch=path.join(data,"http-verify-"+randomBytes(5).toString("hex"));fs.mkdirSync(scratch,{recursive:true});
  const port=await freePort(),base=`http://127.0.0.1:${port}`,sqlite=path.join(scratch,"pm.db");
  const secret=randomBytes(32).toString("hex"),setupToken="ui-local-test-setup-token";
  const env={...process.env,NODE_ENV:"development",DB_TYPE:"SQLITE",PISA_APP_DB_PATH:sqlite,MYSQL_URL:"",SETUP_TOKEN:setupToken,PORT:String(port),ADMIN_JWT_SECRET:secret,USER_JWT_SECRET:secret};
  let child,front,logs="";
  async function stop(){if(child){const p=child;child=undefined;p.kill();await Promise.race([new Promise(r=>p.once("exit",r)),sleep(3000)]);}}
  async function start(){
    logs="";child=spawn(process.execPath,[path.resolve(__dirname,"../dist/index.js")],{cwd:scratch,env,stdio:["ignore","pipe","pipe"]});
    child.stdout.on("data",c=>logs+=c);child.stderr.on("data",c=>logs+=c);
    for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error("HTTP服务启动失败："+logs);try{if((await fetch(base+"/api/health")).ok)return;}catch{}await sleep(100);}
    throw new Error("HTTP服务启动超时："+logs);
  }
  async function request(route,body,token,plain=false){
    const key=randomFullKey(),headers={"x-pm-random":key,"x-pm-enc-ver":"1"};if(token)headers.Authorization="Bearer "+token;
    let payload;if(body){headers["Content-Type"]="application/json";payload=plain?JSON.stringify(body):JSON.stringify({isEnc:true,encData:encrypt(key,JSON.stringify({ts:Date.now(),nonce:randomUUID(),p:body}))});}
    const res=await fetch(base+route,{method:body?"POST":"GET",headers,body:payload});let json=await res.json();
    if(json.isEnc)json=JSON.parse(decrypt(res.headers.get("x-pm-random"),json.encData));return {status:res.status,json};
  }
  try{
    // 故意放置旧的启用记录和损坏历史任务，确认普通启动不依赖它们。
    const operations=path.join(scratch,"data/operations");fs.mkdirSync(path.join(operations,"tasks"),{recursive:true});
    fs.writeFileSync(path.join(operations,"state.json"),JSON.stringify({maintenance:true,activatedMysql:true,taskId:"obsolete"}));
    fs.writeFileSync(path.join(operations,"tasks",randomUUID()+".json"),"broken history");
    await start();
    assert.equal((await request("/api/setup/status")).json.data.initialized,false);
    for(const route of ["/api/config/bootstrap","/API/config/bootstrap/","/api/admin/login","/uploads"]){assert.equal((await request(route)).status,503,route);}
    console.log("PASS HTTP空库可启动、旧本机记录无准入影响、安装门禁大小写一致");
    if(process.argv.includes("--serve")){
      const web=path.resolve(__dirname,"../web-admin");
      front=http.createServer((req,res)=>{
        if(req.url.startsWith("/api/")){
          const proxy=http.request(base+req.url,{method:req.method,headers:req.headers},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res);});proxy.on("error",()=>{res.statusCode=502;res.end();});req.pipe(proxy);return;
        }
        let requested;try{requested=decodeURIComponent(req.url.split("?")[0]);}catch{res.statusCode=400;res.end();return;}
        const file=path.resolve(web,"."+(requested==="/"?"/index.html":requested));
        if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
        res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".html")?"text/html":"application/octet-stream");fs.createReadStream(file).pipe(res);
      });await new Promise(r=>front.listen(0,"127.0.0.1",r));
      const control=path.join(data,"ui-verify-control.json");fs.writeFileSync(control,JSON.stringify({url:`http://127.0.0.1:${front.address().port}`,setupToken,username:"tester",password:"Test12345!",stop:false}));
      console.log("UI_READY "+`http://127.0.0.1:${front.address().port}`);
      while(!JSON.parse(fs.readFileSync(control,"utf8")).stop)await sleep(500);
      fs.unlinkSync(control);return;
    }
    const input={setupToken,username:"tester",password:"Test12345!",confirmPassword:"Test12345!"};
    assert.equal((await request("/api/setup/complete",{...input,setupToken:"bad"},undefined,true)).status,403);
    assert.equal((await request("/api/setup/complete",input,undefined,true)).status,200);
    const login=await request("/api/admin/login",{username:input.username,password:input.password});assert.equal(login.status,200);const token=login.json.data.token;
    assert.equal((await request("/api/admin/listening/levels",undefined,token)).status,200);
    for(const payload of [{sub:"tester"},{sub:"tester",installationId:"foreign"}])assert.equal((await request("/api/admin/listening/levels",undefined,jwt.sign(payload,secret))).status,401);
    console.log("PASS HTTP首次安装、加密登录、听歌等级默认值、旧及跨库管理员JWT隔离");
    await stop();
    const raw=new DatabaseSync(sqlite),marker=raw.prepare("SELECT * FROM app_installation WHERE id=1").get();
    raw.prepare("UPDATE runtime_configs SET value_json='777' WHERE key='storage.releaseDownloadUrlTtlSeconds'").run();
    raw.prepare("INSERT INTO users(id,email,username,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("u","u@example.invalid","user","unused",1,1);raw.close();
    const key=createHash("sha256").update("sqlite:"+marker.installation_id).digest("hex"),states=path.join(operations,"states");fs.mkdirSync(states,{recursive:true});fs.writeFileSync(path.join(states,key+".json"),JSON.stringify({maintenance:true,updatedAt:Date.now()}));
    await start();
    assert.equal((await request("/api/setup/status")).status,200);
    assert.equal((await request("/API/config/bootstrap/")).status,503);
    const relogin=await request("/api/admin/login",{username:input.username,password:input.password});assert.equal(relogin.status,200);
    const resume=await request("/api/admin/database-migration/maintenance/exit",{confirm:true},relogin.json.data.token);assert.equal(resume.status,200);
    const config=await request("/api/admin/runtime-config",undefined,relogin.json.data.token);assert.equal(config.status,200);assert.equal(config.json.data.snapshot["storage.releaseDownloadUrlTtlSeconds"],777);
    for(const payload of [{sub:"u"},{sub:"u",installationId:"foreign"}])assert.equal((await request("/api/auth/me",undefined,jwt.sign(payload,secret))).status,401);
    assert.equal((await request("/api/auth/me",undefined,jwt.sign({sub:"u",installationId:marker.installation_id},secret))).status,200);
    console.log("PASS HTTP维护中重启、状态查询、恢复前加载实际配置、用户JWT隔离");
  }finally{
    if(front)await new Promise(r=>front.close(r));await stop();const resolved=path.resolve(scratch);assert(resolved.startsWith(data+path.sep)&&path.basename(resolved).startsWith("http-verify-"));fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
