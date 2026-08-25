# Android 服务发现对齐 PC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android 冷启动先读取官网第 0 层 discovery 文档，选择健康系统服务 origin，再通过现有 AES-GCM 链路请求 bootstrap 并下发 KG/WY/KW 音源地址，杜绝音源接口误走 Debug 本地系统服务。

**Architecture:** 新增独立 `network/discovery/` 深模块，负责 discovery 文档校验、版本裁决、SharedPreferences 缓存、priority/health 选源和进程内快照；系统 Retrofit 继续使用单例，但通过占位 host + `SystemServiceEndpointInterceptor` 在每次请求发送前读取最新快照。`ConfigManager` 只在 discovery 选源完成后请求 bootstrap，音乐 endpoint 在 bootstrap 成功前保持不可路由，绝不再用 `BuildConfig.SYSTEM_SERVICE_BASE_URL` 伪装 KG/WY/KW 地址。

**Tech Stack:** Kotlin 1.9.24、OkHttp、Retrofit、Gson、Hilt、SharedPreferences、JUnit 4。

## Global Constraints

- 只修改 `pm/`；`yixi/` 只读参考，禁止修改 `server/`、`example/`。
- 保留用户未提交的 `app/build.gradle.kts` `versionName = "2.5.7"`，不暂存、不覆盖。
- discovery 固定读取 `https://pisamusic.partialy.cn/pm-config/config-v1.json`，当前 Android 复用文档 `desktop` 段中的共享服务字段。
- 远程 discovery 中 `schemaVersion` 必须为 `1`，`configVersion` 必须为正整数；`publishedAt` 只校验可解析，不参与新旧裁决。
- 远程 `apiBaseUrl/realtimeBaseUrl` 必须为纯 HTTPS origin，不得包含认证、路径、query、hash；`healthCheckPath/bootstrapPath` 必须是以 `/` 开头的相对路径。
- `serviceOrigins` 按 `priority` 升序、同优先级保持原顺序；依次 health GET，首个 2xx 胜出，全部失败仍返回排序第一项，让 bootstrap 决定是否进入本地模式。
- discovery 选择顺序为 remote → cache → embedded；低于有效缓存或当前内存 `configVersion` 的远程文档不得覆盖。只持久化已校验 discovery JSON，不持久化 bootstrap、网关密钥或音源 URL。
- `BuildConfig.SYSTEM_SERVICE_BASE_URL` 只作为 embedded 系统服务兜底；bootstrap 成功前 KG/WY/KW/proxy 必须保持不可路由，不能回退到系统服务 origin。
- 系统 client 拦截器顺序固定为 endpoint rewrite → AES-GCM encryption → logging → auth；音乐 client 既有拦截器顺序不变。
- 不安装、不启动 App；只做轻量 JVM 测试、Debug 编译和最终 Debug 构建，真机由用户验证。

---

## File Structure

新增 `app/src/main/java/cn/partialy/pm/network/discovery/`：

- `ServiceDiscoveryModels.kt`：远程 DTO、已校验文档、origin、snapshot、source 枚举。
- `ServiceDiscoveryRules.kt`：纯 Kotlin 校验、版本裁决、priority 稳定排序、URL/path 组合。
- `ServiceDiscoveryPrefs.kt`：只保存 discovery 原始 JSON 与 configVersion。
- `ServiceDiscoveryManager.kt`：独立明文拉取、缓存选择、health 探测、原子快照与刷新串行化。
- `SystemServiceEndpointInterceptor.kt`：仅改写 `system.runtime.invalid` 占位 host。

修改现有文件：

