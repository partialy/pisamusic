# Pisa Music Android 播放器视觉与双页改造实施计划

> 状态：已按 Q1–Q67 实施；编译/聚焦测试与人工验收进展见同目录 PLAYER_VISUAL_REDESIGN_PROGRESS.md。
> 范围：E:\Projects\Project\pisamusic\pm（Android 客户端）。
> 目标：修复动态歌词背景矩形/方块边界与流动效果不明显的问题；将播放器中间内容升级为封面页与完整歌词页，保持原有控制区和功能兼容。
> 约束：不修改 PC、Server、音频核心及服务端协议；不新增第三方动画引擎或 Compose；本次不构建 Release 包、不升级版本。

## 1. 已确认的设计决策

### 1.1 动态背景

- Q1–Q6：限定 Android UI；背景用单 Canvas 自绘连续柔和渐变，保留静态模式；流动清晰但不随音乐节奏闪烁；目标 30fps，遵守系统动画与省电策略。
- Q7：智能封面取色（优先真实封面色相，处理亮度/饱和度，不统一强制蓝紫色）；缓存色板。
- Q8：动态模式完全移除旧模糊封面纹理，仅由颜色光场渲染；静态模式保留修复后的模糊封面。
- Q9：4–5 个柔和光团组合「流动、呼吸、融合」，独立运动且避免机械往返。
- Q10：根据色板与对比度动态控制全局/局部遮罩，保证歌词可读。
- Q11：切歌只对色板插值（约 1000–1500ms），保持光团运动相位和位置连续；拒绝迟到封面结果。
- Q12：用户暂停音乐时背景继续运动；页面不可见、系统禁动画或释放时停止。
- Q13：保留原「动态歌词背景」开关，下面增设「动态背景设置」入口，用 BottomSheet 配置六类参数。
- Q14：透明/黑白/纯色/极亮/无封面统一兜底，同歌曲复用缓存。

### 1.2 双页结构与布局

- Q15–Q17：设置页开关与 Sheet 分开；独立实时预览 + 取消放弃草稿 + 保存原子提交 + 恢复默认（仅改草稿）。
- Q18–Q19：第一页为自适应方形高清封面 + 背后露出约 25%–35% 的黑胶；封面目标屏宽 70%–75%，小屏幕按可用高度压缩；12dp 圆角。
- Q20–Q22：第一页三行歌词居中、当前句突出；歌曲名/歌手/音源标签在三行歌词下方；第二页完整歌词上方显示较大歌名/歌手/音源标签，顶部公共栏不重复标题。
- Q23：完整歌词顶部/底部渐隐，逐字与普通模式视觉一致。
- Q24、Q34（最终修订）：两页功能按钮保持原有布局、数量、顺序、业务和入口完全一致；不再实施“分页面差异化按钮”的早期建议。
- Q25、Q37：记住用户最后所在页面；新用户默认第一页；切歌不重置页面。
- Q26–Q29：中间内容仅横向翻页，歌词纵向浏览；顶部、功能栏、进度条、底部控制不参与翻页；点击封面或三行歌词进入完整歌词页，不直接 Seek。
- Q30（最终修订）：三行歌词严格单行；只有当前句超长才水平自动滚动，前后句截断省略；不采用当前句最多两行方案。
- Q31–Q32：第一页逐字高亮复用解析数据；第二页保持现有中线定位/Seek、手动滚动后约 3 秒恢复自动跟随。
- Q33：播放时黑胶缓慢旋转，暂停停在原角度；系统禁动画时静止。
- Q38–Q39：小屏/横屏/大字自适应；无歌词、加载失败仍允许两页切换。

### 1.3 参数、动画与最后修订

