import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

// 独立随机库，避免触碰运行中的pm.db；保留测试产物供失败诊断。
process.env.PISA_APP_DB_PATH=path.resolve(__dirname,`../../data/app-share-tracking-test-${randomUUID()}.db`);
process.env.ANALYTICS_HASH_SALT="app-share-test-salt";
process.env.APP_SHARE_ATTRIBUTION_SECRET="app-share-test-secret-32-characters";

test("推广身份、事件幂等、UV、归因、失效和事务回滚",async()=>{
 const {getAppDb}=await import("./appDb.js");
 const store=await import("./appShareTrackingStore.js");
 const admin=await import("./appShareTrackingAdminStore.js");
 const analytics=await import("./analyticsStore.js");
 const service=await import("../services/appShareTrackingService.js");
 const db=getAppDb();
 const identity={deviceKind:"android" as const,deviceId:"device-1",userId:null,userName:"游客",deviceName:"测试设备"};
 const guest=store.getOrCreateTrackingRecord(identity,()=>"ABC123");
 assert.equal(store.getOrCreateTrackingRecord(identity).code,guest.code);
 const user=store.getOrCreateTrackingRecord({...identity,userId:"user-a",userName:"用户A"},()=>"abc123");
 const other=store.getOrCreateTrackingRecord({...identity,deviceId:"device-2"},()=>"DEF456");
 assert.notEqual(user.id,guest.id);assert.notEqual(other.id,guest.id);
 let attempts=0;const collision=store.getOrCreateTrackingRecord({...identity,deviceId:"device-3"},()=>attempts++===0?guest.code:"GHI789");
 assert.equal(collision.code,"GHI789");assert.equal(attempts,2);
 const now=Date.now(),hash=analytics.hashVisitorId(randomUUID());
 const event={eventId:randomUUID(),code:guest.code,visitorHash:hash,openedAt:now,sequence:1,referrerPath:"https://example.com/",userAgent:"Mozilla/5.0",browserDeviceType:"desktop",now};
 assert.equal(store.recordTrackingVisit(event).accepted,true);
 assert.equal(store.recordTrackingVisit(event).accepted,false);
 assert.equal(store.recordTrackingVisit({...event,eventId:randomUUID()}).accepted,true);
 store.recordTrackingVisit({...event,eventId:randomUUID(),code:user.code,openedAt:now+1,sequence:2});
 // 较早导航迟到，不能覆盖最新触点。
 store.recordTrackingVisit({...event,eventId:randomUUID(),openedAt:now-1,now:now+2});
 assert.equal(store.latestTrackingTouch(hash,now+2)?.code,user.code);
 const summary=admin.listTrackingRecords({timeField:"createdAt",sort:"createdAt",offset:0,limit:20}).summary;
 assert.equal(summary.visitCount,4);assert.equal(summary.visitUv,1);
 const visit=admin.trackingRecordDetail(guest.id,0,0,20)!;
 assert.equal(visit.record.visitUv,1);assert.equal(visit.visits.total,3);
 const input={platform:"android" as const,version:"1.0",fileRecordId:null,ipAddress:"",referrer:"https://example.com/?secret=1",userAgent:"Mozilla/5.0",occurredAt:now+3};
 store.recordTrackedDownload(input,{explicit:false,visitorHash:hash,safeReferrerPath:"https://example.com/"});
 assert.equal(store.readTrackingCode(user.code)?.android_download_count,1);
 store.recordTrackedDownload({...input,platform:"desktop"},{explicit:true,code:guest.code,visitorHash:hash,safeReferrerPath:""});
 assert.equal(store.readTrackingCode(guest.code)?.desktop_download_count,1);
 store.recordTrackedDownload(input,{explicit:true,code:"bad",visitorHash:hash,safeReferrerPath:""});
 assert.equal((db.prepare("SELECT COUNT(*) AS n FROM download_records").get() as {n:number}).n,3);
 assert.equal((db.prepare("SELECT COUNT(*) AS n FROM app_share_downloads").get() as {n:number}).n,2);
 assert.equal(store.latestTrackingTouch(hash,now+8*86400000),undefined);
 const cookie=service.signAttribution(hash,now);assert.equal(service.verifyAttribution(cookie,now),hash);assert.equal(service.verifyAttribution(cookie+"x",now),undefined);assert.equal(service.verifyAttribution(cookie,now+8*86400000),undefined);
 assert.equal(service.safeReferrer("https://example.com/path?token=x#code"),"https://example.com/path");
 store.invalidateTrackingRecord(guest.id);assert.equal(store.readTrackingCode(guest.code),undefined);
 assert.throws(()=>store.recordTrackingVisit({...event,eventId:randomUUID()}));
 const replacement=store.getOrCreateTrackingRecord(identity);assert.notEqual(replacement.code,guest.code);
 // 在官网日志写入后强制推广写入失败，检查整个事务回滚而非双写或半写。
 const before=(db.prepare("SELECT COUNT(*) AS n FROM download_records").get() as {n:number}).n;
 db.exec("CREATE TRIGGER app_share_test_fail BEFORE INSERT ON app_share_downloads BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 assert.throws(()=>store.recordTrackedDownload(input,{explicit:true,code:user.code,safeReferrerPath:""}));
 assert.equal((db.prepare("SELECT COUNT(*) AS n FROM download_records").get() as {n:number}).n,before);
 db.exec("DROP TRIGGER app_share_test_fail");
 const lifetime=store.readTrackingCode(user.code)!.visit_count;
 db.prepare("UPDATE app_share_visits SET received_at=?").run(now-181*86400000);
 analytics.maybeCleanupAnalytics(now+86400000);
 assert.equal((db.prepare("SELECT COUNT(*) AS n FROM app_share_visits").get() as {n:number}).n,0);
 assert.equal(store.readTrackingCode(user.code)!.visit_count,lifetime);
 assert.equal(admin.trackingRecordDetail(user.id,0,0,20)!.record.visitUv,1);
});
