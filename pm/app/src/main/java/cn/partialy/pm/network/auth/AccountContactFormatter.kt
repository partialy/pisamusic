package cn.partialy.pm.network.auth

object AccountContactFormatter {
    fun mask(value: String?): String {
        val text = value?.trim().orEmpty()
        if (text.isBlank()) return "未绑定"
        if (text.length <= 5) return text
        return "${text.take(3)}******${text.takeLast(2)}"
    }
}