- Q35：速度 0.5–2.0×（0.1 步进，默认 1.0）；幅度、光晕、亮度、饱和度均 0–100%（5% 步进，默认 50%）。
- Q36：Sheet 中变更只影响局部预览；保存后背景平滑应用；关闭/取消丢弃。
- Q40–Q41：仅高亮句超长时水平滚动；新增 CompactLyricsView，复用 LyricLine/LyricWord，不重写歌词解析器。
- Q42–Q45：配置继续存 SharedPreferences / SettingsPrefs，保留原开关 Key；预览目标 15fps；返回播放器实时应用新参数；同时修复静态模糊背景边界。
- Q46–Q53：正常背景 30fps、系统省电优先 15fps、系统禁动画静态；只保持两个页面实例；系统返回手势优先；黑胶自绘；恢复状态；删旧动态代码；执行单元测试和 Debug 构建；按阶段提交，保留已有未提交变更。
- Q54–Q57：长当前句延迟约 350ms 之后向左滚动至末尾，不循环；基准约 30dp/s 且限制最高速度；播放暂停/Seek 时保持与播放时间一致；左右边缘约 12–20dp 渐隐。
- Q58：ViewPager2 原生跟手横向切换，不添加缩放/旋转转场。
- Q59（最终修订）：两个分页指示器置于页面顶部**原歌名与歌手所在的居中位置**，而不是功能栏上方；顶部左返回、右更多保持不动。
- Q60：歌词页浏览状态保留，并沿用手动浏览约 3 秒后的恢复策略。
- Q61–Q63：设置预览优先使用当前歌曲真实色板，没有歌曲用默认色板；「跟随封面 / 柔和色彩 / 鲜艳色彩」都基于真实封面色相处理；摘要显示「默认 / 自定义」，非法设置值规范化。
- Q64：系统禁动画时背景、黑胶和单行歌词横向滚动均静止，但歌词当前行和逐字高亮依播放进度继续正确更新，翻页可用。
- Q65–Q66：两页歌曲信息在各自内容区呈现；音源标签复用 SongSourceTagBinder 跟随歌手，顶部公共栏只保留分页指示器。
- **Q67（最终修订，优先级最高）**：一起听胶囊**位置完全不变**。进入一起听时，**隐藏胶囊位置的歌名、歌手及音源标签**，退出一起听则立即恢复。不可为了容纳标题而移动胶囊。实现时以第二页顶部标题槽为主要互斥对象；第一页三行歌词下方的独立歌曲信息若与胶囊不重叠，维持正常展示；禁止粗暴隐藏整页所有歌名信息。

## 2. 现状、根因与验证顺序

### 2.1 已查到的源码

- res/layout/activity_player.xml：现为 flowingCoverBackgroundView → blurredBgImageView → bgScrim → contentLayout；头部有 songTitleTextView / artistTextView / songSourceTagTextView；lyricsContainer 含普通 RecyclerView、KaraokeLyricsView、中线 Seek 覆盖层及 listenTogetherChip；下方为 actionRow、进度条、时间和播放控制。
- ui/player/background/FlowingCoverBackgroundView.kt：2 组交叉渐变 LayerBank；每组四个全屏 MATCH_PARENT 的 View，背景使用 GradientDrawable.RADIAL_GRADIENT；对各 View 做位移、缩放、旋转。
- ui/player/background/FlowingCoverMotionRules.kt：四组周期 29/37/43/53 秒，随机位移约 ±12%，缩放 1.04–1.18，旋转 ±2°；随机量可能非常接近零。
- ui/player/background/PlayerBackgroundController.kt：加载封面并抽取色板；动态模式使模糊封面透明度为 0.22、1.12 倍缩放，另外播放一组缓慢位移/旋转动画；Android 12+ 使用 400px RenderEffect 模糊，旧版 RenderScript 模糊 25；切歌有 songKey 防旧请求覆盖。
- activity/PlayerActivity.kt：歌词请求、歌曲状态绑定、播放控制、原生歌词 RecyclerView、逐字歌词同步及手动浏览 Seek 均已实现；Activity 文件约 1779 行，不得继续扩张其职责。
- ui/player/KaraokeLyricsView.kt：ACTION_DOWN 即 requestDisallowInterceptTouchEvent(true)，会与新横向 ViewPager2 手势竞争。
- lyric/LyricParser.kt：统一 LyricContent/LyricLine/LyricWord 与时间戳；可直接复用。
- activity/PlaybackSettingsActivity.kt：已有动态背景开关；可新增 SubSettingsItem.Navigation。
- ui/player/LyricSettingsSheet.kt、pm/components.md：已记录 M3 BottomSheet、滑轨、预览、开关与步进器复用样式。

