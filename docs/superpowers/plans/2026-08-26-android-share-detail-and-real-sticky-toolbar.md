# Android 分享详情动作与歌单真吸顶工具条实施计划

> **For Codex:** 在当前 `dev` 分支直接执行，保留工作区内前一轮未提交改动。严格按本计划修改；本轮不运行单元测试、Gradle 编译、安装或启动，由老大真机验证。

**目标：** 分享详情页使用歌曲列表同款来源标签，并根据进入方式把右侧动作明确为“分享”或“收藏”；歌单详情只保留一份“播放全部”工具条，让它随 Header 上移并在顶栏下方真实固定。

**实现原则：** 来源视觉直接复用 `SongSourceTagBinder`，不新增平台 Logo 风格。分享详情使用现有 Intent 契约区分本地详情与 UUID 分享唤醒。吸顶工具条不再依赖阈值切换两份 View，而是用 Header 中的等高占位确定初始位置，外层唯一工具条根据占位 View 的实时坐标上移，到达顶栏底部后停止。

**技术栈：** Kotlin、Android ViewBinding、RecyclerView、ConstraintLayout、Hilt、现有 `ShareBottomSheet` / `PlaylistCollectionManager` / `PlaylistDetailInteractionController`。

---

## 任务 1：分享详情来源改为同款音源标签

**文件：**

- 修改：`pm/app/src/main/res/layout/activity_share_detail.xml`
- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/ShareDetailActivity.kt`

**步骤：**

1. 将信息面板第一行改成可同时容纳普通信息文字和音源标签的容器，新增 `shareDetailSourceTag` TextView。
2. 歌曲详情继续显示“歌手”文字并隐藏来源标签。
3. 歌单详情把第一行文字固定为“来源”，将 `source` 映射为 `SongType` 后交给 `SongSourceTagBinder.bind()`：KG/WY 显示与歌曲歌手尾部相同的 `K` / `Y` 单字母标签，KW/LOCAL 沿用当前公共标签规则。
4. 无法识别的来源隐藏标签，不回退显示平台文字，避免出现两套来源样式。

## 任务 2：按进入方式切换分享详情右侧动作

**文件：**

- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/ShareDetailActivity.kt`
- 修改：`pm/app/src/main/res/values/strings.xml`

**步骤：**

1. 复用现有入口判定：`EXTRA_LOCAL_TYPE + EXTRA_LOCAL_JSON` 为“点击详情进入”，`EXTRA_UUID` 为“分享唤醒进入”，不新增或改变外链协议。
2. 本次只替换歌单详情原“复制 ID”按钮：点击歌单“详情”进入时，右侧按钮显示“分享”与 `ic_share_24`，调用 `ShareBottomSheet.showPlaylist()`。
3. UUID 分享唤醒进入歌单时，右侧按钮显示“收藏”与收藏图标，通过 `PlaylistCollectionManager` 按 KG/WY 兼容类型查找、添加或取消收藏，并反馈结果；不再复制 ID。LOCAL 分享快照没有歌曲列表，需提示暂不支持收藏。
4. 歌曲详情原有“播放 / 收藏”动作保持不变，不把本次歌单按钮需求扩大到歌曲。
5. 主按钮仍保持歌单“打开歌单”；本地详情信息面板第三行把动作式“复制 ID”改成纯字段名“ID”，分享唤醒仍显示分享人，不改变服务端分享数据契约。

## 任务 3：把双 View 伪吸顶改为单 View 真吸顶

**文件：**

- 修改：`pm/app/src/main/res/layout/item_playlist_detail_header.xml`
- 修改：`pm/app/src/main/res/layout/activity_playlist_detail.xml`
- 修改：`pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt`

**步骤：**

1. Header 内原“播放全部”行只保留等高、不可点击的占位区域，不再绑定播放或搜索动作。
2. `activity_playlist_detail.xml` 中现有外层工具条成为唯一真实工具条，始终承担“播放全部”、数量和搜索点击。
3. `PlaylistDetailInteractionController` 在 RecyclerView 滚动和布局变化时读取 Header 占位区域相对根布局的 Y 坐标：工具条在初始位置覆盖占位区域，随列表向上同步移动，到达 `headerBar.bottom` 后把 `translationY` 限制为 0，形成连续真实吸顶。
4. Header 完全离屏时工具条继续固定；回滚后工具条按同一坐标连续下移，不做 `VISIBLE/GONE` 突变，也不再调用 `setInlinePlayAllVisible()`。
5. Header 内搜索展开后仍位于工具条占位区下方；从吸顶搜索按钮进入时继续回到顶部并聚焦原搜索框。

## 任务 4：统一四类歌单详情调用

**文件：**

- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/PlaylistDetailActivity.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/WyPlaylistDetailActivity.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/LocalPlaylistDetailActivity.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt`

**步骤：**

1. 移除四个 Activity 中按 180dp/顶栏不透明度切换吸顶工具条显示的调用，仅保留顶栏透明度、标题和图标色处理。
2. KG / WY / 本地歌单保留外层工具条搜索入口；“我的收藏”继续隐藏搜索入口，因为搜索已迁移到右上角独立页面。
3. 播放全部动作、歌曲数量和完整列表播放语义保持不变。

## 任务 5：同步项目说明并交由真机验证

**文件：**

- 修改：`pm/AGENTS.md`
- 修改：`pm/design-html/components.md`

**步骤：**

1. 记录分享详情的来源标签及入口动作语义。
2. 记录歌单详情使用唯一工具条与 Header 占位坐标完成真实吸顶，禁止恢复双 View 切换。
3. 只检查目标文件差异和工作区状态；不运行测试、编译、安装或 App 启动。
