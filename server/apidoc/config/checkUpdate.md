# 检查 Android 更新 (兼容旧版)

获取 Android 端最新的版本更新配置。此接口为 Android 客户端旧版更新检查接口（保持旧结构兼容）。

- **请求方法**：`GET`
- **请求路径**：`/api/config/check-update`
- **需要鉴权**：否
- **加密模式**：明文返回

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "latestVersion": "2.1.0",
    "updateTime": "2026-08-20",
    "forceUpdate": false,
    "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_abc123/download",
    "officialUrl": "https://pisamusic.partialy.cn",
    "updateContent": "1. 优化播放体验\n2. 修复已知问题",
    "platformLabel": "Android",
    "fileSizeText": "45.8 MB",
    "available": true
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `latestVersion` | `string` | 最新版本号 |
| `updateTime` | `string` | 更新发布日期 |
| `forceUpdate` | `boolean` | 是否强制更新 |
| `downloadUrl` | `string` | 绝对下载地址（若为相对路径服务端会自动转换为绝对 URL） |
| `officialUrl` | `string` | 官网首页链接 |
| `updateContent` | `string` | 更新日志正文 |
| `platformLabel` | `string` | 平台显示名称（如 `Android`） |
| `fileSizeText` | `string` | 安装包文件大小文本 |
| `available` | `boolean` | 下载通道是否开放 |