### 2.2 根因假设与开发前复现

代码层已确定图层叠加与微弱动效机制，但矩形边界的**唯一直接来源尚未通过真机分层实验验证**。禁止在计划中把某层当成百分百已证实的根因。

先在可复现歌曲与设备上做三组 A/B 验证：
1. 隐藏 blurredBgImageView，只留光场和遮罩；观察矩形边界是否消失。
2. 隐藏 FlowingCoverBackgroundView，只留模糊封面和遮罩；观察是否出现边缘颜色块。
3. 去掉临时遮罩/运动，分别比较截图与录屏；记录设备、Android 版本、屏幕宽高、背景是否启用、动画时间点。

结果用于明确静态/动态图层修复点，不改变已确认的单 Canvas 架构目标。

## 3. 动态背景模块设计

### 3.1 单 Canvas 渲染

- 将旧 FlowingCoverBackgroundView 改为 Canvas 渲染（可保留文件名，内部完全替换），所有光团在同一个坐标系绘制；背景先填充不透明 baseColor，再在 Canvas 上叠加 4–5 个从中心色到全透明的径向渐变。
- 使用 RadialGradient 与 Shader localMatrix（或等效变换）控制中心位置、半径及椭圆形态，确保渐变外沿透明度自然衰减到零。**禁止为每个光团再创建全屏 View**，禁止使用带矩形底色的单独图层。
- 光团的起始位置与相位由稳定 songKey seed 决定；位置随单调时间进行独立正弦/缓动轨迹，持续平滑流动；呼吸改变半径与亮度，颜色融合通过 alpha/色板参数完成。
- 典型基础周期 16–28 秒，各光团略微错开；禁止每轮结束突然回跳。幅度最小值为 0 时只停水平/纵向位移，允许呼吸保持；速度参数映射到相位增量，避免调整参数时相位重置。
- 避免 per-frame Bitmap、Shader、Drawable、Matrix/List 大量分配；资源在尺寸或色板更新时重建，逐帧只更新坐标与矩阵。不能在主线程进行图片解码、Palette 提取或重型模糊。
- 渲染区域覆盖整个 View，包括系统栏背景；边缘使用超出可视区域的安全外延、透明径向渐变及统一 Canvas 裁剪，保证任意时间点看不到矩形边框。
- 保留当前窗口下的背景/遮罩分层结构兼容性，但动态模式中 blurredBgImageView 完全不参与视觉合成，也不做独立漂移动画。

### 3.2 色板与对比度

- 封面取色使用 CoverFlowPaletteExtractor 和 CoverFlowPaletteRules 的思路做升级：小尺寸缩略图 → Palette 主要候选 → 过滤极透明/近重复颜色 → 调整 HSL → 补足少量衍生色。
- 彩色封面优先保持真实色相；纯色封面用同色系明暗及邻近色，黑白封面采用低饱和冷色辅助光晕；封面失败使用既有 fallbackPalette。
- 控制 baseColor 在适合白色文本的深色范围，亮度/饱和度参数做相对变换；对可读性设硬约束，极端参数也不得使歌词/按钮失去辨识度。
- 将动态遮罩 alpha 从现有硬编码 #80000000 改为跟随色板亮度与预设参数调节；必要时只在歌词显示区使用局部柔和暗化，不能重新叠加明显矩形色块。
- 缓存按歌曲身份（必要时附封面版本）索引，沿用 LruCache 思路；切歌新请求优先，任何旧结果不能覆盖当前调色板；不要让颜色提取取消后泄漏 Bitmap。

### 3.3 切歌过渡与生命周期

