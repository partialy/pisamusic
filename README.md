

# PISA Music

一款用于学习交流的多音源播放器，支持歌曲搜索、在线播放、歌词显示、下载管理与播放列表管理等功能。

## 功能特性

### 核心功能
- **多源音乐搜索**：支持聚合多个音源进行歌曲搜索
- **在线播放**：流畅播放多音源音乐，支持音质选择
- **歌词显示**：滚动歌词显示，支持自定义颜色主题
- **歌曲下载**：支持高品质音乐下载到本地
- **歌单管理**：收藏歌单、管理本地播放列表

### 我的音乐
- **收藏歌曲**：一键收藏喜爱的歌曲
- **本地音乐**：扫描并管理手机本地音频文件
- **下载管理**：查看和管理已下载的音乐

### 播放功能
- **播放模式**：顺序播放、随机播放、单曲循环
- **音质选择**：根据网络状况选择最佳音质
- **迷你播放器**：底部常驻迷你播放器

### 一起听
- **创建房间**：自定义房间名（2–16 字）、6 位随机房号（可手编 4–8 位）、最大人数 2–8、成员控制开关
- **实时同步**：Socket.IO 长连接，房主切歌、暂停、拖动进度，成员侧延迟 < 200ms 跟随
- **房间面板**：当前同步歌曲卡片 + 同步延迟徽章；成员胶囊房主金、自己高亮；复制邀请码 / 分享 / 二维码三键
- **权限切换**：房主一键开关「成员可控制切歌」，关闭时成员上一首/下一首会被服务端拒绝

### 其他
- **主题切换**：支持浅色/深色/跟随系统主题
- **歌单导入**：支持从兼容音源导入歌单

## 项目结构

```
pisamusic/
├── pm/                      # Android 主应用
│   ├── app/src/main/
│   │   ├── java/cn/partialy/pm/
│   │   │   ├── activity/    # Activity 页面
│   │   │   ├── di/          # 依赖注入模块
│   │   │   ├── model/       # 数据模型
│   │   │   ├── network/    # 网络层
│   │   │   ├── player/     # 播放器核心
│   │   │   ├── ui/         # UI 组件
│   │   │   └── utils/      # 工具类
│   │   └── assets/        # 静态资源
│   └── build.gradle.kts
├── server/                  # 后端服务
│   ├── admin/              # 管理后台
│   ├── frontend/          # 官方首页
│   └── src/               # 服务端代码
└── yixi/                  # 桌面端 (Electron)
    ├── electron/          # Electron 主进程
    └── src/              # Vue 渲染进程
```

## 技术栈

### Android 端
- **语言**：Kotlin
- **架构**： MVVM + Clean Architecture
- **依赖注入**： Hilt
- **网络**： Retrofit + OkHttp
- **数据库**： Room + SQLite
- **播放器**： ExoPlayer (Media3)
- **异步**： Kotlin Coroutines + Flow

### 后端
- **运行时**： Node.js
- **框架**： Express
- **数据库**： better-sqlite3

### 桌面端
- **框架**： Electron + Vue 3
- **构建**： electron-vite

## 构建与运行

### Android 应用

```bash
# 进入项目目录
cd pm

# 查看可用任务
./gradlew tasks

# 调试构建
./gradlew assembleDebug

# 发布构建
./gradlew assembleRelease
```

### 后端服务

```bash
cd server

# 安装依赖
npm install

# 启动服务
npm run start
```

### 桌面端

```bash
cd yixi

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 网络 API

项目使用多音源聚合架构，按模块封装搜索、播放、歌词、歌单等能力，便于学习交流和功能验证。

## 许可证

本项目仅供学习交流使用，请尊重各平台服务条款，勿用于商业用途。
