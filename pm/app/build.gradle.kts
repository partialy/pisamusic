plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt)
    kotlin("kapt")
    id("kotlinx-serialization")
}

android {
    namespace = "cn.partialy.pm"
    compileSdk = 35

    defaultConfig {
        applicationId = "cn.partialy.pm"
        minSdk = 29
        targetSdk = 35
        versionCode = 521
        versionName = "2.3.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "SYSTEM_SERVICE_BASE_URL", "\"https://pm-server.hs.partialy.cn/\"")
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
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
    kapt {
        correctErrorTypes = true
    }
}

dependencies {
    // AndroidX 核心库
    implementation(libs.androidx.core.ktx)
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
    implementation(libs.glide)
    kapt(libs.compiler)

    // 网络请求
    implementation(libs.retrofit)
    implementation(libs.converter.gson)
    implementation(libs.logging.interceptor)
    implementation(libs.okhttp)

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
    kapt(libs.hilt.compiler)

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
