# 确认网盘音乐资产上传完成 (管理后台)

管理后台在浏览器本地完成音频标签、内嵌封面与内嵌歌词解析，并将文件直传至七牛云后通知服务端。服务端仅通过七牛 `stat` 校验物理对象（Hash、大小、MIME），不再将音频/封面/歌词下载至服务端临时目录；当 `kind === 'audio'` 时支持接收前端解析的元数据与音频技术规格，并将 `uploadState` 置为 `ready`。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/cloud-music/:uuid/assets/:kind/complete`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |
| `kind` | `string` | 是 | 资产类型：`audio`、`cover-uploaded` 或 `lyrics` |

### Request Body (JSON, 仅 `kind=audio` 可选)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | `string` | 否 | 浏览器解析或编辑的歌名 |
| `artist` | `string` | 否 | 浏览器解析或编辑的歌手 |
| `album` | `string` | 否 | 专辑名称 |
| `durationMs` | `number` | 否 | 音频时长（毫秒） |
| `format` | `string` | 否 | 容器/扩展格式（如 `flac`、`mp3`） |
| `codec` | `string` | 否 | 编码格式 |
| `bitrate` | `number` | 否 | 比特率（bps） |
| `sampleRate` | `number` | 否 | 采样率（Hz） |
| `channels` | `number` | 否 | 声道数 |
| `year` | `number \| null` | 否 | 发行年份 |
| `trackNo` | `number \| null` | 否 | 曲目序号 |

---

## 响应数据

### 成功响应

返回更新后的完整 `CloudMusicTrack` 对象。


## 歌词内容与格式

浏览器提取时优先保留原始内嵌 LRC；只有 `syncText` 时按明确的毫秒时间戳生成 LRC。`common.lyrics.text` 可能是库已剥离时间轴的纯文本，不能优先于同步数据。无时间轴内容保存为 `.txt`，不生成虚假时间戳；上传文件为 UTF-8 `text/plain;charset=utf-8`，服务端 MIME 规范化为 `text/plain`。歌词确认继续仅 stat，`lyricsFormat` 从上传文件扩展名落库；公开 `lyrics-url` 返回当前已确认歌词对象的私有签名，不转换内容。历史上传已丢失的时间轴需用原始音频/歌词重新上传恢复。
