# Home Feature Card Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Android 首页三张功能卡调整为露出约半张第三卡的紧凑横向布局，并在图片上增加雾化文案层与今日日期标签。

**Architecture:** 保留现有三张 WebP 作为无文字背景图，由单一 `item_home_feature_card.xml` 负责图片、底部雾化层、标题、描述和日期标签。`HomeFeatureCardsAdapter` 只映射卡片类型到资源与文案，并为“今日推荐”动态生成本地日期；云盘页 Hero 与首页云盘卡复用同一描述文案。

**Tech Stack:** Android View XML、MaterialCardView、RecyclerView、Kotlin、ViewBinding

## Global Constraints

- 仅修改 `pm/` Android 手机端及本计划文档。
- 继续复用现有三张 `res/drawable/home_feature_*.webp`，不重新生成或编辑位图。
- 卡片保持完整触控区域和 contentDescription；文字必须在明暗图片上可读。
- 日期格式固定为 `M-d 周X`，使用设备本地日期，例如 `8-26 周五`。
- 只做 `:app:compileDebugKotlin` 聚焦编译，不安装、不启动、不执行完整测试套件。

---

### Task 1: 收紧功能卡尺寸并建立雾化文案层

**Files:**
- Modify: `pm/app/src/main/res/values/dimens.xml`
- Create: `pm/app/src/main/res/drawable/bg_home_feature_text_fog.xml`
- Create: `pm/app/src/main/res/drawable/bg_home_feature_date_fog.xml`
- Modify: `pm/app/src/main/res/layout/item_home_feature_card.xml`

**Interfaces:**
- Consumes: `home_feature_cloud_music`、`home_feature_daily_recommend`、`home_feature_radar_playlist` 三张 WebP。
- Produces: ViewBinding 字段 `cardImage`、`cardTitle`、`cardSubtitle`、`dailyDateLabel`。

- [x] **Step 1: 调整卡片尺寸**

  将 `home_feature_card_width` 改为 `128dp`，高度改为 `170dp`，卡片末尾间距使用 `10dp`，使常见手机宽度下约显示 2.5 张卡。

- [x] **Step 2: 新增底部雾化与日期雾化背景**

  `bg_home_feature_text_fog.xml` 使用底部深色半透明到顶部透明的渐变；`bg_home_feature_date_fog.xml` 使用半透明深色圆角背景，保证覆盖任意图片时文字仍清晰。

- [x] **Step 3: 重构卡片布局**

  在图片上依次叠放底部雾化层、底部标题/描述容器和默认隐藏的左上日期标签。标题单行、描述最多两行，图片本身不单独暴露无意义的辅助功能节点。

### Task 2: 绑定三张卡片文案与动态日期

**Files:**
- Modify: `pm/app/src/main/res/values/strings.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/adapters/HomeFeatureCardsAdapter.kt`

**Interfaces:**
- Consumes: `HomeFeatureCardKind.CLOUD_MUSIC`、`DAILY_RECOMMEND`、`RADAR_PLAYLIST`。
- Produces: 每张卡的图片、标题、描述、根节点 contentDescription；今日推荐额外输出 `M-d 周X`。

- [x] **Step 1: 固化产品文案**

  使用以下内容：

  ```text
  共享音乐空间 / 宝藏歌曲&珍藏歌曲共享
  今日推荐 / 开启一天的好心情~
  雷达歌单 / 发现与你同频的好歌
  ```

- [x] **Step 2: 将 Adapter 映射收紧为单一展示模型**

  为每个 `HomeFeatureCardKind` 映射 `imageRes`、`titleRes`、`subtitleRes`，统一绑定 `cardTitle` 与 `cardSubtitle`，根节点辅助文案组合标题和描述。

- [x] **Step 3: 生成今日日期**

  使用 `Calendar.getInstance()` 取得月、日、星期，并将 `Calendar.MONDAY` 到 `Calendar.SUNDAY` 映射为 `周一` 到 `周日`；只在 `DAILY_RECOMMEND` 显示 `dailyDateLabel`。

### Task 3: 同步云盘文案与项目 UI 索引

**Files:**
- Modify: `pm/app/src/main/res/values/strings.xml`
- Modify: `pm/components.md`
- Modify: `pm/AGENTS.md`

**Interfaces:**
- Consumes: 首页功能卡已确认的文案与布局规则。
- Produces: 云盘 Hero 与首页共享描述一致，后续开发可从组件索引了解卡片结构。

- [x] **Step 1: 同步云盘 Hero 副标题**

  将 `cloud_music_hero_subtitle` 改为 `宝藏歌曲&amp;珍藏歌曲共享`。

- [x] **Step 2: 更新组件索引与约束说明**

  记录首页功能卡的紧凑横向尺寸、底部雾化文案层和今日推荐动态日期标签，避免后续恢复成纯图片文字方案。

### Task 4: 聚焦验证

**Files:**
- Verify: all files above

**Interfaces:**
- Consumes: 完整实现。
- Produces: 可由用户进行真机视觉验收的可编译 Android 代码。

- [x] **Step 1: 检查资源与旧文案引用**

  Run: `rg -n "绝版音乐共享|今日限定好歌|反复聆听你爱的歌" pm/app/src/main pm/components.md pm/AGENTS.md`

  Expected: 无旧功能卡/云盘 Hero 文案引用。

- [x] **Step 2: 检查补丁格式**

  Run: `git diff --check -- pm docs/superpowers/plans/2026-08-28-home-feature-card-overlay.md`

  Expected: 无空白错误。

- [x] **Step 3: Kotlin 聚焦编译**

  Run: `pm\\gradlew.bat -p pm :app:compileDebugKotlin`

  Expected: `BUILD SUCCESSFUL`；不安装、不启动 App。
