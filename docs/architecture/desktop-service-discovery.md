# 桌面端服务发现与降级规则

## 目标与边界

桌面端正式包不在业务调用方硬编码外层服务、Socket、头像或更新域名。main 进程先解析第 0 层发现文件，生成 `serviceDiscovery` 快照；`systemClient`、一起听 Socket、账号相对头像和 updater 只能消费该快照。renderer 不可取得服务端 base URL，也没有 `system:get-base-url` IPC。

远程地址固定为：`https://pisamusic.partialy.cn/pm-config/config-v1.json`。

## 发现文档维护

发现文档为 v1 JSON。发布或修复时按以下顺序操作：

1. 先修改地址或其他内容。
2. 再递增正整数 `configVersion`。
3. 最后更新可解析的 `publishedAt`。

`configVersion` 必须单调递增。回滚内容时也要继续递增版本号，不能恢复旧数字。`serviceOrigins` 按 `priority` 升序选择，数值越小优先级越高；健康探测会依序选择可用 origin。

正式 URL 必须是 HTTPS，且不允许认证信息、query 或 hash。发现文档中的相对路径必须保持为相对路径，避免将调用方重新绑定到某个业务域名。

`desktop.minimumSupportedVersion` 是已校验并透传到快照的元数据；本轮不根据它强制升级、拦截启动或限制功能。若未来要启用强制升级，必须另行定义版本比较、离线行为和更新失败恢复策略。

## 客户端解析、缓存与本地模式

解析优先级为 `environment/development → remote → cache → embedded`：

- `PISA_SERVER_URL` 或 `PM_SERVER_URL` 环境变量优先；未打包开发环境默认本地服务。
- 正式运行优先拉取远程发现文件。
- 远程失败或远程文档版本低于缓存时，使用缓存。
- 没有可用远程或缓存时，使用内置文档。

缓存保存在 SQLite settings，key 为 `desktop-service-discovery-cache-v1`。缓存和当前内存快照均防止较低 `configVersion` 覆盖。发现成功不等于业务服务可用：仅在后续 bootstrap、设备上报或业务探测失败时进入本地模式。

本地模式仍允许自动更新。updater 继续从服务发现快照（并与 bootstrap 更新配置组合）的候选 feed 检查更新，避免 API 故障时客户端失去恢复通道。

## 发布验证与安全模型

发布发现文档后至少验证：

- JSON 请求返回 HTTP 200，且 `Content-Type` 为 `application/json`。
- 每个计划启用的 origin 的 API health 返回 HTTP 200。
- Windows 自动更新 `latest.yml` 可达。

v1 没有签名：客户端仅依赖 HTTPS 传输、严格 URL/JSON 校验、origin 健康探测和单调版本缓存来降低错误配置与降级风险。它不能抵御拥有发现文件发布权限或 HTTPS 终端控制权的攻击者；发现文件的发布权限、CDN 配置与证书安全必须由运维侧保护。引入签名或密钥轮换前，不得把 v1 视为具备配置来源真实性证明。
