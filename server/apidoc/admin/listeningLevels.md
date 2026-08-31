# 听歌等级配置

管理员通过本接口读取和整体替换听歌等级区间。等级不是用户表中的固定字段：服务端依据用户累计听歌整数分钟和当前规则实时推导。累计分钟始终是跨设备、跨歌曲时间并集的 `floor(totalMs / 60000)`，不是各单曲统计的简单相加。

两个接口都不在明文白名单，必须使用端到端 AES-GCM 加密并携带 `x-pm-random`，同时要求 `Authorization: Bearer <AdminToken>`。正常业务响应会加密；加密中间件在安装响应加密包装前拒绝请求时（例如加密 Header、载荷、时间戳或 nonce 校验失败），该 `401` 响应可能为明文，客户端必须同时兼容明文失败响应与加密业务响应。示例展示解密后的标准 `ApiResponse.data`；加密信封细节见[全局通信规范](../common/overview.md)。

## 读取等级配置

- **请求方法**：`GET`
- **请求路径**：`/api/admin/listening/levels`
- **需要鉴权**：是（Admin JWT）
- **加密模式**：端到端加密

无需 Query 参数或设备 Header。

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "version": 1,
    "updatedAt": 0,
    "rules": [
      { "level": 1, "minMinutes": 0, "maxMinutes": null }
    ]
  },
  "success": true
}
```

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `version` | `number` | 正整数乐观并发版本；保存时必须原样作为 `expectedVersion` 提交。 |
| `updatedAt` | `number` | 当前配置最近更新的毫秒时间戳；默认种子值为 `0`。 |
| `rules` | `ListeningLevelRule[]` | 按 `level` 升序排列的完整连续闭区间集合。 |
| `rules[].level` | `number` | 从 `1` 开始连续编号。 |
| `rules[].minMinutes` | `number` | 包含的起始累计分钟。 |
| `rules[].maxMinutes` | `number \| null` | 包含的结束累计分钟；最后一级以 `null` 表示无上限。 |

服务首次初始化只预置默认规则 **Lv 1：0 分钟至无上限**，即 `{ level: 1, minMinutes: 0, maxMinutes: null }`；不预设其他阈值。

## 整体保存等级配置

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/listening/levels`
- **需要鉴权**：是（Admin JWT）
- **加密模式**：端到端加密

该请求是完整替换，不支持局部新增、更新或删除。服务端在事务中比较版本并保存全部规则，成功后将版本加一；管理员应在收到 `409` 后重新读取、处理冲突再提交。

### Request Body

| 字段 | 类型 | 必填 | 限制与说明 |
| :--- | :--- | :--- | :--- |
| `expectedVersion` | `number` | 是 | 正安全整数，必须等于最近一次读取的 `version`。 |
| `rules` | `array` | 是 | `1..100` 条完整规则。 |
| `rules[].level` | `number` | 是 | 正安全整数，必须按数组顺序从 `1` 连续编号。 |
| `rules[].minMinutes` | `number` | 是 | 非负安全整数；第一档必须为 `0`。 |
| `rules[].maxMinutes` | `number \| null` | 是 | 非 `null` 时为不小于 `minMinutes` 的安全整数；只有最后一档可为 `null`，且最后一档必须为 `null`。 |

所有等级均为整数分钟**闭区间**：相邻规则必须严格满足 `next.minMinutes = previous.maxMinutes + 1`，不得缺口或重叠；例如 `0..999` 与 `1000..null` 时，1000 分钟属于 Lv 2。

### 请求示例

```json
{
  "expectedVersion": 1,
  "rules": [
    { "level": 1, "minMinutes": 0, "maxMinutes": 999 },
    { "level": 2, "minMinutes": 1000, "maxMinutes": null }
  ]
}
```

### 成功响应

```json
{
  "code": 0,
  "msg": "听歌等级配置已保存",
  "data": {
    "version": 2,
    "updatedAt": 1787976900100,
    "rules": [
      { "level": 1, "minMinutes": 0, "maxMinutes": 999 },
      { "level": 2, "minMinutes": 1000, "maxMinutes": null }
    ]
  },
  "success": true
}
```

## 错误码

| HTTP 状态 | 业务 `code` | 场景 |
| :--- | :--- | :--- |
| `400` | `400` | `expectedVersion`、规则数量、等级编号或分钟闭区间不合法；包括首档非 0、不连续、重叠、非末档为 `null` 或末档不是 `null`。 |
| `401` | `401` | 缺少或无效 Admin JWT，或加密 Header、载荷、时间戳、nonce 校验失败。 |
| `409` | `409` | `expectedVersion` 与服务端配置版本不一致；不会覆盖其他管理员已保存的规则。 |
| `500` | `500` | 非预期服务端错误。 |
