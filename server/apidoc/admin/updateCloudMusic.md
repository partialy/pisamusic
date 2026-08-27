# 编辑并保存网盘音乐 (管理后台)

管理员编辑草稿中的四个字段（歌名、歌手、专辑、时长），并保存为正式业务状态（`active`、`disabled` 或 `offline`）。首次保存将曲目由 `temp` 转为正式状态。

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/cloud-music/:uuid`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `title` | `string` | 是 | 歌名，1-200 字符 |
| `artist` | `string` | 是 | 歌手，1-300 字符 |
| `album` | `string` | 否 | 专辑名称，最多 200 字符 |
| `durationMs` | `number` | 是 | 时长（毫秒），0 至 86400000 |
| `status` | `string` | 是 | 目标状态：`active`、`disabled` 或 `offline` |
| `statusReason` | `string` | 否 | 状态原因说明 |

---

## 响应数据

### 成功响应

返回更新后的完整 `CloudMusicTrack` 对象。
