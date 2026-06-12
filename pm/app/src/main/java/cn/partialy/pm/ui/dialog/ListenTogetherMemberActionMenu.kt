package cn.partialy.pm.ui.dialog

import android.view.View
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.listen.ListenTogetherMember
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.imageview.ShapeableImageView

object ListenTogetherMemberActionMenu {

    fun show(
        activity: FragmentActivity,
        member: ListenTogetherMember,
        onTransferHost: () -> Unit,
        onKickMember: () -> Unit,
    ) {
        val displayName = member.displayName()
        ActionMenuBottomSheet.show(
            activity = activity,
            items = listOf(
                ActionMenuItem(
                    iconRes = R.drawable.ic_trans_24,
                    text = activity.getString(R.string.listen_together_transfer_host),
                ) {
                    PmMinimalDialog.show(
                        context = activity,
                        title = activity.getString(R.string.listen_together_transfer_host),
                        message = activity.getString(
                            R.string.listen_together_transfer_host_confirm,
                            displayName,
                        ),
                        confirmText = activity.getString(R.string.listen_together_transfer),
                        onConfirm = onTransferHost,
                    )
                },
                ActionMenuItem(
                    iconRes = R.drawable.ic_remove_people_24,
                    text = activity.getString(R.string.listen_together_remove_member),
                    colorRes = R.color.red,
                ) {
                    PmMinimalDialog.show(
                        context = activity,
                        title = activity.getString(R.string.listen_together_remove_member),
                        message = activity.getString(
                            R.string.listen_together_remove_member_confirm,
                            displayName,
                        ),
                        confirmText = activity.getString(R.string.listen_together_remove),
                        confirmColor = ContextCompat.getColor(activity, R.color.red),
                        onConfirm = onKickMember,
                    )
                },
            ),
            bindHeader = { root -> bindMemberHeader(root, member) },
        )
    }

    private fun bindMemberHeader(root: View, member: ListenTogetherMember) {
        val avatar = root.findViewById<ShapeableImageView>(R.id.songInfoCoverView)
        val title = root.findViewById<TextView>(R.id.songInfoTitleView)
        val subtitle = root.findViewById<TextView>(R.id.songInfoArtistView)

        title.text = member.displayName()
        subtitle.setText(
            if (member.online) {
                R.string.listen_together_member_online
            } else {
                R.string.listen_together_member_offline
            },
        )
        subtitle.visibility = View.VISIBLE
        avatar.shapeAppearanceModel = avatar.shapeAppearanceModel.toBuilder()
            .setAllCornerSizes(avatar.resources.displayMetrics.density * 28f)
            .build()
        val avatarUrl = member.avatarUrl.trim()
        if (avatarUrl.isBlank()) {
            avatar.setImageResource(R.drawable.ic_pm_icon)
        } else {
            avatar.load(avatarUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
                transformations(CircleCropTransformation())
            }
        }
        avatar.contentDescription = member.displayName()
    }
}
