package cn.partialy.pm.ui.dialog

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.share.ShareLink
import cn.partialy.pm.share.ShareQrBitmapFactory
import cn.partialy.pm.share.ShareRepository
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

object ShareBottomSheet {
    fun showSong(activity: FragmentActivity, song: SongInfo) {
        showSong(activity, song.toCanonicalSong())
    }

    fun showSong(activity: FragmentActivity, song: CanonicalSong) {
        val safe = song.shareSafe()
        show(
            activity = activity,
            title = safe.name,
            description = safe.singer,
            cover = safe.cover,
        ) { repository, token ->
            repository.createSongShare(token, safe)
        }
    }

    fun showPlaylist(activity: FragmentActivity, playlist: CanonicalPlaylist) {
        val safe = playlist.shareSafe()
        val description = safe.desc.ifBlank {
            activity.getString(R.string.share_playlist_fallback_desc, safe.source.uppercase(), safe.song_count)
        }
        show(
            activity = activity,
            title = safe.name,
            description = description,
            cover = safe.cover,
        ) { repository, token ->
            repository.createPlaylistShare(token, safe)
        }
    }

    private fun show(
        activity: FragmentActivity,
        title: String,
        description: String,
        cover: String,
        createShare: suspend (ShareRepository, String) -> cn.partialy.pm.share.ShareCreateData,
    ) {
        val session = AccountSessionStore.read(activity)
        if (!session.loggedIn) {
            activity.showBusinessMessage(activity.getString(R.string.share_login_required))
            return
        }

        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = activity.layoutInflater.inflate(R.layout.bottom_sheet_share, null)
        bindHeader(root, title, description, cover)

        val loading = root.findViewById<ProgressBar>(R.id.shareSheetLoading)
        val qrImage = root.findViewById<ImageView>(R.id.shareSheetQrImage)
        val linkLayout = root.findViewById<TextInputLayout>(R.id.shareSheetLinkLayout)
        val linkEdit = root.findViewById<TextInputEditText>(R.id.shareSheetLinkEditText)
        var currentLink = ""

        linkLayout.isEnabled = false
        linkLayout.setEndIconOnClickListener {
            if (currentLink.isBlank()) return@setEndIconOnClickListener
            copyLink(activity, currentLink)
        }
        root.findViewById<ImageButton>(R.id.shareSheetCloseButton).setOnClickListener {
            dialog.dismiss()
        }

        dialog.setContentView(root)
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxHeight = (dialog.context.resources.displayMetrics.heightPixels * 0.82f).roundToInt()
            BottomSheetBehavior.from(bottomSheet as ViewGroup).apply {
                skipCollapsed = true
                this.maxHeight = maxHeight
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.show()

        activity.lifecycleScope.launch {
            try {
                val repository = shareRepository(activity)
                val created = createShare(repository, session.token)
                currentLink = created.shareUrl.ifBlank { ShareLink.buildWebLink(created.uuid) }
                linkEdit.setText(currentLink)
                qrImage.setImageBitmap(ShareQrBitmapFactory.create(currentLink, QR_SIZE))
                loading.isVisible = false
                qrImage.isVisible = true
                linkLayout.isEnabled = true
            } catch (error: Throwable) {
                val message = error.message?.takeIf { it.isNotBlank() }
                    ?: activity.getString(R.string.share_create_failed)
                activity.showBusinessMessage(message)
                dialog.dismiss()
            }
        }
    }

    private fun bindHeader(root: View, title: String, description: String, cover: String) {
        root.findViewById<TextView>(R.id.shareInfoTitleView).text = title
        root.findViewById<TextView>(R.id.shareInfoDescriptionView).text = description
        val coverView = root.findViewById<ImageView>(R.id.shareInfoCoverView)
        val coverData = cover.remoteOrEmpty()
        if (coverData.isBlank()) {
            coverView.setImageResource(R.drawable.ic_pm_icon)
        } else {
            coverView.load(coverData) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        }
    }

    private fun copyLink(activity: FragmentActivity, link: String) {
        val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(activity.getString(R.string.share_link_label), link))
        activity.showBusinessMessage(activity.getString(R.string.share_link_copied))
    }

    private fun FragmentActivity.showBusinessMessage(message: String) {
        if (this is BaseActivity) {
            showMessage(message)
        } else {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareRepository(context: Context): ShareRepository =
        EntryPointAccessors.fromApplication(
            context.applicationContext,
            ShareEntryPoint::class.java,
        ).shareRepository()

    private fun CanonicalSong.shareSafe(): CanonicalSong {
        val safeCover = SongCoverUrl.getRemoteCover(source, cover, SongCoverUrl.SIZE_MEDIUM)
        return copy(cover = safeCover, coverSize = coverSize.takeIf { safeCover.isNotBlank() })
    }

    private fun CanonicalPlaylist.shareSafe(): CanonicalPlaylist {
        val safeCover = SongCoverUrl.getRemoteCover(source, cover, SongCoverUrl.SIZE_MEDIUM)
        return copy(cover = safeCover, coverSize = coverSize.takeIf { safeCover.isNotBlank() })
    }

    private fun String.remoteOrEmpty(): String {
        val value = trim()
        return if (value.startsWith("http://") || value.startsWith("https://")) value else ""
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface ShareEntryPoint {
        fun shareRepository(): ShareRepository
    }

    private const val QR_SIZE = 432
}
