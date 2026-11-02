package cn.partialy.pm.ui.message

import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import cn.partialy.pm.R

enum class MessageType(val priority: Int, @DrawableRes val icon: Int, @ColorRes val tint: Int) {
    INFO(0, R.drawable.ic_msg_info_24, R.color.pm_message_info),
    SUCCESS(0, R.drawable.ic_msg_success_24, R.color.pm_message_success),
    WARNING(1, R.drawable.ic_msg_warning_24, R.color.pm_message_warning),
    ERROR(1, R.drawable.ic_msg_error_24, R.color.pm_message_error),
}
