# 读取后台发布更新历史

管理后台查询所有的发布历史版本列表，包含关联的七牛安装包文件记录与引用状态。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/update-history`
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
      "id": "hist_1",
      "platform": "desktop",
      "version": "1.5.0",
      "updateTime": "2026-08-22",
      "forceUpdate": false,
      "downloadUrl": "/api/config/release-files/f_2/download",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "更新说明",
      "platformLabel": "PC 桌面版",
      "fileSizeText": "89.2 MB",
      "createdAt": 1700000000000,
      "releaseFileId": "f_2",
      "releaseFile": {
        "id": "f_2",
        "fileName": "PisaMusic-Setup-1.5.0.exe",
        "fileSize": 93532160,
        "mimeType": "application/x-msdownload",
        "status": "uploaded"
      }
    }
  ],
  "success": true
}
```
