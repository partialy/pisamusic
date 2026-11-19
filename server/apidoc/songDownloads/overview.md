# 歌曲下载统计与配额模块

本模块用于记录客户端选择音质并确认开始下载的歌曲批次与单曲明细，同时提供日/周/月/总次数四维度的可配置配额限制（默认日/周/月不限制、总数 `999999` 次，周期按北京时间 `Asia/Shanghai` UTC+8 计算：每日 00:00、每周一 00:00、每月 1 日 00:00 刷新）。

- 已登录用户：以 `subjectType="user"`、`subjectKey=userId` 为配额主体（多端共享账号配额）。
- 未登录游客：以 `subjectType="device"`、`subjectKey="<kind>:<deviceId>"` 为配额主体。
- 无论是否登录，所有批次与明细均保留 `user_id`、`device_kind`、`device_id`、`platform`。

---

## 1. 客户端接口（加密）

### 1.1 校验并扣减下载配额（记录下载批次）

- **Method / Path**: `POST /api/song-downloads/acquire`
- **Headers**:
  - `x-pm-device-token`: 必填，设备上报签发的 30 天设备消息凭证
  - `Authorization`: 可选，`Bearer <userToken>`（若携带无效/过期 Token 返回 `401`，不降级为游客）
- **Body**:
```json
{
  "clientBatchId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "desktop",
  "items": [
    {
      "source": "wy",
      "songId": "123456",
      "name": "歌曲名",
      "singer": "歌手名",
      "album": "专辑名",
      "cover": "https://...",
      "durationMs": 240000,
      "qualityKey": "wy-level:lossless"
    }
  ]
}
```
- **Response (`code: 0`)**:
```json
{
  "allowed": true,
  "deduplicated": false,
  "batchId": "...",
  "chargedCount": 1,
  "requiredCount": 1,
  "quota": {
    "subjectType": "user",
    "subjectKey": "u1",
    "overrideEnabled": false,
    "daily": { "limit": null, "used": 1, "remaining": null },
    "weekly": { "limit": null, "used": 1, "remaining": null },
    "monthly": { "limit": null, "used": 1, "remaining": null },
    "total": { "limit": 999999, "used": 1, "remaining": 999998 }
  }
}
```
- 若配额不足：`allowed: false`、`batchId: null`、`chargedCount: 0`，`quota` 返回当前各维度实时 `limit / used / remaining`（`null` 表示不限制）。

### 1.2 查询当前下载配额

- **Method / Path**: `GET /api/song-downloads/quota`
- **Headers**: 同上
- **Response (`code: 0`)**: 返回 `SongDownloadQuotaSnapshot`。

---

## 2. 管理后台接口 (`/api/admin/song-downloads/*`，需 Admin JWT + 加密)

| 接口 | Method | 说明 |
| --- | --- | --- |
| `/api/admin/song-downloads/overview?days=7\|30\|90` | `GET` | 概览统计、音源/平台占比及零填充日趋势 |
| `/api/admin/song-downloads/top-songs?days=7\|30\|90\|all&source=all\|kg\|wy\|kw\|cloud&offset&limit` | `GET` | 歌曲下载 Top 排行 |
| `/api/admin/song-downloads/records?keyword&source&platform&subjectType&userId&deviceId&startDay&endDay&offset&limit` | `GET` | 用户/设备下载动态流水 |
| `/api/admin/song-downloads/default-quota` | `GET / PUT` | 读取/保存全局默认配额（同步写入 `runtime_configs`） |
| `/api/admin/song-downloads/quotas?subjectType=all\|user\|device&keyword&offset&limit` | `GET` | 分页查询用户/设备配额与用量状态 |
| `/api/admin/song-downloads/quotas/:subjectType/:subjectKey` | `GET / PUT` | 读取/设置指定用户或设备的独立配额覆盖及计数重置 |