- `ConfigManager.kt`：discovery → encrypted bootstrap 单飞；音乐 endpoint bootstrap 前不可路由；暴露动态系统 URL 解析。
- `SystemApiService.kt`：bootstrap 接收 discovery 的相对 `@Url`。
- `NetworkModule.kt`：独立 discovery client、系统占位 base、系统/明文配置动态改址。
- `SplashActivity.kt`：首次协议读取前刷新 discovery；已同意协议后由 bootstrap 刷新链路复用。
- `ListenTogetherSocketClient.kt`、`FeedbackActivity.kt`、`AccountProfileActivity.kt`、`MineFragment.kt`：移除静态系统地址拼接。
- `AGENTS.md`：同步第 0 层 discovery、缓存和音乐 endpoint 不变量。

---

### Task 1: 冻结 discovery 文档与选源规则

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryModels.kt`
- Create: `app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryRules.kt`
- Test: `app/src/test/java/cn/partialy/pm/network/discovery/ServiceDiscoveryRulesTest.kt`

**Interfaces:**
- Produces: `DiscoveryDocumentV1`、`DiscoveryServiceBlock`、`DiscoveryServiceOrigin`、`ServiceDiscoverySnapshot`、`ServiceDiscoverySource`、`ServiceDiscoveryRules.parseAndValidate(raw)`、`chooseDocument(remote, cached, currentVersion)`、`orderedOrigins(document)`、`resolveRelative(origin, path)`。

- [ ] **Step 1: Write failing parser/version/priority tests**

覆盖：线上示例 JSON 可解析；schema 非 1、非正 configVersion、不可解析 publishedAt、HTTP/带路径 origin、非相对 path 被拒绝；priority 稳定排序；remote 版本低于 cache/current 时选择 cache；同版本 remote 优先；全部无效回退 embedded。

```kotlin
@Test fun `remote lower than cache never rolls discovery back`() {
    val selected = ServiceDiscoveryRules.chooseDocument(
        remote = document(version = 2),
        cached = document(version = 3),
        currentVersion = 3,
    )
    assertEquals(3, selected?.configVersion)
}
```

- [ ] **Step 2: Run RED test**

Run: `.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.network.discovery.ServiceDiscoveryRulesTest"`

Expected: FAIL because discovery types do not exist.

- [ ] **Step 3: Implement immutable contracts and rules**

远程 DTO 精确映射当前 JSON 的 `desktop` 字段；校验后转换为不暴露可空字段的内部文档。origin 解析使用 OkHttp `HttpUrl`，验证结果必须满足：

```kotlin
url.isHttps && url.username.isEmpty() && url.password.isEmpty() &&
    url.encodedPath == "/" && url.query == null && url.fragment == null
```

版本裁决只比较 `configVersion`；同优先级排序必须携带原始 index 保持稳定。

- [ ] **Step 4: Run focused tests**

Run: `.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.network.discovery.ServiceDiscoveryRulesTest"`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryModels.kt app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryRules.kt app/src/test/java/cn/partialy/pm/network/discovery/ServiceDiscoveryRulesTest.kt
git commit -m "重构：定义安卓服务发现规则"
```

---

### Task 2: 实现远程、缓存、embedded 与 health 选源

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryPrefs.kt`
- Create: `app/src/main/java/cn/partialy/pm/network/discovery/ServiceDiscoveryManager.kt`
- Test: `app/src/test/java/cn/partialy/pm/network/discovery/ServiceDiscoveryResolverTest.kt`

**Interfaces:**
- Consumes: Task 1 rules。
- Produces: `currentSnapshot()`、`suspend refresh()`、`isCurrent(snapshot)`、`resolveApiUrl(path)`、`currentRealtimeBaseUrl()`。

- [ ] **Step 1: Write failing resolver tests**

用注入的 `fetchDocument`、`healthCheck`、cache fake 测试：remote 正常；remote 低版本时 cache 胜出；remote/cache 无效时 embedded；origin 按 priority 逐个 health；全部不健康选第一项；并发 refresh 串行且旧快照不降级。

- [ ] **Step 2: Implement prefs and manager**

