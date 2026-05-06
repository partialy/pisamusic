package cn.partialy.pm.network.kg

/**
 * 蓝源 [dfid] 由 [/register/dev] 写入，供 [DfidInterceptor] 附加到请求。
 */
class DfidHolder {
    @Volatile
    var dfid: String? = null

    fun clear() {
        dfid = null
    }
}
