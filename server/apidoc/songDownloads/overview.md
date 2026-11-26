# 歌曲下载统计与配额模块

本模块用于记录客户端选择音质并确认开始下载的歌曲批次与单曲明细，同时提供四档策略优先级与日/周/月/总次数 + 永久额外次数的混合扣减控制（周期按北京时间 `Asia/Shanghai` UTC+8 计算：每日 00:00、每周一 00:00、每月 1 日 00:00 刷新）。

- **配额主体**：
  - 已登录用户：`subjectType="user"`、`subjectKey=userId`（多端共享账号配额）。
  - 未登录游客：`subjectType="device"`、`subjectKey="<kind>:<deviceId>"`（单设备隔离，默认 `2/日、10/周、30/月、30/总`）。
- **四档策略优先级**（由高到低）：
  1. 账号/设备本身独立覆盖（`overrideEnabled=true`）
  2. 有效 VIP 对应隐藏档位（`vipLevel = 1..N`，不向前端暴露；VIP 过期后自动回落大众用户档位，数据库保留历史 `vip_level`）
  3. 大众用户（已注册普通账号，默认 `10/日、100/周、1000/月、总数不限`；新注册赠送 `registerGiftExtraCount` 默认 `10` 次永久额外次数）
  4. 游客设备（`isGuest=true`）
- **混合扣减（拼额度）**：优先扣减常规周期配额 `regularCharged = min(requiredCount, regularAvailable)`，不足部分从 `extra_balance` 永久额外次数补齐；**消耗的额外次数不计入日/周/月/总已用计数**，但明细记录仍全量留痕。

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
    "isGuest": false,
    "overrideEnabled": false,
    "tierSource": "standard",
    "extraRemaining": 10,
    "daily": { "limit": 10, "used": 1, "remaining": 9 },
    "weekly": { "limit": 100, "used": 1, "remaining": 99 },
    "monthly": { "limit": 1000, "used": 1, "remaining": 999 },
    "total": { "limit": null, "used": 1, "remaining": null }
  }
}
```
- 若常规余量 + `extraRemaining` 仍不足：`allowed: false`、`batchId: null`、`chargedCount: 0`，`quota` 返回实时余量及 `isGuest` / `extraRemaining`。

### 1.2 查询当前下载配额

- **Method / Path**: `GET /api/song-downloads/quota`
- **Headers**: 同上
- **Response (`code: 0`)**: 返回 `SongDownloadQuotaSnapshot`。

---

## 2. 管理后台接口 (`/api/admin/song-downloads/*`，需 Admin JWT + 加密)

| 接口 | Method | 说明 |
| --- | --- | --- |
| `/api/admin/song-downloads/overview?days=7\|30\|90` | `GET` | 概览统计、音源/平台占比及零填充日趋势 |
| `/api/admin/song-downloads/top-songs?days=7\|30\|90\|all&source=all\|kg\|wy\|kw\|cloud&offset&limit` | `GET` | 歌曲下载 Top 排行（标准分页：`{ list, total, offset, limit, hasMore }`） |
| `/api/admin/song-downloads/records?keyword&source&platform&subjectType&userId&deviceId&startDay&endDay&offset&limit` | `GET` | 用户/设备下载动态流水（标准分页：`{ list, total, offset, limit, hasMore }`） |
| `/api/admin/song-downloads/tier-policies` | `GET / PUT` | 读取/保存四档配额策略（游客、大众用户、新注册赠送额外次数、`vipTiers` 动态多档） |
| `/api/admin/song-downloads/default-quota` | `GET / PUT` | 兼容入口：读取/保存游客默认配额 |
| `/api/admin/song-downloads/quotas?subjectType=all\|user\|device&keyword&offset&limit` | `GET` | 分页查询用户/设备配额与用量状态（含 `tierSource` 与 `extraRemaining`） |
| `/api/admin/song-downloads/quotas/batch` | `PUT` | 批量设置多主体独立覆盖、增减 `extraDelta` 及计数重置（1–500 个主体） |
| `/api/admin/song-downloads/quotas/:subjectType/:subjectKey` | `GET / PUT` | 读取/设置单个主体独立覆盖、覆盖 `extraBalance` 及计数重置 |

> 分页说明：`/top-songs`、`/records`、`/quotas` 三个分页接口均接收 `offset`（默认 `0`）、`limit` 参数，统一返回 `PaginatedListData<T>` 结构 `{ list, total, offset, limit, hasMore }`。
