# 删除网盘音乐曲目 (管理后台)

删除指定网盘曲目。服务端将先级联删除该曲目在七牛云上的全部音频、封面与歌词对象，再将曲目及所有关联 `file_records` 与 `cloud_music_assets` 逻辑删除（写入 `deleted_at` 并标记 `status='deleted'`）。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/cloud-music/:uuid`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

---

## 响应数据

### 成功响应

返回已被标记为删除状态的完整 `CloudMusicTrack` 对象。
