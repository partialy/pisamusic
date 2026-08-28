# 获取加密白名单配置

读取服务端当前生效的端到端加密明文白名单路径列表。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/encryption-config`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "plaintextPaths": [
      "/api/health",
      "/api/config/bootstrap",
      "/api/config/releases",
      "/api/config/release-files/*",
      "/api/config/desktop-updates/*",
      "/api/config/download/*",
      "/api/config/discover",
      "/api/analytics/site-visit",
      "/api/cloud-music/tracks/*/cover",
      "/api/listen-together/config",
      "/api/shares/public/*",
      "/discover/*",
      "/static/*",
      "/uploads/*"
    ]
  },
  "success": true
}
```

`/api/cloud-music/tracks/*/cover` 是服务端强制保留的精确封面明文路径：其中 `*` 仅匹配一个 URL 路径片段，不能由后台配置为其他中间通配规则。该项会随读取结果返回，以便后台原样提交保存。