- 使用一个渲染器，旧色板到新色板同位置插值，过渡 1000–1500ms；运动轨迹与时钟不中断；连续快速切歌从屏幕当前显示色值插到最新目标，不跳色、不堆积 Animator。
- Activity onStart/onStop、View attach/detach、系统动画开关与省电模式控制动画调度；主循环采用 Choreographer 或等效帧节流，正常上限 30fps，PowerManager.isPowerSaveMode 下优先 15fps，系统动画被禁止则只绘制单帧。
- 用户播放暂停不影响背景流动；Activity 销毁撤销帧回调、Coil 请求、提色任务、监听器及动画，禁止重复注册。
- 静态模式保留模糊封面，但使用充分覆盖视窗的 centerCrop/安全放大与合理模糊半径；验证 API 29–30 旧实现和 API 31+ 新实现均无边缘块。静态背景无额外漂移动画。

## 4. 动态背景设置 Sheet

### 4.1 配置与范围

新增类型化配置 PlayerFlowBackgroundConfig（名称可随项目风格统一），建议包括：
- speedX10：5–20，默认 10；UI 显示 0.5×–2.0×，0.1× 步进。
- motionAmplitudePercent：0–100，默认 50，步进 5。
- glowIntensityPercent：0–100，默认 50，步进 5。
- brightnessPercent：0–100，默认 50，步进 5；50 为算法中性值。
- saturationPercent：0–100，默认 50，步进 5；50 为算法中性值。
- colorMode：FOLLOW_COVER（默认）/ SOFT / VIVID。SOFT/VIVID 只是围绕封面色板的色彩变换，不是固定配色。
- dynamicEnabled：继续读取原 KEY_DYNAMIC_LYRIC_BACKGROUND，不更换 Key、默认仍为 true。

在 SettingsPrefs 新增读取/写入函数及 Key；所有数值读取时严格规范化并限制边界；保存时一次 SharedPreferences.edit 原子提交整组参数，摘要通过与默认 Config 对比得到「默认 / 自定义」。已有用户不需要数据库迁移。

### 4.2 Sheet 与预览

- PlaybackSettingsActivity 原开关下新增 SubSettingsItem.Navigation「动态背景设置」，关闭开关时设置入口仍可进入；右侧显示默认/自定义摘要。
- 新建 DynamicBackgroundSettingsSheet + XML 布局，参考 bottom_sheet_lyric_settings.xml 的圆角、标题、内边距、滑轨和最大高度处理。固定顶部动态预览，下方参数滚动区，底部「恢复默认」「取消」「保存」。
- 每次打开从 SettingsPrefs 复制编辑草稿，拖动只更新 PreviewRenderer（上限 15fps）；使用当前音乐的色板，没有歌曲用 fallback 色板。恢复默认只更新草稿；保存写入 SettingsPrefs 并发送/读取最新配置；取消、返回、下滑退出都丢弃草稿。
- 玩家 onResume 或配置变更监听读取新参数并平滑应用，不重建播放器、不重置当前页；默认运行态独立于 Sheet 草稿；关闭 Sheet 必须释放预览帧回调和绑定，禁止死循环。
- 校验小屏、横屏、无障碍大字体和系统禁动画，保证按钮可以触达，滚动条可操作，预览不阻挡设置控件。

## 5. 双页播放器结构

### 5.1 布局层次

activity_player.xml 改为：
- 全局背景：FlowingCoverBackgroundView / 静态封面 ImageView（二选一可见）/ bgScrim。
- contentLayout 顶部 headerBar：左 collapseButton / 中间 pageIndicator / 右 moreButton；原公共 songTitleTextView、artistTextView、songSourceTagTextView 移入页面内部的歌曲信息组件；指示器选中态主题蓝色短胶囊，未选中为半透明圆点，不需要可点击。
- 中央 lyricsContainer：ViewPager2（仅两页）、现有 listenTogetherChip、必要的覆盖层；胶囊保持**原容器顶部居中、原 top margin 及外观**；禁止为新标题移动其 X/Y。
- contentLayout 下方保留现有 actionRow、progressBar、timeLayout、controlsLayout 的结构、按钮顺序、间距、回调与可达性；整个下方区域不跟随 ViewPager2 平移。
- 播放队列 BottomSheet、dimOverlay 和其它现有弹窗层级保持不变，不破坏手势及点击穿透。

