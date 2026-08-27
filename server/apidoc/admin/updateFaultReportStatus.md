# 更新故障上报处理状态

管理后台流转故障上报批次的处理状态（`pending` 待处理 / `processed` 已处理）。

- **请求方法**：`PATCH`
- **请求路径**：`/api/admin/fault-reports/:id/status`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 故障上报批次 UUID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `status` | `string` | 是 | `pending` 或 `processed` |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "故障上报状态已更新",
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "processed",
    "processedAt": 1700000060000
  },
  "success": true
}
```
