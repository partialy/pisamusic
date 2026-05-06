package cn.partialy.pm.util

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.provider.Settings
import android.telephony.TelephonyManager
import cn.partialy.pm.model.DeviceReportRequest
import java.util.Locale
import java.util.TimeZone

object DeviceInfoCollector {

    fun build(context: Context): DeviceReportRequest {
        val app = context.applicationContext
        val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            app.packageManager.getPackageInfo(app.packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            app.packageManager.getPackageInfo(app.packageName, 0)
        }
        val vc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pi.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            pi.versionCode.toLong()
        }

        val androidId =
            Settings.Secure.getString(app.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        val cert = readProductCert()
        val countryFromSim = telephonyNetworkCountryIso(app)
        val countryCode = (countryFromSim ?: Locale.getDefault().country.takeIf { it.isNotBlank() })
            ?.uppercase(Locale.US)

        val extras = buildMap<String, Any?> {
            put("manufacturer", Build.MANUFACTURER ?: "")
            put("device", Build.DEVICE ?: "")
            put("product", Build.PRODUCT ?: "")
            put("display", Build.DISPLAY ?: "")
            put("release", Build.VERSION.RELEASE ?: "")
            put("packageName", app.packageName)
            val dm = app.resources.displayMetrics
            put("screenWidthPx", dm.widthPixels)
            put("screenHeightPx", dm.heightPixels)
            put("densityDpi", dm.densityDpi)
            Build.SUPPORTED_ABIS.firstOrNull()?.let { put("cpuAbi", it) }
            runCatching {
                val am = app.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                val mi = ActivityManager.MemoryInfo()
                am.getMemoryInfo(mi)
                put("totalMemoryMB", mi.totalMem / (1024L * 1024L))
            }
            put("networkType", networkLabel(app))
            putInstallSource(app)
            cert?.let { put("certModel", it) }
        }

        return DeviceReportRequest(
            deviceName = Build.MODEL ?: "",
            brand = Build.BRAND ?: "",
            model = Build.MODEL ?: "",
            osVersion = Build.VERSION.RELEASE ?: "",
            sdkVersion = Build.VERSION.SDK_INT,
            appVersion = pi.versionName ?: "",
            appVersionCode = vc,
            androidId = androidId,
            certModel = cert,
            countryCode = countryCode,
            timezone = TimeZone.getDefault().id,
            locale = Locale.getDefault().toString(),
            extras = extras,
        )
    }

    private fun MutableMap<String, Any?>.putInstallSource(context: Context) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val info = context.packageManager.getInstallSourceInfo(context.packageName)
                val origin = info.installingPackageName ?: info.originatingPackageName
                put("installSource", origin ?: "")
            } else {
                @Suppress("DEPRECATION")
                put(
                    "installSource",
                    context.packageManager.getInstallerPackageName(context.packageName) ?: "",
                )
            }
        }
    }

    private fun readProductCert(): String? {
        for (key in listOf("ro.product.cert", "ro.boot.cert")) {
            val v = readSystemProperty(key)
            if (!v.isNullOrBlank()) return v.trim()
        }
        return null
    }

    private fun readSystemProperty(key: String): String? {
        return runCatching {
            val c = Class.forName("android.os.SystemProperties")
            val m = c.getMethod("get", String::class.java, String::class.java)
            m.invoke(null, key, "") as String
        }.getOrNull()
    }

    private fun telephonyNetworkCountryIso(context: Context): String? {
        return runCatching {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                ?: return null
            tm.networkCountryIso?.trim()?.takeIf { it.isNotEmpty() }?.lowercase(Locale.US)
        }.getOrNull()
    }

    private fun networkLabel(context: Context): String {
        val cm =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return "unknown"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return "none"
            val caps = cm.getNetworkCapabilities(network) ?: return "unknown"
            return when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "other"
            }
        }
        @Suppress("DEPRECATION")
        val ni = cm.activeNetworkInfo ?: return "unknown"
        @Suppress("DEPRECATION")
        return when (ni.type) {
            ConnectivityManager.TYPE_WIFI -> "wifi"
            ConnectivityManager.TYPE_MOBILE -> "cellular"
            else -> "other"
        }
    }
}