### 5.2 两个页面的生命周期

- ViewPager2 + 两个固定页面实例（offscreenPageLimit=1）即可；新增 PlayerPagesAdapter / 页面 Binder 或 Fragment，遵循现有 ViewBinding 架构，不引入 Compose。
- 歌曲、歌词、播放位置、播放意图、封面等数据源**由 PlayerActivity / 共享状态控制器统一订阅一次**，再向两页分发；不允许两页各自重复请求网络歌词或分别注册冗余逐帧观察者。
- page index 0=封面、1=完整歌词；用户新装默认 0；切换后写入 SettingsPrefs，onSaveInstanceState 优先恢复短期状态，进程重启时读取上次选择；切歌不会强制跳页。
- 点击封面或任一三行歌词切到页 1，不自动 Seek；横向翻页只发生在中央内容，底部控制操作独立。

### 5.3 第一页：封面 + 黑胶 + 三行歌词

- 新增布局 player_page_cover.xml（最终命名遵循现有资源习惯）和封面页 Binder；封面优先使用 SongCoverUrl.getSongCoverData(song, SongCoverUrl.SIZE_XLARGE) 与 Coil 现有本地嵌入封面兜底，避免重新发明封面 URL 策略。
- 默认封面占屏宽 70%–75%，圆角 12dp，按剩余可用高度限制最大尺寸；黑胶由自绘/VectorDrawable 实现，在背面右侧露出约 25%–35%，不加载大型 PNG。
- 唱片缓慢旋转（约 20–30 秒/圈），播放时启动，暂停保持角度，恢复继续；切歌平滑替换封面；系统禁动画时不旋转，Activity 停止时取消动画，返回可恢复角度。
- 三行歌词：上一句/当前句/下一句；严格一行高且单行，邻句超长末尾省略。当前句高亮放大并加粗，使用现有歌词配色首选，超长时按第 6 节滚动。
- 三行歌词下方显示歌曲名、歌手和来源标签，沿用 SongSourceTagBinder；歌词为空或正在加载时显示项目现有的「暂无歌词」「正在加载歌词...」等状态，不让页面内容跳变。
- 在较低高度设备上，优先压缩封面和间距，保留操作行/进度条/播放控制和歌词可读性；不能用固定 dp 导致按钮跑出屏幕。

### 5.4 第二页：完整歌词

- 新建 player_page_lyrics.xml / Binder，顶部展示更大歌名、歌手、音源标签，其下原有 lyricsRecyclerView 与 karaokeLyricsView；只使用一个实际激活的歌词展示组件。
- 复用 LyricsAdapter、KaraokeLyricsView、LyricDisplayPrefs、原中线 Seek 及用户滚动恢复约 3 秒策略；渐隐遮罩通过渐变 mask 或 Canvas 控制，不在歌词上叠加生硬遮挡层。
- 现有上下滚动、逐字状态、歌词高亮及人工 Seek 不被 ViewPager2 横向手势抢占；不要重新创建不同时间轴的歌词同步器。
- **一起听互斥：** listenTogetherChip 保留原位置、大小、样式、点击行为及原显示/隐藏条件。胶囊显示时，第二页与该位置相互覆盖的 headerSongInfo（歌名/歌手/来源标签）整体 GONE/INVISIBLE（以现有布局测量保证不遮挡为准）；胶囊隐藏后 headerSongInfo 恢复。第一页位于三行歌词下的独立歌曲信息不会与胶囊重叠时应保留。不能移动胶囊到其它位置；统一在 together 状态回调里更新互斥显示，页面切换与退出房间都需刷新。
- 若第一页封面碰到固定胶囊位置，仅调整封面页内容的安全顶部空间，不改变胶囊坐标。

