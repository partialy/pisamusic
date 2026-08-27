# 获取官网记录详情

管理后台查看单条官网访问或安装包下载记录的完整字段（包括 IP、Referrer、User-Agent 等）。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/website-records/:type/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 是 | 记录类型：`visit` 或 `download` |
| `id` | `string` | 是 | 记录 ID |

---

## 响应数据

### 成功响应 (type = visit)

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "rec_123",
    "visitDay": "2026-08-26",
    "path": "/download",
    "referrer": "https://www.google.com/",
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "ipAddress": "120.24.0.1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "createdAt": 1700000000000
  },
  "success": true
}
```

### 成功响应 (type = download)

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "dl_456",
    "platform": "desktop",
    "version": "1.5.0",
    "fileRecordId": "f_desktop_150",
    "ipAddress": "120.24.0.1",
    "referrer": "https://pisamusic.partialy.cn/download",
    "userAgent": "Mozilla/5.0...",
    "occurredAt": 1700000000000
  },
  "success": true
}
```
