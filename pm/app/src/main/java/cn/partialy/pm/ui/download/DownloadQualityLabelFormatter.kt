package cn.partialy.pm.ui.download

import android.content.Context
import cn.partialy.pm.R

/** 显示实际音质档位；最高可用请求不能据此推断实际码率。 */
object DownloadQualityLabelFormatter {
    fun format(context: Context, key: String): String = when (key.lowercase()) {
        "wy-br:128000", "kg:128", "wy-level:standard", "kw:standard" -> "128"
        "wy-br:192000", "wy-level:higher" -> "192"
        "wy-br:320000", "kg:320", "wy-level:exhigh", "kw:exhigh" -> "320"
        "kg:flac" -> "FLAC"
        "kg:high" -> "HIGH"
        "kg:viper_atmos" -> "ATMOS"
        "kg:viper_clear" -> "CLEAR"
        "wy-level:lossless", "kw:lossless" -> "LOSSLESS"
        "wy-level:hires" -> "HI-RES"
        "wy-level:jyeffect" -> "SURROUND"
        "wy-level:sky" -> "SKY"
        "wy-level:dolby" -> "DOLBY"
        "wy-level:jymaster" -> "MASTER"
        "wy-br:999000", "wy-br:max", "br:max" -> context.getString(R.string.download_row_quality_max)
        "cloud:default" -> context.getString(R.string.download_row_quality_default)
        else -> context.getString(R.string.download_row_quality_unknown)
    }
}
