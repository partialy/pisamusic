# App 推广追踪

与歌曲/歌单分享完全独立。只有 `/app-share/` 浏览器页面成功上报产生推广 PV；下载数表示安装包重定向触发次数，不表示下载完成、安装、注册或邀请人数。

## GET /api/app-share/public/:code

公开强制明文；独立 IP 限流（60秒60次，与访问上报共享），`Cache-Control: no-store`。`code` 严格为6位大小写敏感 Base62。

成功信封 `data: {code, valid: true, appName, iconUrl, description}`，不返回账号、设备、访问者或累计统计。非法、不存在、已失效短码统一404。

## POST /api/app-share/visits

公开强制明文，JSON：`{eventId, code, visitorId, openedAt, sequence?}`。

- eventId、visitorId 为UUID。每次真实进入页面生成新eventId，网络重试复用同一值；visitorId复用官网 `pm_site_visitor_id`。
- openedAt为页面打开的UTC毫秒，允许服务器当前时间前10分钟至后30秒；sequence为非负安全整数，默认0，辅助跨标签导航排序。
- 不接受明显机器人、空UA、预取或预渲染请求。输入无效400，机器人403，限流429附Retry-After。
- 返回 `data: {accepted:boolean, code}`；同一事件相同code/访客重试返回accepted=false，不重复计数。eventId跨身份复用拒绝400。
- 在一个SQLite事务内写入事件、主记录PV、最后访问时间、单码/全站日报。按上海自然日，单码/全站分别计算UV，全站UV不相加各短码UV。
- 仅保存加盐访客hash，不保存visitorId原文；referrer仅保存origin/path，去掉query/hash；UA最多512字符。

成功设置签名第一方 `pm_app_share_attribution` Cookie，HttpOnly、SameSite=Lax、Path=/、7天，生产强制Secure。独立密钥 `APP_SHARE_ATTRIBUTION_SECRET` 生产至少32字符，建议随机32字节hex（64字符）。开发未配置时使用每进程随机密钥。

Cookie仅保存匿名访客hash、版本和到期时间，不包含账号或设备身份。下载时服务端从近7天有效访问中按openedAt、sequence、接收时间查最后触点，较早访问的迟到响应不会覆盖新触点。禁Cookie时由显式code维持本次流程归因。

## GET /api/admin/app-share-records

管理员JWT及现有AES-GCM。query：

| 字段 | 说明 |
|---|---|
| keyword | 短码、用户名/历史用户名、账号ID或设备ID，最多200字符 |
| valid | true / false / all，默认all |
| timeField | createdAt（默认）/ lastVisitAt / lastDownloadAt |
| from,to | 按所选时间维度筛选，UTC毫秒，闭区间 |
| sort | createdAt（默认）/ visitCount / downloadCount / lastActiveAt，降序 |
| offset,limit | 默认0/20，limit 1–100 |

data为 `{items,total,offset,limit,summary,trend}`。每项字段：id、code、userId（游客null）、userName、userMissing、deviceId、deviceKind、deviceName、deviceMissing、createdAt、lastRequestedAt、lastVisitAt、lastDownloadAt、valid、invalidatedAt、visitCount、visitUv、androidDownloadCount、desktopDownloadCount、downloadCount、url。

账号/设备存在时显示实时名称，删除后显示历史展示快照；不保留Token或指纹。时间是毫秒或null。主记录长期保留，无级联删除。

summary为 `{total,validCount,invalidCount,visitCount,visitUv,androidDownloadCount,desktopDownloadCount,downloadCount,conversionRate}`。conversionRate=下载触发/PV，PV为0时null，可大于1。未筛选时visitUv为全站累计日UV；筛选记录后为所选短码累计日UV，不可标为全站独立访客。筛选根据记录时间维度选记录，统计为所选记录历史累计。

trend每项为 `{day,visitCount,visitUv,androidDownloadCount,desktopDownloadCount,downloadCount}`，day为上海自然日。无筛选时读取独立全站日报；有筛选时汇总选中短码日报。

## GET /api/admin/app-share-records/:id

管理员JWT及AES-GCM。query `{visitOffset=0,downloadOffset=0,limit=20}`。data `{record,trend,visits:{items,total},downloads:{items,total},retentionDays}`。

visits项：eventId、visitDay、openedAt、receivedAt、referrerPath、userAgent、browserDeviceType、isUniqueForShareDay；不返回visitorHash。downloads项：id、platform（android/desktop）、version、triggeredAt、attributionSource（explicit_code/cookie）、referrerPath、userAgent。

详细事件按ANALYTICS_RETENTION_DAYS（默认180，允许90–730）清理；主记录和日报长期保留。不存在或非法id返回404。

## PATCH /api/admin/app-share-records/:id/invalid

管理员JWT及AES-GCM。单向标记失效，返回 `{id,valid:false}`；重复失效幂等，不修改首次invalidatedAt。不可恢复、删除或手改计数。旧码永久占用不回收，原账号+设备再次GET配置获得新码。

## GET /api/admin/app-share-records/export

管理员JWT及AES-GCM；query与列表一致，忽略分页，导出当前筛选全部记录，返回加密JSON `data:{csv:string}`。CSV带UTF-8 BOM、北京时间、正确引号转义及Excel公式注入保护。仅包含分享人、账号ID、设备名称/ID、短码、创建时间、有效状态、PV、累计日UV、分平台/总下载触发；不导出IP、Token、设备指纹或访客hash。
