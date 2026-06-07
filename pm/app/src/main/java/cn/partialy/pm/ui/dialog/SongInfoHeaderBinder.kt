package cn.partialy.pm.ui.dialog

import android.view.View
import android.widget.ImageView
import android.widget.TextView
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

object SongInfoHeaderBinder {
    fun bind(
        root: View,
        song: SongInfo?,
        fallbackTitle: CharSequence? = null,
        fallbackSubtitle: CharSequence? = null,
    ) {
        val cover = root.findViewById<ImageView>(R.id.songInfoCoverView)
        val title = root.findViewById<TextView>(R.id.songInfoTitleView)
        val artist = root.findViewById<TextView>(R.id.songInfoArtistView)

        title.text = song?.name ?: fallbackTitle ?: ""
        artist.text = song?.artist ?: fallbackSubtitle ?: ""
        artist.visibility = if (artist.text.isNullOrBlank()) View.GONE else View.VISIBLE

        val coverData = song?.let { SongCoverUrl.getSongCoverData(it, SongCoverUrl.SIZE_SMALL) }
        if (coverData == null) {
            cover.setImageResource(R.drawable.ic_pm_icon)
        } else {
            cover.load(coverData) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        }
    }
}
