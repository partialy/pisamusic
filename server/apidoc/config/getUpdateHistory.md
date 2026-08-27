# 获取版本更新历史列表

获取历次发布的历史版本记录及对应的安装包下载信息。

- **请求方法**：`GET`
- **请求路径**：`/api/config/update-history`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

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
      "platform": "android",
      "version": "2.1.0",
      "updateTime": "2026-08-20",
      "forceUpdate": false,
      "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_1/download",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "1. 优化界面交互\n2. 修复已知问题",
      "platformLabel": "Android",
      "fileSizeText": "45.8 MB",
      "createdAt": 1700000000000,
      "releaseFile": {
        "id": "f_1",
        "fileName": "PisaMusic-v2.1.0.apk",
        "fileSize": 48025600,
        "mimeType": "application/vnd.android.package-archive",
        "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_1/download",
        "status": "uploaded"
      }
    }
  ],
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 历史记录 ID |
| `platform` | `string` | 平台：`android` 或 `desktop` |
| `version` | `string` | 版本号 |
| `updateTime` | `string` | 发布时间 |
| `forceUpdate` | `boolean` | 是否为强制更新版本 |
| `downloadUrl` | `string` | 下载地址 |
| `updateContent` | `string` | 更新说明 |
| `platformLabel` | `string` | 平台标签 |
| `fileSizeText` | `string` | 文件大小文本 |
| `releaseFile` | `object \| null` | 关联的统一文件对象 |
