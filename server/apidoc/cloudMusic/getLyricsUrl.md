# 获取网盘音乐歌词地址

获取网盘曲目的歌词文件临时签名下载 URL（有效期 1 小时）。仅允许 `active` 状态且已上传歌词的曲目取链；无歌词返回 404，`disabled` 状态返回 403。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/tracks/:uuid/lyrics-url`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

### 请求示例

```http
GET /api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101/lyrics-url
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
    "source": "cloud",
    "url": "https://pm.hs.partialy.cn/pisamusic/cloud-music/202608/8c919a71.../lyrics.lrc?e=1700003600&token=...",
    "expiresAt": 1700003600000,
    "format": "lrc"
  },
  "success": true
}
```

### 错误响应

- **403 Forbidden**：`{"code": "CLOUD_MUSIC_DISABLED", "msg": "曲目已禁用"}`
- **404 Not Found**：`{"code": "CLOUD_MUSIC_NO_LYRICS", "msg": "该曲目暂无歌词"}`

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `format` | `"lrc" \| "txt"` | 歌词格式；在原有响应字段上新增，旧客户端可忽略。 |
