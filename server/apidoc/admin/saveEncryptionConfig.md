# 更新加密白名单配置

更新端到端加密明文白名单路径。保存后立即热生效于当前运行中的加密中间件，无需重启服务器。系统强制保留关键静态资源与公开配置白名单。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/encryption-config`
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
| `plaintextPaths` | `string[]` | 是 | 白名单路径字符串数组（单条最多 256 字符，上限 200 条，支持末尾 `/*` 通配符） |

### 请求示例

```json
{
  "plaintextPaths": [
    "/api/health",
    "/api/config/releases",
    "/api/config/release-files/*",
    "/api/config/desktop-updates/*",
    "/api/config/discover",
    "/discover/*",
    "/uploads/*"
  ]
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "白名单已更新",
  "data": {
    "plaintextPaths": [
      "/api/health",
      "/api/config/releases",
      "/api/config/release-files/*",
      "/api/config/desktop-updates/*",
      "/api/config/discover",
      "/discover/*",
      "/uploads/*"
    ]
  },
  "success": true
}
```
