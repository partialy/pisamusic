# 七牛 CDN 证书自动续签部署计划

## 目标

在目标 Linux 服务器的 `/www/wwwroot/cert` 部署一个基于 Cloudflare DNS-01 的 ACME 续签脚本，为以下两个七牛 CDN 域名申请同一张 SAN 证书，并在续签成功后自动上传到七牛并绑定到对应域名：

- `qiniu-private-oss.partialy.cn` → `qiniu-private-oss`
- `qiniu-public-oss.partialy.cn` → `qiniu-public-oss`

## 约束与安全边界

- 不读取或输出 SSH 私钥、Qiniu Secret Key、Cloudflare Token 的内容。
- 使用服务器现有的 Qiniu AK/SK；Cloudflare Token 从权限受限的本地配置文件读取。
- 首次部署只创建目录、脚本和配置模板；没有完整凭据时不启用定时任务。
- 续签时保留旧证书，不自动删除七牛证书记录；绑定失败时保留本地证书并记录错误。
- 使用独占锁、日志轮转和 TLS 健康检查，避免并发续签或错误证书覆盖。

## 实施步骤

1. 检查服务器系统、Node.js、acme.sh、cron/systemd 和目标目录现状。
2. 创建证书续签脚本与配置模板，执行语法检查和敏感信息审查。
3. 上传到 `/www/wwwroot/cert`，设置目录与配置文件权限。
4. 安装/复用 acme.sh，写入 systemd timer 或 cron，但只有完整配置后才启用。
5. 运行一次 dry-run/检查流程，确认两个域名解析、证书 SAN、七牛 API 上传和域名绑定结果。
6. 用 HTTPS 握手和证书指纹验证两个 CDN 域名，记录回滚与手工触发命令。
