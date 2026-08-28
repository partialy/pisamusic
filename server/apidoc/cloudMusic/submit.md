# 用户投稿网盘音乐接口 (`/api/cloud-music/submit/*`)

本文档定义客户端用户向独立网盘曲库（`source: "cloud"`）提交歌曲投稿的全套接口。所有投稿接口均要求账号登录鉴权（User Token）并经过 AES-GCM 端到端加密通信。

---

## 1. 创建投稿上传会话

向服务端预登记本次投稿的音频文件及可选的封面、歌词文件，获取七牛私有直传凭证（Upload Token 和 Upload URL）。

- **Method**: `POST`
- **Path**: `/api/cloud-music/submit/upload-sessions`
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

### 请求体 (JSON)

```json
{
  "audio": {
    "fileName": "song.mp3",
    "fileSize": 10485760,
    "mimeType": "audio/mpeg"
  },
  "cover": {
    "fileName": "cover.jpg",
    "fileSize": 204800,
    "mimeType": "image/jpeg"
  },
  "lyrics": {
    "fileName": "lyrics.lrc",
    "fileSize": 4096,
    "mimeType": "text/plain"
  }
}
```

### 响应体 (JSON)

```json
{
  "code": 0,
  "msg": "ok",
  "success": true,
  "data": {
    "track": {
      "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "source": "cloud",
      "status": "temp",
      "uploadState": "reserved",
      "title": "song.mp3",
      "artist": "未知歌手",
      "album": "",
      "durationMs": 0,
      "playable": false
    },
    "tickets": [
      {
        "assetId": "...",
        "fileRecordId": "...",
        "kind": "audio",
        "key": "pisamusic/cloud-music/3fa85f64-5717-4562-b3fc-2c963f66afa6/audio/2026-08/song.mp3",
        "uploadToken": "<QiniuUploadToken>",
        "uploadUrl": "https://upload-z2.qiniup.com"
      }
    ]
  }
}
```

---

## 2. 预登记补充资产 (封面/歌词)

若在上传过程中用户想要更换封面或补充歌词文件，可调用此接口重新获取指定资产的七牛直传凭证。

- **Method**: `POST`
- **Path**: `/api/cloud-music/submit/:uuid/assets/:kind/reserve`
- **Path 参数**:
  - `uuid`: 曲目 UUID
  - `kind`: `cover-uploaded` | `lyrics`
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

### 请求体 (JSON)

```json
{
  "fileName": "new_cover.png",
  "fileSize": 307200,
  "mimeType": "image/png"
}
```

---

## 3. 确认资产上传完成并提取元数据

客户端将文件直传至七牛云成功后调用此接口通知服务端。当 `kind === 'audio'` 时，服务端将自动提取音频 ID3 元数据（歌名、歌手、专辑、时长、内置封面），并返回解析后的最新 Track DTO。

- **Method**: `POST`
- **Path**: `/api/cloud-music/submit/:uuid/assets/:kind/complete`
- **Path 参数**:
  - `uuid`: 曲目 UUID
  - `kind`: `audio` | `cover-uploaded` | `lyrics`
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

---

## 4. 移除手动上传的封面

- **Method**: `DELETE`
- **Path**: `/api/cloud-music/submit/:uuid/cover`
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

---

## 5. 保存并正式提交投稿

用户在前端完善或修改歌名、歌手、专辑和时长后，调用此接口将曲目状态流转为 **`pending_review`（待审核）**。

- **Method**: `POST`
- **Path**: `/api/cloud-music/submit/:uuid/save`
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

### 请求体 (JSON)

```json
{
  "title": "夜曲",
  "artist": "周杰伦",
  "album": "十一月的萧邦",
  "durationMs": 226000
}
```

### 响应体 (JSON)

```json
{
  "code": 0,
  "msg": "ok",
  "success": true,
  "data": {
    "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "pending_review",
    "statusReason": "用户 admin 投稿，等待审核",
    "title": "夜曲",
    "artist": "周杰伦",
    "album": "十一月的萧邦",
    "durationMs": 226000,
    "playable": false
  }
}
```

---

## 6. 查询当前用户投稿历史列表

查询当前登录用户上传的所有曲目记录，包括待审核、已通过、已禁用、已驳回和已销毁留底记录。

- **Method**: `GET`
- **Path**: `/api/cloud-music/submit/my-history?offset=0&limit=30`
- **Query 参数**:
  - `offset`: 分页起始偏移量，默认 0
  - `limit`: 分页数量，默认 30
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

### 响应体 (JSON)

```json
{
  "code": 0,
  "msg": "ok",
  "success": true,
  "data": {
    "items": [
      {
        "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "source": "cloud",
        "status": "rejected",
        "statusReason": "歌名有误，请核对后重新提交",
        "title": "夜曲",
        "artist": "周杰伦",
        "album": "十一月的萧邦",
        "durationMs": 226000,
        "playable": false,
        "cover": {
          "source": "embedded",
          "url": "/api/cloud-music/tracks/3fa85f64-5717-4562-b3fc-2c963f66afa6/cover"
        },
        "lyrics": null,
        "createdAt": 1787930000000,
        "updatedAt": 1787931000000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 30
  }
}
```

---

## 7. 驳回投稿修改元数据后重新提审

对审核未通过（`rejected`）或待审核的曲目修改歌名、歌手、专辑、时长等信息后重新发起提审，将状态变更为 `pending_review`。若投稿已被销毁（`deleted`），则禁止重新提审。

- **Method**: `POST`
- **Path**: `/api/cloud-music/submit/:uuid/resubmit`
- **Path 参数**:
  - `uuid`: 曲目 UUID
- **鉴权**: `Authorization: Bearer <userToken>` (加密)

### 请求体 (JSON)

```json
{
  "title": "夜曲 (修正版)",
  "artist": "周杰伦",
  "album": "十一月的萧邦",
  "durationMs": 226000
}
```

