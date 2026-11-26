# 兑换码与核销模块

本模块用于管理后台批量生成（支持批次命名与聚合管理）、批量启停/清理与停用兑换码，以及客户端用户兑换领取额外下载次数或系统 VIP 时长（支持有效期叠加与隐藏档位自动升档）。

---

## 1. 客户端兑换接口（加密）

### 1.1 兑换码核销

- **Method / Path**: `POST /api/redemption-codes/redeem`
- **Headers**:
  - `Authorization`: 必填，`Bearer <userToken>`
- **限流**: 按 IP 滑动窗口 60 秒最多 20 次
- **Body**:
```json
{
  "code": "PM8K2N9Q4X"
}
```
- **说明**:
  - 兑换码忽略大小写与首尾空白。
  - 若奖励类型为 `extra_downloads`，原子累加至该用户的永久 `extra_balance`，并记录 `song_download_extra_logs`。
  - 若奖励类型为 `vip`，时长在 `max(当前时间, 原 vipExpiresAt) + rewardAmount * 86400000` 基础上叠加，隐藏 `vipLevel` 取 `max(原 vipLevel, 兑换码 vipLevel)`；公开响应始终返回 `vipLevel: null`，不向客户端暴露隐藏档位。
  - 通用多用码同一用户仅允许成功核销一次；并发核销通过数据库行锁及 `used_count < max_uses` 防止超卖。
- **Response (`code: 0`)**:
```json
{
  "code": "PM8K2N9Q4X",
  "rewardType": "vip",
  "rewardAmount": 30,
  "vipLevel": null,
  "extraBalance": 10,
  "vipExpiresAt": 1798761600000
}
```

---

## 2. 管理后台接口 (`/api/admin/redemption-codes/*`，需 Admin JWT + 加密)

| 接口 | Method | 说明 |
| --- | --- | --- |
| `/api/admin/redemption-codes/batches` | `GET` | 按批次聚合分页查询（每批次一条摘要记录；`keyword` 支持搜批次名/批次ID/备注或任意子兑换码定位所属批次） |
| `/api/admin/redemption-codes/batches/:batchId` | `PATCH` | 修改指定批次名称（`{ batchName }`） |
| `/api/admin/redemption-codes` | `GET` | 分页查询兑换码明细（支持 `batchId`、`keyword`、`rewardType`、`enabled`、`usageStatus=unused\|used`） |
| `/api/admin/redemption-codes` | `POST` | 批量生成唯一码（`mode="single_batch"`）或创建通用多人码（`mode="shared"`），支持 `batchName` |
| `/api/admin/redemption-codes/:id` | `PATCH` | 启用或停用单个兑换码（已核销完成 `usedCount >= maxUses` 时不可更改） |
| `/api/admin/redemption-codes/:id` | `DELETE` | 删除单个未使用的兑换码（已使用 `usedCount > 0` 禁止删除，保护核销审计） |
| `/api/admin/redemption-codes/batch-status` | `POST` | 批量启用/停用（传 `ids` 或 `batchId`，支持 `onlyUnused: true` 跳过已使用码） |
| `/api/admin/redemption-codes/batch-delete` | `POST` | 批量删除未使用兑换码（传 `ids` 或 `batchId`，`onlyUnused: true` 仅删未使用并保留已使用审计） |
| `/api/admin/redemption-codes/logs` | `GET` | 分页查询核销流水日志（`keyword`、`userId`、`offset`、`limit`） |

### 2.1 生成兑换码请求示例 (`POST /api/admin/redemption-codes`)

```json
{
  "mode": "single_batch",
  "batchName": "开服福利",
  "count": 20,
  "prefix": "PM",
  "rewardType": "extra_downloads",
  "rewardAmount": 50,
  "vipLevel": 1,
  "expiresAt": null,
  "remark": "群活动福利"
}
```

> 分页说明：`/batches`、`/`、`/logs` 均统一返回 `PaginatedListData<T>` `{ list, total, offset, limit, hasMore }`。