## 6. 歌词动画与手势处理

### 6.1 CompactLyricsView

- 新建 ui/player/CompactLyricsView.kt（或同职责轻量复合 View），直接接收 LyricContent/LyricLine/LyricWord 和 positionMs、isPlaying、LyricDisplayStyle；负责三行排版、当前句高亮、逐字填充及单行横向偏移。
- 数据唯一权威来自 LyricParser 与播放器时间戳；不另建歌词下载/解析逻辑，不为三行歌词增加独立网络或固定频率轮询。
- 当前句逐字高亮时使用字/词 startTime/endTime 在当前播放位置插值，使用已有歌词颜色与缩放配置；非逐字歌词回退整句高亮。
- 仅当前句超宽时，延迟约 350ms 向左滚动直到尾端、不循环；基准 30dp/s，按歌词有效展示时间适配但有最高速度限制，歌词太短时不强制滚到末尾；邻句一律省略号。
- 左右裁切边缘使用约 12–20dp 渐隐。滚动进度依据媒体时间与当前行/暂停状态计算；暂停冻结，Seek 重新定位，快速切歌/切行取消旧动画；系统关闭动画时静态显示但高亮保持时间准确。

### 6.2 横向/纵向手势仲裁

- 为第二页歌词区域实现 TouchSlop + 位移方向判定，超过阈值且 |dx| 明显大于 |dy| 时允许 ViewPager2 拦截，纵向拖动时让歌词 RecyclerView/KaraokeLyricsView 处理；未判定前不抢断；起落手势、ACTION_CANCEL 和多指事件都正确清理。
- 特别修复 KaraokeLyricsView 的 ACTION_DOWN 无条件 requestDisallowInterceptTouchEvent(true) 行为。不能破坏原本的惯性纵向滚动、人工浏览、逐字高亮和中线 Seek。
- 仅 Pager 区域允许滑动翻页，控制栏/SeekBar 与顶部按钮排除；系统侧边返回手势拥有优先级，不强制吞掉系统返回。
- 切页过程中不 Seek、不切歌、不取消正在播放的音频；第二页滚动浏览状态保留，返回后按原 3 秒窗口恢复自动跟随。

## 7. 预计文件与职责

