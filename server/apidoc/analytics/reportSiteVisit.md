# 官网页面访问与日 UV 统计上报

官网前端页面浏览时异步上报访问统计。服务端通过加盐哈希唯一索引精确去重计算日独立访客（UV），并记录屏幕尺寸、语言、时区与 Referrer。

- **请求方法**：`POST`
- **请求路径**：`/api/analytics/site-visit`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `visitorId` | `string` | 是 | 客户端本地持久化（localStorage）生成的访客 UUID |
| `path` | `string` | 是 | 访问的页面路径（必须以 `/` 开头，如 `/` 或 `/download`） |
| `referrer` | `string` | 否 | 来源页面 URL |
| `language` | `string` | 否 | 浏览器语言设置（如 `zh-CN`） |
| `timezone` | `string` | 否 | 客户端时区（如 `Asia/Shanghai`） |
| `screenWidth` | `number` | 否 | 屏幕宽度像素值（0-20000） |
| `screenHeight` | `number` | 否 | 屏幕高度像素值（0-20000） |

### 请求示例

```json
{
  "visitorId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "path": "/download",
  "referrer": "https://www.google.com/",
  "language": "zh-CN",
  "timezone": "Asia/Shanghai",
  "screenWidth": 1920,
  "screenHeight": 1080
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
    "accepted": true,
    "visitDay": "2026-08-26"
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `accepted` | `boolean` | 是否记录成功（若当天该访客已记录 UV 则仍返回 true） |
| `visitDay` | `string` | 统计归属的东八区自然日日期（`YYYY-MM-DD`） |
