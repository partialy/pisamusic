# 管理员修改密码

管理员在后台登录状态下修改自身的管理员密码。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/change-password`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <admin_token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `currentPassword` | `string` | 是 | 原管理员密码 |
| `newPassword` | `string` | 是 | 新密码（长度 6-128 位，且不能与当前密码相同） |

### 请求示例

```json
{
  "currentPassword": "oldAdminPassword",
  "newPassword": "newAdminPassword"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "密码已修改",
  "data": {
    "updated": true
  },
  "success": true
}
```
