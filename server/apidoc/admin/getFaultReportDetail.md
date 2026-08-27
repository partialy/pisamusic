# 获取故障上报批次详情

管理后台查看指定故障上报批次的详细设备环境及包含的所有日志明细。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/fault-reports/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 故障上报批次 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "u_abc123456",
    "scene": "play_url",
    "platform": "android",
    "arch": "arm64-v8a",
    "appVersion": "2.1.0",
    "appVersionCode": 210,
    "osVersion": "14",
    "sdkInt": 34,
    "brand": "Xiaomi",
    "model": "23127PN0CC",
    "networkType": "WIFI",
    "logCount": 1,
    "status": "pending",
    "createdAt": 1700000000000,
    "processedAt": null,
    "logs": [
      {
        "clientLogId": "c1a2c3d4-e5f6-7890-abcd-ef1234567891",
        "occurredAt": 1700000000000,
        "scene": "play_url",
        "failureType": "PARSER_EMPTY_URL",
        "methodName": "fetchPlayUrl",
        "requestMethod": "GET",
        "requestUrl": "https://gateway.partialy.cn/kg/play-url",
        "requestParamsJson": "{}",
        "nonceId": "",
        "responseCode": 200,
        "responseBody": "",
        "resolvedUrl": "",
        "errorType": "EmptyUrlException",
        "errorMessage": "解析结果中 playUrl 为空",
        "stackTrace": "",
        "songSource": "kg",
        "songId": "hash_123456",
        "quality": "320k"
      }
    ]
  },
  "success": true
}
```
