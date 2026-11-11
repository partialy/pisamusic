# 首次安装接口

安装接口强制明文JSON，由HTTPS承担传输保护，使用标准 `{success,code,msg,data}` 包装。不得输出安装令牌、数据库密码或密码哈希。Admin静态页面可在安装前加载。

## GET /api/setup/status

无需登录，返回：

```json
{"success":true,"code":0,"msg":"ok","data":{"initialized":false,"installationId":"uuid","databaseType":"MYSQL","transferStatus":"ready","requiresSetupToken":true}}
```

- `initialized` 只有完成安装且复制完整时为true。
- `transferStatus=incomplete` 表示失败或中断目标，必须恢复/重做复制，不能开放初始化表单。
- 请求/数据库读取失败返回错误，不能按未初始化处理。
- 维护期间允许读取安装状态。

## POST /api/setup/complete

```json
{"setupToken":"部署配置或启动日志中的令牌","username":"admin","password":"自选至少8字符密码","confirmPassword":"相同密码"}
```

- 用户名3–64位英文字母、数字、`_ . -`；密码至少8字符，UTF-8不超过72字节。
- 令牌使用 `SETUP_TOKEN`；未配置时生成进程临时令牌，仅打印到服务端日志。
- 事务写入首管、缺失默认运行配置、听歌等级和安装完成标记；重复或并发安装不能覆盖管理员。
- 成功返回更新后的status，无JWT；Admin转到登录页。
- 400参数错误；403安装令牌错误或已失效；409已安装/管理员已存在/目标复制不完整；503安装已提交但运行配置加载失败，需重启服务。
- 安装API具备IP限流；业务API与实时连接在安装前不可用。

安装提交遇到网络错误时，Admin重新查询status；若已经安装，不再重复创建管理员。

## 旧库与登录兼容

已有管理员的旧库升级后补安装标记，保留账号和业务数据。无管理员但有数据时只补全安装，不清库。

管理员及用户JWT包含 `installationId`，服务端核对当前库身份；旧不带字段的JWT失效，客户端重新登录即可，不改变用户DTO或同步游标格式。完整迁移保留安装身份，独立安装生成不同身份。