| 类型 | 文件/位置 | 改动 |
| --- | --- | --- |
| 修改 | app/src/main/res/layout/activity_player.xml | 抽出顶部歌曲信息，添加 header 分页指示器与中间 ViewPager2，保留所有公共播放控制和固定一起听胶囊 |
| 修改 | app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt | 只负责页面状态收集/委托、观察者、共享操作与状态分发；迁出新视图细节 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/PlayerPagesAdapter.kt | 固定双页与状态恢复 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/CoverPlayerPageBinder.kt | 封面页封面/黑胶/三行歌词绑定 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/FullLyricsPageBinder.kt | 完整歌词页、源标签、一起听与原歌词逻辑对接 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/CompactLyricsView.kt | 单行三句、逐字高亮、歌词水平滚动 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/PlayerSwipeDirectionPolicy.kt | 横竖方向判定策略，可单元测试 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/VinylDiscView.kt | 黑胶绘制、旋转状态与资源管理 |
| 新增 | app/src/main/res/layout/player_page_cover.xml | 第一页大封面、黑胶、三句、歌曲信息 |
| 新增 | app/src/main/res/layout/player_page_lyrics.xml | 第二页歌曲信息、歌词列表、原中线 Seek 覆盖层 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/KaraokeLyricsView.kt | 按方向仲裁触摸，保留纵向浏览 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/LyricsAdapter.kt | 若需支持边缘渐隐等，仅做必要调整，沿用设置读取 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/background/FlowingCoverBackgroundView.kt | 移除旧双 Bank/全屏 blob View，改单 Canvas |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/background/FlowingCoverMotionRules.kt | 改连续、可测、可配置的时间/速度/幅度模型 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/background/CoverFlowPalette.kt | 色板、极端封面兜底与颜色插值 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/background/CoverFlowPaletteExtractor.kt | 透明过滤、色板提取安全性及复用 |
| 修改 | app/src/main/java/cn/partialy/pm/ui/player/background/PlayerBackgroundController.kt | 单动态/静态模式切换、配置、调度、切歌和资源生命周期 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/background/PlayerFlowBackgroundConfig.kt | 参数模型、范围、默认值、规范化与显示映射 |
| 新增 | app/src/main/java/cn/partialy/pm/ui/player/background/DynamicBackgroundSettingsSheet.kt | Sheet 独立草稿、实时预览、保存/取消 |
| 新增 | app/src/main/res/layout/bottom_sheet_dynamic_background_settings.xml | M3 设置布局、预览、滑轨、底部操作 |
| 修改 | app/src/main/java/cn/partialy/pm/activity/PlaybackSettingsActivity.kt | 原开关下新增设置入口、摘要、Sheet 调用 |
| 修改 | app/src/main/java/cn/partialy/pm/utils/SettingsPrefs.kt | 配置与页面索引持久化，旧 Key 保持 |
| 修改 | app/src/main/res/values/strings.xml（及必要资源） | 设置、页面辅助说明、无障碍文本 |
| 修改 | pm/components.md、pm/AGENTS.md | 新增可复用组件索引及新播放器架构规则 |
| 新增/修改 | app/src/test/java/cn/partialy/pm/ui/player/*、background/* | 动画/颜色/配置/手势/歌词行为测试 |

以上是建议命名与分工；实施前比对实际工程结构，文件可按职责最小调整。禁止重复建一个音源标签业务实现或重复订阅音乐播放器。

## 8. 分阶段执行与 Git 提交

实施前固定基线：从 monorepo 根目录检查 git status --short，保护已有不相关改动；特别注意已有 build.gradle.kts、SplashActivity.kt、一起听布局和图标变更，**不得覆盖或混入本次提交**。优先在无需改动 Gradle 依赖的情况下实施。

1. **Commit A：动态背景绘制与静态回退修复。** 先验证旧边界来源，再重写 FlowingCoverBackgroundView、MotionRules、色板/控制器；增加颜色与轨迹单测。验收动态无明显方块、切歌平滑、静态无边界。
2. **Commit B：详细背景设置 Sheet。** 新增配置模型、SettingsPrefs、PlaybackSettingsActivity 入口、Sheet/预览和相应资源；验证草稿/保存/取消/默认/异常值/省电与实时生效。
3. **Commit C：双页布局与封面。** 新建两页、顶部指示器、黑胶和 UI Binder；保留现有 actionRow 等控制和既有回调；验证页面记忆、封面点击跳页、切歌不跳页。
4. **Commit D：紧凑三行歌词与手势。** 新增 CompactLyricsView、逐字高亮、滚动与方向判定；修复 KaraokeLyricsView、处理中线 Seek；实现 Q67 固定一起听胶囊及互斥隐藏；验证两页与一起听。
5. **Commit E：验证、清理和文档。** 删除废弃的旧动态 View/Animator 逻辑及无引用资源，更新 pm/components.md 与 pm/AGENTS.md，补足测试与视觉验收，保证 Diff 无无关改动。

每步提交前仅 git add 对应改动文件；验证 git diff --cached，无触碰用户已有工作区变更。提交信息参考仓库近期风格，不在计划阶段擅自提交。

**Git 忽略规则特别说明：**当前根目录 .gitignore 第 24 行的 docs/ 会忽略本计划文件（Git 显示 !! pm/docs/player/PLAYER_VISUAL_REDESIGN_PLAN.md）。计划已写到磁盘，但默认 git status 不展示、普通 git add 也不会跟踪它。若后续希望把本计划纳入 Git，须在用户同意提交时显式执行 git add -f -- pm/docs/player/PLAYER_VISUAL_REDESIGN_PLAN.md，或由用户决定调整 ignore 规则；目前不擅自修改 .gitignore、暂不暂存或提交该计划。

## 9. 验收矩阵

### 9.1 背景

- [ ] 多张亮色、暗色、纯色、黑白、透明及无封面歌曲动态背景没有可见矩形、硬边、突然跳色。
- [ ] 背景在正常速度下肉眼可见自然流动，静帧对比 5–10 秒存在变化；歌词和按钮始终可读。
- [ ] 快速切歌/连续切歌仅最后一首色板有效；新旧背景 1000–1500ms 连贯插值。
- [ ] 动态关闭后是静态模糊封面；API 29–30 和 31+ 视觉可接受，边缘不暴露。
- [ ] 省电、系统禁动画、离开页面、恢复及销毁后无重复动画任务或明显闪烁。

### 9.2 双页、歌词和一起听

- [ ] 顶部中央是分页指示器，不再重复显示公共歌名/歌手。
- [ ] 两页现有功能按钮数量/顺序/布局与回调一致；进度条、播放/暂停、队列和更多可用。
- [ ] 第一页大封面/黑胶不挤占底部控件；封面点击和三行歌词点击进入第二页。
- [ ] 三行歌词严格单行；当前句长文本向左滚动到末尾，不循环；邻句超长省略；逐字高亮不重新解析。
- [ ] 暂停、恢复、Seek、切歌、无歌词及歌词迟到结果均不造成错行/越界/异常。
- [ ] 第二页完整歌词上下滚动、惯性、中线 Seek、3 秒恢复、逐字模式正常；横向翻页不误判为歌词 Seek。
- [ ] **一起听胶囊保持原坐标**；进入房间隐藏同位置歌名/歌手/音源标签，退出房间恢复；普通模式不会留空、挡字或闪烁。
- [ ] 切歌保持当前页，重新打开恢复上次页；锁屏/后台/旋转/进程重建后歌词和页面正确恢复。
- [ ] 系统边缘返回手势可用，中央横向翻页与竖向歌词浏览互不干扰。

### 9.3 参数 Sheet 与测试

- [ ] 开关与设置入口相互独立，Sheet 最大高度、滑轨、M3 控件符合既有规范。
- [ ] 六类参数取值/步进准确；「跟随封面/柔和/鲜艳」均在封面色相基础上调整。
- [ ] 预览使用当前歌色板并独立限帧；关闭后停止；取消不保存，保存一次性写入，恢复默认需保存，摘要同步。
- [ ] 旧版仅有 dynamic_lyric_background 开关的用户升级后不丢失偏好；非法/过期值自动规范化。
- [ ] 执行相关 JUnit：色板兜底与插值、运动轨迹连续性、配置边界/默认值、手势方向、歌词行/逐字偏移、页面状态策略。
- [ ] 在 pm 目录执行 gradlew.bat testDebugUnitTest 和 gradlew.bat assembleDebug，记录结果；不声称未经真机验证的视觉表现已通过。
- [ ] 至少覆盖 Android 10/API29、Android 12/API31+、常见小屏和大屏、深浅主题与大字体；人工录屏比较背景前后效果及长歌词滚动。
- [ ] 不修改服务端 API、Android 版本号、签名资产或当前未提交的其他用户改动。

## 10. 编码启动条件和非目标

- 本文档保留原决策与验收要求；当前实现和验证状态以 `PLAYER_VISUAL_REDESIGN_PROGRESS.md` 为准。用户已于 2026-11-06 授权开始编码，按阶段实施并提交；真机验收仍单独记录。
- 编码开始前再次校验工作区状态和相关 AGENTS.md；若用户工作区出现新改动，以保留为原则，避免覆盖。
- 不包含：PC 播放器改造、服务端接口、音频引擎调整、卡拉 OK 全部逻辑重写、桌面歌词、全新歌词翻译模块、横滑切歌、复杂节拍/频谱驱动、发行构建及自动发布。
- 最终交付报告需说明每个提交的内容、测试结果、未完成项和需要真机检查的视觉项目。
