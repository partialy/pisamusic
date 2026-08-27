# 更新用户反馈处理状态

管理后台流转用户反馈的处理状态（`pending` 待处理 / `processed` 已处理）。

- **请求方法**：`PATCH`
- **请求路径**：`/api/admin/feedback/:id/status`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 反馈记录 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `status` | `string` | 是 | 目标状态：`pending` 或 `processed` |

### 请求示例

```json
{
  "status": "processed"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "反馈已标记为已处理",
  "data": {
    "id": "fb_123",
    "status": "processed",
    "processedAt": "2026-08-27T09:30:00.000Z"
  },
  "success": true
}
```
