# 获取后台公告列表

管理后台获取当前配置的所有系统公告列表。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/announcements`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": "anno_1",
      "content": "PisaMusic v2.1.0 已发布",
      "time": "2026-08-25",
      "publisher": "PisaMusic 团队",
      "confirmText": "我知道了",
      "showEveryTime": false,
      "showGotoButton": true,
      "gotoUrl": "https://pisamusic.partialy.cn"
    }
  ],
  "success": true
}
```
