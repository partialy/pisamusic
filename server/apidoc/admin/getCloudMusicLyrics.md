# 获取网盘音乐歌词原文

- 方法与路径：`GET /api/admin/cloud-music/:uuid/lyrics`
- 鉴权：管理员 JWT，沿用管理端加密请求与响应。
- `uuid`：曲目 UUID；无请求体或 URL 参数。

成功返回标准 `{ success, data }`，其中 `data` 为：

```json
{ "text": "[00:00.500]歌词\n", "format": "lrc", "fileName": "歌曲.lrc" }
```

`text` 是解码后的歌词文本，保留空白和时间标签。支持 UTF-8、带 BOM 的 UTF-16、GB18030 与二进制 KRC。`format` 为 `lrc`、`txt`、`krc` 或 `yrc`。是否带时间轴以文本内容为准。

管理员可查看 disabled、pending 等非删除曲目；仅读取 `isCurrent=true`、`state=uploaded` 且未删除的歌词资产及有效文件记录。曲目或歌词不存在返回 404；下载、格式、大小校验失败返回 502。响应设置 `Cache-Control: no-store`。

服务端仅使用已登记资产生成私有七牛签名，按配置 HTTPS 域名白名单读取；不接受用户提供的 URL，不跟随重定向。读取超时 15 秒，限制 2MB，并校验实际字节数与登记大小一致。不写临时文件、数据库或七牛对象；此接口供只读查看与复制，公开播放仍使用 `lyrics-url`。
