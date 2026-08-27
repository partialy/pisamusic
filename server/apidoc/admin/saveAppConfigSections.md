# 保存系统配置片段

管理员按模块增量保存系统配置。支持单独或合并提交 `availability`、`email`、`bootstrap`、`releases`、`agreement`、`privacy`、`about`、`discover` 等配置块。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/app-config-sections`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <admin_token>` |

### Request Body (JSON)

支持按需提交以下一个或多个配置片段：

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `availability` | `object` | 否 | 服务可用性开关与停机维护说明 |
| `email` | `object` | 否 | 邮件网关 URL、当前 provider 与 providers 列表 |
| `bootstrap` | `object` | 否 | 启动端点、网关验签密钥与 PC 自动更新配置 |
| `releases` | `object` | 否 | Android / PC 双端当前发布配置 |
| `agreement` | `object` | 否 | 服务协议 `{ title, content }` |
| `privacy` | `object` | 否 | 隐私政策 `{ title, content }` |
| `about` | `object` | 否 | 关于软件信息 |
| `discover` | `object` | 否 | 发现页配置 `{ url, updatedAt }` |

### 请求示例

```json
{
  "availability": {
    "appAvailable": true,
    "unavailableReason": "服务器维护中"
  }
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
    /* 保存后的完整最新 AppConfig 对象 */
  },
  "success": true
}
```
