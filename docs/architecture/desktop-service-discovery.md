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

API 与 realtime 地址必须是真正的 origin：正式环境只允许 HTTPS，并且不允许认证信息、路径、query 或 hash。`PISA_SERVER_URL` / `PM_SERVER_URL` 使用同一规则，仅开发环境的 localhost 可使用 HTTP。更新 feed 仍允许路径，但只允许不含认证信息、query、hash 的 HTTPS URL。发现文档中的接口路径必须保持为相对路径，避免将调用方重新绑定到某个业务域名。

`desktop.minimumSupportedVersion` 是已校验并透传到快照的元数据；本轮不根据它强制升级、拦截启动或限制功能。若未来要启用强制升级，必须另行定义版本比较、离线行为和更新失败恢复策略。

## 客户端解析、缓存与本地模式

解析优先级为 `environment/development → remote → cache → embedded`：

- `PISA_SERVER_URL` 或 `PM_SERVER_URL` 环境变量优先；未打包开发环境默认本地服务。
- 正式运行优先拉取远程发现文件。
- 远程失败或远程文档版本低于缓存时，使用缓存。
- 没有可用远程或缓存时，使用内置文档。

缓存保存在 main-only SQLite `service_discovery_cache` 独立表，只能通过 `AppDatabase` 专用 API 访问，不经过 renderer 可读写的通用 settings IPC。升级时清除旧 `desktop-service-discovery-cache-v1` settings 记录。数据库写入使用 `configVersion` 条件更新，缓存和当前内存快照均防止较低版本覆盖。

初始化请求合并；刷新请求在已有解析进行时只排队一轮，并发刷新合并到同一轮，避免慢请求晚到覆盖新快照。发现成功不等于业务服务可用：仅在后续 bootstrap、设备上报或业务探测失败时进入本地模式。

本地模式仍允许自动更新。updater 对 bootstrap 与服务发现快照中的候选 feed 逐个校验和去重，非法 bootstrap feed 会被跳过并继续尝试有效 discovery fallback；全部非法或不可达才由上层报告失败。服务端后台保存 feed 时执行相同的 HTTPS、无认证信息/query/hash 校验。

## 发布验证与安全模型

发布发现文档后至少验证：

- JSON 请求返回 HTTP 200，且 `Content-Type` 为 `application/json`。
- 每个计划启用的 origin 的 API health 返回 HTTP 200。
- Windows 自动更新 `latest.yml` 可达。

v1 没有签名：客户端仅依赖 HTTPS 传输、严格 URL/JSON 校验、origin 健康探测和单调版本缓存来降低错误配置与降级风险。它不能抵御拥有发现文件发布权限或 HTTPS 终端控制权的攻击者；发现文件的发布权限、CDN 配置与证书安全必须由运维侧保护。引入签名或密钥轮换前，不得把 v1 视为具备配置来源真实性证明。