`ServiceDiscoveryPrefs` 仅保存 `rawJson + configVersion`，读取后重新走 Task 1 校验；低版本不覆盖。`ServiceDiscoveryManager` 的 embedded snapshot 使用构造注入的 `BuildConfig.SYSTEM_SERVICE_BASE_URL`，允许其作为受信任 Debug HTTP 兜底，但远程文档仍只允许 HTTPS。

远程 fetch：GET、`Cache-Control: no-cache`、禁止 redirect、总预算 5 秒；health 单 origin 3 秒。刷新选择文档后先更新原子快照，再返回同一 snapshot。

- [ ] **Step 3: Run tests and compile**

Run: `.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.network.discovery.*"`

Run: `.\gradlew.bat compileDebugKotlin`

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/network/discovery app/src/test/java/cn/partialy/pm/network/discovery
git commit -m "重构：实现安卓服务发现选源"
```

---

### Task 3: 动态改写系统服务并经 discovery 请求 bootstrap

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/network/discovery/SystemServiceEndpointInterceptor.kt`
- Modify: `app/src/main/java/cn/partialy/pm/di/NetworkModule.kt`
- Modify: `app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`
- Modify: `app/src/main/java/cn/partialy/pm/network/config/ConfigManager.kt`
- Modify: `app/src/main/java/cn/partialy/pm/activity/SplashActivity.kt`
- Test: `app/src/test/java/cn/partialy/pm/network/discovery/SystemServiceEndpointInterceptorTest.kt`
- Test: `app/src/test/java/cn/partialy/pm/network/config/RuntimeEndpointUnavailableRulesTest.kt`

**Interfaces:**
- Consumes: `ServiceDiscoveryManager` snapshot。
- Produces: all system Retrofit calls use current api origin; bootstrap path comes from discovery; music endpoints become routable only after bootstrap.

- [ ] **Step 1: Test system rewrite and unavailable music fallback**

验证 placeholder 请求按最新 snapshot 改写并保留 path/query，绝对非 placeholder URL 不变；ConfigManager 初始 KG/WY/KW/proxy 地址为 `.invalid`，不得包含 `BuildConfig.SYSTEM_SERVICE_BASE_URL` 或局域网地址。

- [ ] **Step 2: Wire independent clients in Hilt**

`SystemApiService` 和 `ListenTogetherConfigApiService` 的 Retrofit base 固定为 `https://system.runtime.invalid/`。系统 client 顺序：

```kotlin
OkHttpClient.Builder()
    .addInterceptor(systemServiceEndpointInterceptor)
    .addInterceptor(systemEncryptionInterceptor)
    .addInterceptor(loggingInterceptor)
    .addInterceptor(AuthInterceptor())
```

discovery client 不允许包含 encryption、auth、gateway 或 runtime endpoint interceptor，避免依赖环。

- [ ] **Step 3: Bind bootstrap to selected snapshot**

`SystemApiService.getBootstrapConfig(@Url path: String)` 接收 `snapshot.bootstrapPath.trimStart('/')`。`ConfigManager.refreshBootstrapConfig()` 在同一 bootstrap Mutex 内先 `discovery.refresh()`，再请求 bootstrap；response 返回后若 snapshot 已不是 current 则拒绝应用。成功才原子替换 `runtimeEndpoints/runtimeGatewaySign`。

初始化音乐 endpoint 使用不可路由值：

```kotlin
private const val UNAVAILABLE_MUSIC_BASE = "https://music-runtime.invalid/"
```

因此 bootstrap 失败只进入既有本地模式，不会把 `/everyday/recommend` 发到系统服务 origin。

- [ ] **Step 4: Update Splash ordering**

未接受协议分支在读取在线协议前先 `configManager.refreshServiceDiscovery()`；已接受协议继续调用 `refreshBootstrapConfig()`，该方法内部保证 discovery → encrypted bootstrap。保留 10 秒总预算、3 秒本地模式按钮、设备封禁逻辑。

- [ ] **Step 5: Run focused tests and compile**

Run: `.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.network.discovery.*" --tests "cn.partialy.pm.network.config.RuntimeEndpoint*"`

