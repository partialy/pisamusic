# PisaMusic 服务端 API 接口文档索引

欢迎使用 PisaMusic 服务端接口文档。本文档对服务端所有 REST 接口与实时通信协议进行了全量提取与分类索引。

> [!NOTE]
> 通信协议、响应结构、端到端 AES-GCM 加密机制与 Token 鉴权规则详见：[【全局通信与协议规范】](./common/overview.md)。

---

## 模块快速导航

- [1. 用户与认证模块 (`user`)](#1-用户与认证模块-apiuser)
- [2. 客户端配置与发布模块 (`config`)](#2-客户端配置与发布模块-apiconfig)
- [3. 设备管理与上报模块 (`device`)](#3-设备管理与上报模块-apidevice)
- [专属消息模块 (`messages`)](#专属消息模块-apimessages)
- [4. 用户数据云同步模块 (`sync`)](#4-用户数据云同步模块-apisync)
- [5. 外链与扫码分享模块 (`shares`)](#5-外链与扫码分享模块-apishares)
- [6. 一起听实时通信模块 (`listenTogether`)](#6-一起听实时通信模块-apilisten-together)
- [7. 用户反馈模块 (`feedback`)](#7-用户反馈模块-apifeedback)
- [8. 故障排障日志上报模块 (`faultReports`)](#8-故障排障日志上报模块-apifault-reports)
- [9. 官网数据统计模块 (`analytics`)](#9-官网数据统计模块-apianalytics)
- [10. 独立网盘音乐源模块 (`cloudMusic`)](#10-独立网盘音乐源模块-apicloud-music)
- [11. 听歌时长与等级模块 (`listening`)](#11-听歌时长与等级模块-apilistening)
- [12. 系统基础与健康检查 (`system`)](#12-系统基础与健康检查-system)
- [13. 管理后台 API (`admin`)](#13-管理后台-api-apiadmin)

---

## 1. 用户与认证模块 (`/api/auth`)

提供用户邮箱验证码发送、注册、密码登录、验证码登录、修改密码、重置密码、令牌刷新、个人资料管理及头像上传等服务。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 发送邮箱验证码 | `POST` | `/api/auth/email-code` | 无 | [./user/sendEmailCode.md](./user/sendEmailCode.md) |
| 发送手机号验证码 | `POST` | `/api/auth/phone-code` | 无 | [./user/sendPhoneCode.md](./user/sendPhoneCode.md) |
| 邮箱验证码注册 | `POST` | `/api/auth/register` | 无 | [./user/register.md](./user/register.md) |
| 用户名/邮箱密码登录 | `POST` | `/api/auth/login/password` | 无 | [./user/loginByPassword.md](./user/loginByPassword.md) |
| 邮箱/手机号验证码快捷登录 | `POST` | `/api/auth/login/code` | 无 | [./user/loginByCode.md](./user/loginByCode.md) |
| 登录态修改密码 | `POST` | `/api/auth/password/change` | User Token | [./user/changePassword.md](./user/changePassword.md) |
| 邮箱验证码重置密码 | `POST` | `/api/auth/password/reset` | 无 | [./user/resetPassword.md](./user/resetPassword.md) |
| 刷新登录令牌 | `POST` | `/api/auth/refresh` | User Token | [./user/refreshToken.md](./user/refreshToken.md) |
| 获取当前登录用户信息 | `GET` | `/api/auth/me` | User Token | [./user/getMe.md](./user/getMe.md) |
| 获取头像上传凭证 | `POST` | `/api/auth/avatar/upload-token` | User Token | [./user/getAvatarUploadToken.md](./user/getAvatarUploadToken.md) |
| 发送换绑新邮箱验证码 | `POST` | `/api/auth/profile/email-code` | User Token | [./user/sendProfileEmailCode.md](./user/sendProfileEmailCode.md) |
| 发送换绑新手机号验证码 | `POST` | `/api/auth/profile/phone-code` | User Token | [./user/sendProfilePhoneCode.md](./user/sendProfilePhoneCode.md) |
| 更新用户资料 | `PATCH` | `/api/auth/profile` | User Token | [./user/updateProfile.md](./user/updateProfile.md) |

---

## 2. 客户端配置与发布模块 (`/api/config`)

提供客户端启动网关端点拉取、双端版本更新检查、PC 自动更新 feed、安装包临时签名下载、动态配置、协议与关于软件等数据。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 获取启动配置与服务网关 | `GET` | `/api/config/bootstrap` | 无 (明文) | [./config/getBootstrap.md](./config/getBootstrap.md) |
| 检查 Android 更新 (兼容旧版) | `GET` | `/api/config/check-update` | 无 (明文) | [./config/checkUpdate.md](./config/checkUpdate.md) |
| 获取双端最新发布信息 | `GET` | `/api/config/releases` | 无 (明文) | [./config/getReleases.md](./config/getReleases.md) |
| 获取 PC 自动更新配置文件 | `GET` | `/api/config/desktop-updates/:platform/:arch/latest.yml` | 无 (明文重定向) | [./config/getDesktopUpdateLatestYml.md](./config/getDesktopUpdateLatestYml.md) |
| 下载 PC 自动更新资源文件 | `GET` | `/api/config/desktop-updates/:platform/:arch/:fileName` | 无 (明文重定向) | [./config/getDesktopUpdateAsset.md](./config/getDesktopUpdateAsset.md) |
| 安装包签名下载入口 | `GET` | `/api/config/release-files/:id/download` | 无 (明文重定向) | [./config/downloadReleaseFile.md](./config/downloadReleaseFile.md) |
| 官网安装包下载重定向与统计 | `GET` | `/api/config/download/:platform` | 无 (明文重定向) | [./config/downloadPlatformRelease.md](./config/downloadPlatformRelease.md) |
| 获取发现页配置 | `GET` | `/api/config/discover` | 无 (明文) | [./config/getDiscover.md](./config/getDiscover.md) |
| 获取单条动态配置 | `GET` | `/api/config/get` | 无 (明文) | [./config/getDynamicConfig.md](./config/getDynamicConfig.md) |
| 获取用户服务协议 | `GET` | `/api/config/agreement` | 无 (明文) | [./config/getAgreement.md](./config/getAgreement.md) |
| 获取隐私政策 | `GET` | `/api/config/privacy-policy` | 无 (明文) | [./config/getPrivacyPolicy.md](./config/getPrivacyPolicy.md) |
| 获取系统公告列表 | `GET` | `/api/config/announcements` | 无 (明文) | [./config/getAnnouncements.md](./config/getAnnouncements.md) |
| 获取版本更新历史列表 | `GET` | `/api/config/update-history` | 无 (明文) | [./config/getUpdateHistory.md](./config/getUpdateHistory.md) |
| 获取关于软件信息 | `GET` | `/api/config/about` | 无 (明文) | [./config/getAbout.md](./config/getAbout.md) |

---

## 3. 设备管理与上报模块 (`/api/device`)

记录 Android 与 PC 桌面设备硬件、系统版本及日活统计，并提供设备封禁状态校验。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| Android 设备信息上报与日活记录 | `POST` | `/api/device/report` | 无 (加密) | [./device/reportAndroidDevice.md](./device/reportAndroidDevice.md) |
| 查询 Android 设备状态 | `GET` | `/api/device/:id` | 无 (加密) | [./device/getAndroidDeviceStatus.md](./device/getAndroidDeviceStatus.md) |
| PC 桌面设备信息上报与日活记录 | `POST` | `/api/device/desktop/report` | 无 (加密) | [./device/reportDesktopDevice.md](./device/reportDesktopDevice.md) |
| 查询 PC 桌面端设备状态 | `GET` | `/api/device/desktop/:id` | 无 (加密) | [./device/getDesktopDeviceStatus.md](./device/getDesktopDeviceStatus.md) |

---

## 专属消息模块 (`/api/messages`)

向已登录账号或单一 Android / PC 设备发送的专属消息。客户端读取账号和当前设备的未读并集，点击“我知道了”后异步确认已读。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 获取当前身份未读专属消息 | `GET` | `/api/messages/unread` | User Token 或设备消息凭证 | [./messages/listUnread.md](./messages/listUnread.md) |
| 确认指定专属消息已读 | `POST` | `/api/messages/:id/read` | User Token 或设备消息凭证 | [./messages/markRead.md](./messages/markRead.md) |

---

## 4. 用户数据云同步模块 (`/api/sync`)

基于操作日志（ChangeLog）与游标版本机制，提供用户收藏歌曲、收藏歌单、自建歌单及歌单歌曲的多端双向增量同步。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 拉取增量同步变更 | `GET` | `/api/sync/changes` | User Token + Device ID | [./sync/getSyncChanges.md](./sync/getSyncChanges.md) |
| 推送增量同步变更 | `POST` | `/api/sync/changes` | User Token + Device ID | [./sync/pushSyncChanges.md](./sync/pushSyncChanges.md) |

---

## 5. 外链与扫码分享模块 (`/api/shares`)

支持移动端和桌面端将单曲或歌单生成扫码外链及 App 唤起 Scheme。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 创建歌曲/歌单分享 | `POST` | `/api/shares` | User Token | [./shares/createShare.md](./shares/createShare.md) |
| 公开读取分享内容 (递增访问次数) | `GET` | `/api/shares/public/:uuid` | 无 (明文) | [./shares/getPublicShare.md](./shares/getPublicShare.md) |

---

## 6. 一起听实时通信模块 (`/api/listen-together`)

提供一起听房间的创建、查询与配置获取，以及基于 Socket.IO 的多成员低延迟实时协同播放与信令广播。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 获取一起听配置 | `GET` | `/api/listen-together/config` | 无 (明文) | [./listenTogether/getListenTogetherConfig.md](./listenTogether/getListenTogetherConfig.md) |
| 创建一起听房间 | `POST` | `/api/listen-together/rooms` | User Token | [./listenTogether/createRoom.md](./listenTogether/createRoom.md) |
| 查询房间详情 | `GET` | `/api/listen-together/rooms/:roomId` | User Token | [./listenTogether/getRoom.md](./listenTogether/getRoom.md) |
| 一起听 Socket.IO 实时通信协议 | `WS` | `/socket.io/` | User Token | [./listenTogether/realtimeEvents.md](./listenTogether/realtimeEvents.md) |

---

## 7. 用户反馈模块 (`/api/feedback`)

收集用户反馈问题、截图凭证及设备环境。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 提交用户反馈 (支持图片附件) | `POST` | `/api/feedback` | 无 (Form-Data) | [./feedback/submitFeedback.md](./feedback/submitFeedback.md) |

---

## 8. 故障排障日志上报模块 (`/api/fault-reports`)

收集客户端播放取链失败或主进程网络请求异常的详细堆栈与日志批次。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 批量上报播放/网络故障日志 | `POST` | `/api/fault-reports` | 可选 User Token | [./faultReports/reportFault.md](./faultReports/reportFault.md) |

---

## 9. 官网数据统计模块 (`/api/analytics`)

官网前端页面浏览统计与日 UV 精确去重上报。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 官网页面访问与日 UV 统计上报 | `POST` | `/api/analytics/site-visit` | 无 (明文) | [./analytics/reportSiteVisit.md](./analytics/reportSiteVisit.md) |

---

## 10. 独立网盘音乐源模块 (`/api/cloud-music`)

提供平台独立网盘曲库（`source: "cloud"`）的概览、曲目检索、详情查询、稳定封面重定向、1 小时播放签名 URL 与歌词签名下载 URL。网盘曲目独立于第三方音乐源，不参与其他平台聚合。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 获取网盘音乐概览 | `GET` | `/api/cloud-music/summary` | 可选 User Token (加密) | [./cloudMusic/getSummary.md](./cloudMusic/getSummary.md) |
| 搜索网盘音乐 | `GET` | `/api/cloud-music/search` | 无 (加密) | [./cloudMusic/searchTracks.md](./cloudMusic/searchTracks.md) |
| 获取网盘音乐详情 | `GET` | `/api/cloud-music/tracks/:uuid` | 无 (加密) | [./cloudMusic/getTrack.md](./cloudMusic/getTrack.md) |
| 获取网盘音乐稳定封面 | `GET` | `/api/cloud-music/tracks/:uuid/cover` | 无 (明文重定向) | [./cloudMusic/getCover.md](./cloudMusic/getCover.md) |
| 获取网盘音乐播放地址 | `GET` | `/api/cloud-music/tracks/:uuid/play-url` | 无 (加密) | [./cloudMusic/getPlayUrl.md](./cloudMusic/getPlayUrl.md) |
| 获取网盘音乐歌词地址 | `GET` | `/api/cloud-music/tracks/:uuid/lyrics-url` | 无 (加密) | [./cloudMusic/getLyricsUrl.md](./cloudMusic/getLyricsUrl.md) |
| 用户投稿网盘音乐 (会话/直传/元数据/审核) | `POST/DELETE` | `/api/cloud-music/submit/*` | User Token (加密) | [./cloudMusic/submit.md](./cloudMusic/submit.md) |

---

## 11. 听歌时长与等级模块 (`/api/listening`)

记录跨 Android 与未来 PC 的真实连续播放片段，按用户全设备、全歌曲时间并集计算权威累计时长，并按同曲跨设备并集提供单曲统计；等级由管理员维护的分钟闭区间实时推导。

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 批量上报听歌片段 | `POST` | `/api/listening/fragments/batch` | User Token + Device ID (加密) | [./user/listening.md](./user/listening.md) |
| 获取听歌汇总与当前等级 | `GET` | `/api/listening/summary` | User Token (加密) | [./user/listening.md](./user/listening.md) |
| 分页查询单曲听歌统计 | `GET` | `/api/listening/tracks` | User Token (加密) | [./user/listening.md](./user/listening.md) |

---

## 12. 系统基础与健康检查 (`system`)

| 接口名称 | Method | 请求路径 | 鉴权要求 | 接口文档链接 |
| :--- | :--- | :--- | :--- | :--- |
| 服务健康检查 | `GET` | `/api/health` | 无 (明文) | [./system/health.md](./system/health.md) |

---

## 13. 管理后台 API (`/api/admin`)

管理后台全套管理控制接口，除登录接口外统一要求 Header `Authorization: Bearer <AdminToken>`。

### 13.1 认证与系统设置
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 管理员登录 | `POST` | `/api/admin/login` | [./admin/login.md](./admin/login.md) |
| 管理员修改密码 | `POST` | `/api/admin/change-password` | [./admin/changePassword.md](./admin/changePassword.md) |
| 读取系统完整配置 | `GET` | `/api/admin/app-config` | [./admin/getAppConfig.md](./admin/getAppConfig.md) |
| 保存系统配置片段 | `POST` | `/api/admin/app-config-sections` | [./admin/saveAppConfigSections.md](./admin/saveAppConfigSections.md) |
| 获取加密白名单配置 | `GET` | `/api/admin/encryption-config` | [./admin/getEncryptionConfig.md](./admin/getEncryptionConfig.md) |
| 更新加密白名单配置 | `POST` | `/api/admin/encryption-config` | [./admin/saveEncryptionConfig.md](./admin/saveEncryptionConfig.md) |

### 13.2 公告管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 获取后台公告列表 | `GET` | `/api/admin/announcements` | [./admin/getAnnouncements.md](./admin/getAnnouncements.md) |
| 创建公告 | `POST` | `/api/admin/announcements` | [./admin/createAnnouncement.md](./admin/createAnnouncement.md) |
| 修改公告 | `PUT` | `/api/admin/announcements/:id` | [./admin/updateAnnouncement.md](./admin/updateAnnouncement.md) |
| 删除公告 | `DELETE` | `/api/admin/announcements/:id` | [./admin/deleteAnnouncement.md](./admin/deleteAnnouncement.md) |
| 获取公告图片上传凭证 | `POST` | `/api/admin/announcements/images/upload-token` | [./admin/announcementImageUploadToken.md](./admin/announcementImageUploadToken.md) |
| 登记公告图片 | `POST` | `/api/admin/announcements/images/complete` | [./admin/announcementImageComplete.md](./admin/announcementImageComplete.md) |

### 13.3 版本发布与文件管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 读取后台发布更新历史 | `GET` | `/api/admin/update-history` | [./admin/getUpdateHistory.md](./admin/getUpdateHistory.md) |
| 发布新版本 (Android/PC) | `POST` | `/api/admin/publish-update` | [./admin/publishUpdate.md](./admin/publishUpdate.md) |
| 修改已发布的历史版本 | `PUT` | `/api/admin/update-history/:id` | [./admin/updateHistoryItem.md](./admin/updateHistoryItem.md) |
| 预览历史版本删除影响 | `GET` | `/api/admin/update-history/:id/delete-preview` | [./admin/deleteHistoryPreview.md](./admin/deleteHistoryPreview.md) |
| 删除历史发布版本及关联文件 | `DELETE` | `/api/admin/update-history/:id` | [./admin/deleteHistory.md](./admin/deleteHistory.md) |
| 仅删除发布版本关联的安装包文件 | `DELETE` | `/api/admin/update-history/:id/release-file` | [./admin/deleteHistoryReleaseFile.md](./admin/deleteHistoryReleaseFile.md) |
| 分页查询统一文件登记记录 | `GET` | `/api/admin/files` | [./admin/listFiles.md](./admin/listFiles.md) |
| 删除统一文件记录及七牛对象 | `DELETE` | `/api/admin/files/:id` | [./admin/deleteFile.md](./admin/deleteFile.md) |
| 获取安装包直传七牛上传凭证 | `POST` | `/api/admin/release-files/upload-token` | [./admin/getReleaseFileUploadToken.md](./admin/getReleaseFileUploadToken.md) |
| 登记已上传七牛的安装包 | `POST` | `/api/admin/release-files/complete` | [./admin/completeReleaseFileUpload.md](./admin/completeReleaseFileUpload.md) |
| 获取 PC 自动更新文件上传凭证 | `POST` | `/api/admin/desktop-updates/upload-token` | [./admin/getDesktopUpdateUploadToken.md](./admin/getDesktopUpdateUploadToken.md) |
| 登记已上传七牛的 PC 自动更新文件 | `POST` | `/api/admin/desktop-updates/complete` | [./admin/completeDesktopUpdateUpload.md](./admin/completeDesktopUpdateUpload.md) |
| 启用 PC 自动更新版本 | `POST` | `/api/admin/desktop-updates/activate` | [./admin/activateDesktopUpdate.md](./admin/activateDesktopUpdate.md) |

### 13.4 设备管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询 Android 设备列表 | `GET` | `/api/admin/device/list` | [./admin/listAndroidDevices.md](./admin/listAndroidDevices.md) |
| 获取 Android 设备详情 | `GET` | `/api/admin/device/:id` | [./admin/getAndroidDeviceDetail.md](./admin/getAndroidDeviceDetail.md) |
| 锁定/解锁 Android 设备 | `POST` | `/api/admin/device/:id/lock` | [./admin/lockAndroidDevice.md](./admin/lockAndroidDevice.md) |
| 删除 Android 设备记录 | `DELETE` | `/api/admin/device/:id` | [./admin/deleteAndroidDevice.md](./admin/deleteAndroidDevice.md) |
| 分页查询 PC 桌面设备列表 | `GET` | `/api/admin/desktop-device/list` | [./admin/listDesktopDevices.md](./admin/listDesktopDevices.md) |
| 获取 PC 桌面设备详情 | `GET` | `/api/admin/desktop-device/:id` | [./admin/getDesktopDeviceDetail.md](./admin/getDesktopDeviceDetail.md) |
| 锁定/解锁 PC 桌面设备 | `POST` | `/api/admin/desktop-device/:id/lock` | [./admin/lockDesktopDevice.md](./admin/lockDesktopDevice.md) |
| 删除 PC 桌面设备记录 | `DELETE` | `/api/admin/desktop-device/:id` | [./admin/deleteDesktopDevice.md](./admin/deleteDesktopDevice.md) |

### 13.5 仪表盘与统计
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 获取仪表盘聚合数据 | `GET` | `/api/admin/dashboard` | [./admin/getDashboard.md](./admin/getDashboard.md) |
| 分页查询官网访问/下载记录摘要 | `GET` | `/api/admin/website-records` | [./admin/listWebsiteRecords.md](./admin/listWebsiteRecords.md) |
| 获取官网记录详情 | `GET` | `/api/admin/website-records/:type/:id` | [./admin/getWebsiteRecordDetail.md](./admin/getWebsiteRecordDetail.md) |

### 13.6 动态配置管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 获取动态配置列表 | `GET` | `/api/admin/dynamic-configs` | [./admin/listDynamicConfigs.md](./admin/listDynamicConfigs.md) |
| 创建动态配置 | `POST` | `/api/admin/dynamic-configs` | [./admin/createDynamicConfig.md](./admin/createDynamicConfig.md) |
| 更新动态配置 | `PUT` | `/api/admin/dynamic-configs/:id` | [./admin/updateDynamicConfig.md](./admin/updateDynamicConfig.md) |
| 删除动态配置 | `DELETE` | `/api/admin/dynamic-configs/:id` | [./admin/deleteDynamicConfig.md](./admin/deleteDynamicConfig.md) |

### 13.7 用户管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询用户列表 | `GET` | `/api/admin/users` | [./admin/listUsers.md](./admin/listUsers.md) |
| 获取用户详情与统计 | `GET` | `/api/admin/users/:id` | [./admin/getUserDetail.md](./admin/getUserDetail.md) |
| 分页获取用户歌单/歌曲/听歌历史数据 | `GET` | `/api/admin/users/:id/library` | [./admin/getUserLibrary.md](./admin/getUserLibrary.md) |
| 更新用户资料与 VIP 权益 | `PUT` | `/api/admin/users/:id` | [./admin/updateUser.md](./admin/updateUser.md) |
| 硬删除用户 | `DELETE` | `/api/admin/users/:id` | [./admin/deleteUser.md](./admin/deleteUser.md) |

### 13.8 验证码记录管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询验证码记录列表 | `GET` | `/api/admin/verification-codes` | [./admin/listVerificationCodes.md](./admin/listVerificationCodes.md) |

### 13.9 反馈管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询用户反馈列表 | `GET` | `/api/admin/feedback` | [./admin/listFeedback.md](./admin/listFeedback.md) |
| 查看用户反馈详情 | `GET` | `/api/admin/feedback/:id` | [./admin/getFeedbackDetail.md](./admin/getFeedbackDetail.md) |
| 更新用户反馈处理状态 | `PATCH` | `/api/admin/feedback/:id/status` | [./admin/updateFeedbackStatus.md](./admin/updateFeedbackStatus.md) |

### 13.10 故障上报管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询故障上报批次列表 | `GET` | `/api/admin/fault-reports` | [./admin/listFaultReports.md](./admin/listFaultReports.md) |
| 获取故障上报批次详情 | `GET` | `/api/admin/fault-reports/:id` | [./admin/getFaultReportDetail.md](./admin/getFaultReportDetail.md) |
| 更新故障上报处理状态 | `PATCH` | `/api/admin/fault-reports/:id/status` | [./admin/updateFaultReportStatus.md](./admin/updateFaultReportStatus.md) |
| 删除故障上报批次及日志 | `DELETE` | `/api/admin/fault-reports/:id` | [./admin/deleteFaultReport.md](./admin/deleteFaultReport.md) |

### 13.11 外链分享管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 分页查询分享记录 | `GET` | `/api/admin/shares` | [./admin/listShares.md](./admin/listShares.md) |
| 标记指定分享失效 | `PATCH` | `/api/admin/shares/:uuid/invalid` | [./admin/invalidateShare.md](./admin/invalidateShare.md) |

### 13.12 网盘音乐管理与审核
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 创建网盘音乐上传会话 | `POST` | `/api/admin/cloud-music/upload-sessions` | [./admin/createCloudMusicUploadSession.md](./admin/createCloudMusicUploadSession.md) |
| 预登记网盘音乐资产 | `POST` | `/api/admin/cloud-music/:uuid/assets/:kind/reserve` | [./admin/reserveCloudMusicAsset.md](./admin/reserveCloudMusicAsset.md) |
| 确认网盘音乐资产上传完成 | `POST` | `/api/admin/cloud-music/:uuid/assets/:kind/complete` | [./admin/completeCloudMusicAsset.md](./admin/completeCloudMusicAsset.md) |
| 获取网盘音乐列表 | `GET` | `/api/admin/cloud-music` | [./admin/listCloudMusic.md](./admin/listCloudMusic.md) |
| 获取网盘音乐完整详情 | `GET` | `/api/admin/cloud-music/:uuid` | [./admin/getCloudMusicDetail.md](./admin/getCloudMusicDetail.md) |
| 编辑并保存网盘音乐草稿 | `PUT` | `/api/admin/cloud-music/:uuid` | [./admin/updateCloudMusic.md](./admin/updateCloudMusic.md) |
| 审核网盘音乐曲目 | `POST` | `/api/admin/cloud-music/:uuid/review` | [./admin/reviewCloudMusic.md](./admin/reviewCloudMusic.md) |
| 获取管理端试听/预览地址 | `GET` | `/api/admin/cloud-music/:uuid/preview-url` | [./admin/getCloudMusicPreviewUrl.md](./admin/getCloudMusicPreviewUrl.md) |
| 获取临时文件统计摘要 | `GET` | `/api/admin/cloud-music/temp-summary` | [./admin/getCloudMusicTempSummary.md](./admin/getCloudMusicTempSummary.md) |
| 一键清理临时网盘文件 | `POST` | `/api/admin/cloud-music/temp-cleanup` | [./admin/cleanupCloudMusicTemp.md](./admin/cleanupCloudMusicTemp.md) |
| 删除网盘音乐曲目 | `DELETE` | `/api/admin/cloud-music/:uuid` | [./admin/deleteCloudMusic.md](./admin/deleteCloudMusic.md) |

### 13.13 听歌等级管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 获取听歌等级完整配置 | `GET` | `/api/admin/listening/levels` | [./admin/listeningLevels.md](./admin/listeningLevels.md) |
| 整体替换听歌等级配置 | `PUT` | `/api/admin/listening/levels` | [./admin/listeningLevels.md](./admin/listeningLevels.md) |

### 13.14 运行时策略配置管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 获取运行时策略配置 | `GET` | `/api/admin/runtime-config` | [./admin/getRuntimeConfig.md](./admin/getRuntimeConfig.md) |
| 批量修改运行时策略配置 | `PATCH` | `/api/admin/runtime-config` | [./admin/updateRuntimeConfig.md](./admin/updateRuntimeConfig.md) |

### 13.15 一起听房间管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 查询在线一起听房间列表 | `GET` | `/api/admin/listen-together/online` | [./admin/listOnlineListeningRooms.md](./admin/listOnlineListeningRooms.md) |
| 获取在线一起听房间详情 | `GET` | `/api/admin/listen-together/online/:recordId` | [./admin/getOnlineListeningRoom.md](./admin/getOnlineListeningRoom.md) |
| 安全解散在线一起听房间 | `POST` | `/api/admin/listen-together/online/:recordId/dissolve` | [./admin/dissolveOnlineListeningRoom.md](./admin/dissolveOnlineListeningRoom.md) |
| 分页查询一起听房间历史记录 | `GET` | `/api/admin/listen-together/history` | [./admin/listListeningRoomHistory.md](./admin/listListeningRoomHistory.md) |
| 获取一起听房间历史详情 | `GET` | `/api/admin/listen-together/history/:recordId` | [./admin/getListeningRoomHistoryDetail.md](./admin/getListeningRoomHistoryDetail.md) |

### 13.16 专属消息管理
| 接口名称 | Method | 请求路径 | 接口文档链接 |
| :--- | :--- | :--- | :--- |
| 向用户或设备发送专属消息 | `POST` | `/api/admin/messages` | [./admin/sendDirectMessage.md](./admin/sendDirectMessage.md) |
| 分页查询专属消息发送记录 | `GET` | `/api/admin/messages` | [./admin/listDirectMessages.md](./admin/listDirectMessages.md) |
