# 保持所有类不被混淆（白名单基础配置）
-keep class ** { *; }

# 允许混淆的包（主要是工具类和实现类）
-keep,allowobfuscation class cn.partialy.pm.utils.** { *; }
-keep,allowobfuscation class cn.partialy.pm.network.cache.** { *; }
-keep,allowobfuscation class cn.partialy.pm.network.interceptor.** { *; }

# 需要保护不被混淆的类
# 1. Activity/Fragment 等界面类
-keep class cn.partialy.pm.activity.* { *; }
-keep class cn.partialy.pm.activity.base.* { *; }
-keep class cn.partialy.pm.ui.**.Activity { *; }
-keep class cn.partialy.pm.ui.**.Fragment { *; }

# 保护基类
-keep class cn.partialy.pm.ui.base.** { *; }
-keepclassmembers class cn.partialy.pm.activity.base.BaseDownloadActivity {
    *;
}

# 2. 数据模型类(用于JSON序列化)
-keep class cn.partialy.pm.model.** { *; }

# 3. API接口和Repository类(用于Retrofit)
-keep class cn.partialy.pm.network.api.** { *; }
-keep class cn.partialy.pm.network.repository.** { *; }

# 4. 核心功能类
-keep class cn.partialy.pm.player.* { *; }
-keep class cn.partialy.pm.App { *; }

# 5. Adapter类(用于RecyclerView)
-keep class cn.partialy.pm.ui.**.adapters.** { *; }

# 基础配置（保持不变）
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions,InnerClasses

# 一定不能混淆的类（即使在允许混淆的包中）
-keep class cn.partialy.pm.activity.MainActivity { *; }
-keep class cn.partialy.pm.activity.SplashActivity { *; }
-keep class cn.partialy.pm.App { *; }
-keep class cn.partialy.pm.model.** { *; }
-keep class cn.partialy.pm.network.api.** { *; }
-keep class cn.partialy.pm.network.repository.** { *; }

# 系统报错
-dontwarn java.awt.Graphics2D
-dontwarn java.awt.Image
-dontwarn java.awt.geom.AffineTransform
-dontwarn java.awt.image.BufferedImage
-dontwarn java.awt.image.ImageObserver
-dontwarn java.awt.image.RenderedImage
-dontwarn javax.imageio.ImageIO
-dontwarn javax.imageio.ImageWriter
-dontwarn javax.imageio.stream.ImageInputStream
-dontwarn javax.imageio.stream.ImageOutputStream
-dontwarn javax.lang.model.element.Modifier
-dontwarn javax.swing.filechooser.FileFilter
#
# ===================== 第三方库混淆规则 =====================

# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }

# Gson
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

-keep class cn.partialy.pm.network.cookie.model.** { <fields>; }

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
    <init>(...);
}
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
    **[] $VALUES;
    public *;
}
-keep class com.bumptech.glide.load.data.ParcelFileDescriptorRewinder$InternalRewinder {
    *** rewind();
}

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-keep class com.google.android.material.** { *; }

# Kotlin 相关
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

-keep class kotlinx.coroutines.** { *; }
-keepclassmembers class kotlinx.coroutines.** {
    public protected *;
}
-dontwarn kotlinx.coroutines.**
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# ViewBinding & DataBinding
-keep class * implements androidx.viewbinding.ViewBinding {
    public static *** bind(android.view.View);
    public static *** inflate(android.view.LayoutInflater);
}

# EventBus
-keepattributes *Annotation*

# Lifecycle
-keep class * extends androidx.lifecycle.ViewModel {
    <init>();
}
-keep class * extends androidx.lifecycle.AndroidViewModel {
    <init>(android.app.Application);
}
-keepclassmembers class * implements androidx.lifecycle.LifecycleObserver {
    <init>(...);
}
-keepclassmembers class * implements androidx.lifecycle.LifecycleOwner {
    androidx.lifecycle.Lifecycle getLifecycle();
}

# Navigation
-keepnames class androidx.navigation.fragment.NavHostFragment
-keep class * extends androidx.navigation.Navigator

# 如果使用了 WebView
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# 如果使用了 JNI/NDK
-keepclasseswithmembernames class * {
    native <methods>;
}

# 文件操作相关
-keepclassmembers class * {
    @kotlin.jvm.Throws <methods>;
}
-keepclassmembers class * {
    void onRequestPermissionsResult(int, java.lang.String[], int[]);
}

# Android 权限相关
-keep class android.content.pm.** { *; }
-keep class android.os.** { *; }

# ==================================================

# 保护 Manifest 相关
-keep class android.support.v4.app.** { *; }
-keep class android.support.v7.app.** { *; }
-keep class androidx.appcompat.app.AppCompatActivity { *; }

# 保护四大组件
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.backup.BackupAgentHelper
-keep public class * extends android.preference.Preference

# 保护自定义View
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    void set*(...);
    *** get*();
}

# 保护 Manifest 中的权限声明
-keep class **.R$* { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保护 Provider
-keepclassmembers class * extends android.content.ContentProvider {
    public <init>();
}

# 保护 Service
-keepclassmembers class * extends android.app.Service {
    public <init>();
}

# 保护 BroadcastReceiver
-keepclassmembers class * extends android.content.BroadcastReceiver {
    public <init>();
}

# 保护 Activity
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}
