package cn.partialy.pm.feedback

import android.content.Context
import cn.partialy.pm.R
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object FeedbackFormatters {
    private val todayTimeFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
    private val dateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    private val detailDateTimeFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

    fun typeLabel(context: Context, feedbackType: String?): String = when (feedbackType) {
        "bug" -> context.getString(R.string.feedback_type_bug)
        "suggestion" -> context.getString(R.string.feedback_type_suggestion)
        "account" -> context.getString(R.string.feedback_type_account)
        else -> context.getString(R.string.feedback_type_other)
    }

    fun typeIconRes(feedbackType: String?): Int = when (feedbackType) {
        "bug" -> R.drawable.ic_feedback_type_bug
        "suggestion" -> R.drawable.ic_feedback_type_suggestion
        "account" -> R.drawable.ic_feedback_type_account
        else -> R.drawable.ic_feedback_type_other
    }

    fun isProcessed(status: String?): Boolean = status == "processed"

    fun statusLabel(context: Context, status: String?): String = if (isProcessed(status)) {
        context.getString(R.string.feedback_status_processed)
    } else {
        context.getString(R.string.feedback_status_pending)
    }

    fun formatListTime(
        isoString: String?,
        nowMillis: Long = System.currentTimeMillis(),
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): String {
        val instant = parseInstant(isoString) ?: return ""
        val target = instant.atZone(zoneId)
        val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
        return if (target.toLocalDate() == today) {
            target.format(todayTimeFormatter)
        } else {
            target.format(dateFormatter)
        }
    }

    fun formatDetailTime(
        isoString: String?,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): String {
        val instant = parseInstant(isoString) ?: return ""
        return instant.atZone(zoneId).format(detailDateTimeFormatter)
    }

    private fun parseInstant(raw: String?): Instant? {
        val value = raw?.trim().orEmpty()
        if (value.isEmpty()) return null
        return runCatching { Instant.parse(value) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()
    }
}
