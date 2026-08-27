# 查询 Android 设备状态

根据设备 ID 查询该 Android 设备的基本型号与封禁锁定状态。

- **请求方法**：`GET`
- **请求路径**：`/api/device/:id`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 设备 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "locked": false,
    "lockEndTime": null,
    "lastActiveAt": 1700000000000,
    "firstSeenAt": 1690000000000,
    "brand": "Xiaomi",
    "model": "23127PN0CC",
    "appVersion": "2.1.0"
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "Not Found",
  "data": null,
  "success": false
}
```