Run: `.\gradlew.bat compileDebugKotlin`

Expected: PASS，且 `rg "everyday/recommend"` 不存在系统 base 手工拼接。

- [ ] **Step 6: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/di/NetworkModule.kt app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt app/src/main/java/cn/partialy/pm/network/config/ConfigManager.kt app/src/main/java/cn/partialy/pm/network/discovery/SystemServiceEndpointInterceptor.kt app/src/main/java/cn/partialy/pm/activity/SplashActivity.kt app/src/test/java/cn/partialy/pm/network
git commit -m "修复：启动先发现系统服务再下发音源"
```

---

### Task 4: 收口系统 URL 消费者、文档与构建

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/listen/ListenTogetherSocketClient.kt`
- Modify: `app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt`
- Modify: `app/src/main/java/cn/partialy/pm/activity/AccountProfileActivity.kt`
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-08-25-android-service-discovery.md`

**Interfaces:**
- Consumes: `ServiceDiscoveryManager.currentSnapshot/resolveApiUrl/currentRealtimeBaseUrl`。
- Produces: socket、反馈和相对头像均跟随运行时系统 origin。

- [ ] **Step 1: Replace static URL consumers**

`ListenTogetherSocketClient.connect()` 每次连接读取 `currentRealtimeBaseUrl()`；反馈提交时读取 `resolveApiUrl("/api/feedback")`；相对头像统一调用公共 `ConfigManager.resolveSystemUrl(raw)`，绝对 HTTPS URL 原样返回，非法相对值返回 null。删除 `@Named("system_api_base_url")` 和 UI 中的 BuildConfig 拼接。

- [ ] **Step 2: Update project context**

在 `AGENTS.md` 记录：Android 启动链路 discovery → health origin → encrypted bootstrap → music endpoints；缓存只保存 discovery；远程防降级；系统 Retrofit/Socket/相对 URL 读取运行时快照；bootstrap 前音乐 endpoint 不可路由。

- [ ] **Step 3: Final lightweight verification**

Run: `.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.network.discovery.*" --tests "cn.partialy.pm.network.config.RuntimeEndpoint*"`

Run: `.\gradlew.bat assembleDebug`

Run: `git diff --check`

Run: `rg -n "BuildConfig.SYSTEM_SERVICE_BASE_URL|system_api_base_url" app/src/main/java`

Expected: tests/build/check PASS；BuildConfig 仅在 discovery embedded provider 中出现，旧 named system base 无运行时消费者。

- [ ] **Step 4: Record manual acceptance without checking it**

在本文末尾保留未勾选真机项：远程成功、远程失败用缓存、无缓存时 embedded/本地模式、音源接口使用 bootstrap gateway、一起听/反馈/相对头像跟随 origin。

- [ ] **Step 5: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/listen/ListenTogetherSocketClient.kt app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt app/src/main/java/cn/partialy/pm/activity/AccountProfileActivity.kt app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt AGENTS.md docs/superpowers/plans/2026-08-25-android-service-discovery.md
git commit -m "完善：统一安卓系统服务运行时地址"
```

---

## Manual Acceptance (由用户真机验证)

- [ ] 冷启动成功读取官网 `config-v1.json`，系统 bootstrap 请求发往选中的 `https://pm-server.hs.partialy.cn`。
- [ ] `/everyday/recommend` 等音乐请求使用 bootstrap 下发的 gateway，不再访问 `192.168.9.100:53380`。
- [ ] 官网 discovery 暂时不可用时使用已缓存且不降级的文档。
- [ ] 首次安装且 discovery 不可用时使用 embedded 系统 origin；bootstrap 失败进入本地模式，音乐请求不误发系统 origin。
- [ ] 一起听 Socket、反馈和相对头像 URL 跟随当前 discovery origin。
- [ ] 设备封禁、3 秒本地模式按钮和 10 秒启动预算保持原有行为。
