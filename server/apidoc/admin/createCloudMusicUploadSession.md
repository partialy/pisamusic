# 创建网盘音乐上传会话 (管理后台)

管理员发起网盘音乐上传。服务端在单个事务中预登记 `status='temp'` 曲目及音频（与可选的封面、歌词）`pending` 资产和文件记录，生成固定 Key 的七牛上传凭证返回给客户端，杜绝幽灵文件产生。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/cloud-music/upload-sessions`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `audio` | `object` | 是 | 必选音频文件声明 `{ fileName, fileSize, mimeType }`，支持 .mp3, .flac, .m4a, .aac, .ogg, .opus, .wav，<= 500MB |
| `cover` | `object` | 否 | 可选封面图片声明 `{ fileName, fileSize, mimeType }`，支持 .jpg, .jpeg, .png, .webp，<= 10MB |
| `lyrics` | `object` | 否 | 可选歌词文件声明 `{ fileName, fileSize, mimeType }`，支持 .lrc, .txt，<= 2MB |

### 请求示例

```json
{
  "audio": {
    "fileName": "晴天.flac",
    "fileSize": 29884416,
    "mimeType": "audio/flac"
  },
  "cover": {
    "fileName": "cover.jpg",
    "fileSize": 204800,
    "mimeType": "image/jpeg"
  },
  "lyrics": {
    "fileName": "晴天.lrc",
    "fileSize": 4096,
    "mimeType": "text/plain"
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
    "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
    "track": {
      "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
      "status": "temp",
      "uploadState": "reserved",
      "title": "晴天.flac",
      "artist": "未知歌手"
    },
    "tickets": [
      {
        "assetId": "asset_audio_123",
        "fileRecordId": "file_audio_123",
        "kind": "audio",
        "key": "pisamusic/cloud-music/202608/8c919a71.../audio.flac",
        "uploadToken": "qiniu_token...",
        "uploadUrl": "https://upload.qiniup.com"
      }
    ]
  },
  "success": true
}
```
