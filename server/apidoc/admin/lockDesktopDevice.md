# 锁定/解锁 PC 桌面设备

封禁或解封指定的 PC 桌面设备。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/desktop-device/:id/lock`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | PC 设备 UUID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `locked` | `boolean` | 是 | `true` 为锁定/封禁，`false` 为解除封禁 |
| `lockEndTime` | `number \| null` | 否 | 封禁到期毫秒时间戳，传 `null` 表示永久封禁 |

### 请求示例

```json
{
  "locked": true,
  "lockEndTime": null
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "locked": true,
    "lockEndTime": null
  },
  "success": true
}
```
