# 获取临时文件统计摘要 (管理后台)

统计全部、24 小时前、72 小时前的临时未保存曲目数量及占用存储大小，以及孤立/过期资产统计。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/cloud-music/temp-summary`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": {
      "count": 5,
      "bytes": 150000000
    },
    "olderThan24h": {
      "count": 3,
      "bytes": 90000000
    },
    "olderThan72h": {
      "count": 1,
      "bytes": 30000000
    },
    "staleAssets": {
      "count": 0,
      "bytes": 0
    }
  },
  "success": true
}
```
