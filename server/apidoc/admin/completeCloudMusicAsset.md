# 确认网盘音乐资产上传完成 (管理后台)

浏览器完成七牛云对象直传后通知服务端。服务端通过七牛 `stat` 校验物理事实（Hash、大小、MIME），若是音频则下载至安全临时目录解析元数据与提取内嵌封面，并更新资产状态为 `uploaded`。

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

---

## 响应数据

### 成功响应

返回更新后的完整 `CloudMusicTrack` 对象，若为音频完成则 `uploadState` 转为 `ready`，且解析得到的歌名、歌手、专辑、时长、规格等已自动填充至草稿中。
