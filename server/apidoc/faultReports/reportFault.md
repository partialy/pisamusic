# 批量上报播放/网络故障日志

客户端（Android 播放取链失败或 PC 桌面网络异常）批量上报结构化排障日志，便于服务端集中分析音源不可用、解析失效或网络故障。

- **请求方法**：`POST`
- **请求路径**：`/api/fault-reports`
- **需要鉴权**：否（可选携带 `Authorization: Bearer <UserToken>` 绑定当前用户 ID）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `reportId` | `string` | 是 | 客户端生成的批次 UUID |
| `scene` | `string` | 是 | 故障场景：`play_url`（播放取链失败）或 `desktop_network`（PC网络错误） |
| `environment` | `object` | 是 | 客户端运行环境信息 |
| `environment.platform` | `string` | 是 | `android` 或 `desktop` |
| `environment.arch` | `string` | 是 | 硬件架构（如 `arm64-v8a` 或 `x64`） |
| `environment.appVersion` | `string` | 是 | 应用版本名（如 `2.1.0`） |
| `environment.appVersionCode` | `number` | 是 | 应用版本号（如 `210`） |
| `environment.osVersion` | `string` | 是 | 操作系统版本（如 `14` 或 `Windows 11`） |
| `environment.sdkInt` | `number` | 否 | Android SDK API 级别 |
| `environment.brand` | `string` | 否 | 设备品牌 |
| `environment.model` | `string` | 否 | 设备型号 |
| `environment.networkType` | `string` | 否 | 当前网络类型（如 `WIFI` / `5G`） |
| `logs` | `Array<object>` | 是 | 详细故障日志数组（单次最多 300 条） |
| `logs[].clientLogId` | `string` | 是 | 日志项唯一 UUID（服务端用于排重） |
| `logs[].occurredAt` | `number` | 是 | 故障发生毫秒时间戳 |
| `logs[].scene` | `string` | 是 | 场景名称 |
| `logs[].failureType` | `string` | 否 | 失败类型 |
| `logs[].methodName` | `string` | 否 | 调用方法名 |
| `logs[].requestUrl` | `string` | 否 | 涉及的网络请求 URL |
| `logs[].responseCode` | `number \| null` | 否 | HTTP 响应码 |
| `logs[].responseBody` | `string` | 否 | 响应正文文本 |
| `logs[].errorType` | `string` | 否 | 异常类名 |
| `logs[].errorMessage` | `string` | 否 | 异常详细描述 |
| `logs[].stackTrace` | `string` | 否 | 异常调用栈 |
| `logs[].songSource` | `string` | 否 | 歌曲音源（`kg` / `wy` / `kw` / `tx`） |
| `logs[].songId` | `string` | 否 | 歌曲 ID |
| `logs[].quality` | `string` | 否 | 音质类型（`128k` / `320k` / `flac`） |

### 请求示例

```json
{
  "reportId": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
  "scene": "play_url",
  "environment": {
    "platform": "android",
    "arch": "arm64-v8a",
    "appVersion": "2.1.0",
    "appVersionCode": 210,
    "osVersion": "14",
    "sdkInt": 34,
    "brand": "Xiaomi",
    "model": "23127PN0CC",
    "networkType": "WIFI"
  },
  "logs": [
    {
      "clientLogId": "c1a2c3d4-e5f6-7890-abcd-ef1234567891",
      "occurredAt": 1700000000000,
      "scene": "play_url",
      "failureType": "PARSER_EMPTY_URL",
      "songSource": "kg",
      "songId": "hash_123456",
      "quality": "320k",
      "requestUrl": "https://gateway.partialy.cn/kg/play-url",
      "responseCode": 200,
      "errorMessage": "解析结果中 playUrl 为空"
    }
  ]
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "故障信息上报成功",
  "data": {
    "reportId": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "acceptedCount": 1,
    "duplicateCount": 0,
    "receivedCount": 1,
    "createdAt": 1700000001000
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `reportId` | `string` | 批次 ID |
| `acceptedCount` | `number` | 本次新增入库日志条数 |
| `duplicateCount` | `number` | 重复已忽略条数 |
| `receivedCount` | `number` | 接收到的总条数 |
| `createdAt` | `number` | 入库时间戳 |
