import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "cn.partialy.pm"
    compileSdk = 36

    defaultConfig {
        applicationId = "cn.partialy.pm"
        minSdk = 29
        targetSdk = 35
        versionCode = 536
        versionName = "2.8.8"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "SYSTEM_SERVICE_BASE_URL", "\"https://pm.hs.partialy.cn/\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        
        debug {
            buildConfigField("String", "SYSTEM_SERVICE_BASE_URL", "\"http://192.168.9.100:53380/\"")
            // 如果需要在debug模式下也启用混淆，可以添加以下配置
            // isMinifyEnabled = true
            // isShrinkResources = true
            // proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
        compose = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_11)
    }
}

hilt {
    enableAggregatingTask = true
}

dependencies {
    // AndroidX 核心库
    implementation(libs.androidx.core.ktx)
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.lifecycle.livedata.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.navigation.fragment.ktx)
    implementation(libs.androidx.navigation.ui.ktx)
    implementation(libs.androidx.documentfile)
    implementation(libs.androidx.recyclerview)
    implementation(libs.androidx.swiperefreshlayout)
    implementation(libs.androidx.transition.ktx)

    // Fragment KTX
    implementation(libs.androidx.fragment.ktx)

    // 图片加载
    implementation(libs.coil)
    implementation(libs.coil.svg)
    implementation(libs.glide)
    implementation(libs.androidx.palette.ktx)

    // 网络请求
    implementation(libs.retrofit)
    implementation(libs.converter.gson)
    implementation(libs.logging.interceptor)
    implementation(libs.okhttp)
    implementation(libs.socket.io.client) {
        exclude(group = "org.json", module = "json")
    }

    // 序列化
    implementation(libs.kotlinx.serialization.json)

    // 协程
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.core)

    // Media3
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.session)
    implementation(libs.media3.ui)
    implementation(libs.media3.common)

    // 添加 MediaCompat 支持
    implementation(libs.androidx.media)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    // Hilt 聚合任务继承 KSP 的处理器依赖，使用当前编译器对应的 Kotlin 元数据读取器。
    ksp(libs.kotlin.metadata.jvm)

    // 完整歌词页中的 Accompanist 渲染组件
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.accompanist.lyrics.ui)
    implementation(libs.accompanist.lyrics.core)

    // 音频标签
    implementation(libs.jaudiotagger)

    // 扫码
    implementation(libs.zxing.android.embedded)

    // 主题
    implementation(libs.material.v1120)

    // 测试
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    // Lifecycle
    implementation(libs.lifecycle.viewmodel.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.livedata.ktx)
}

// 普通原生轻提示只允许 PmMessage；调试异常复制是唯一故障降级白名单。
val verifyMessageUsage by tasks.registering {
    group = "verification"
    description = "检查原生轻提示统一入口与故障降级白名单"
    val sources = fileTree("src/main/java") { include("**/*.kt", "**/*.java") }
    inputs.files(sources)
    doLast {
        val forbidden = Regex("""\b(?:showMessage|emitToast)\b|ListenTogetherUiEvent\.Toast|\bToast\s*\.\s*makeText\s*\(""")
        val allowedPath = "cn/partialy/pm/utils/GlobalExceptionHandler.kt"
        val allowedCall = "Toast.makeText(context, R.string.debug_stack_copied, Toast.LENGTH_SHORT).show()"
        val violations = sources.files.flatMap { file ->
            val relative = file.relativeTo(project.file("src/main/java")).invariantSeparatorsPath
            file.readLines().mapIndexedNotNull { index, line ->
                if (forbidden.containsMatchIn(line) && !(relative == allowedPath && line.trim() == allowedCall))
                    "$relative:${index + 1}" else null
            }
        }
        check(violations.isEmpty()) { "请使用 PmMessage：\n${violations.joinToString("\n")}" }
    }
}
tasks.named("preBuild") { dependsOn(verifyMessageUsage) }
