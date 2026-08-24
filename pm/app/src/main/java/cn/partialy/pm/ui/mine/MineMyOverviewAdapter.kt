package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemMineCoverTitleRowBinding
import cn.partialy.pm.databinding.ItemMineFavoritesRowBinding
import cn.partialy.pm.databinding.ItemMineLocalMusicRowBinding
import cn.partialy.pm.databinding.ItemMineLocalPlaylistSectionHeaderBinding
import cn.partialy.pm.databinding.ItemMinePlaylistEmptyBinding

class MineMyOverviewAdapter(
    private val onFavoriteSongsClick: () -> Unit,
    private val onFavoritePlaylistsClick: () -> Unit,
    private val onLocalMusicClick: () -> Unit,
    private val onSettingsClick: () -> Unit,
    private val onAddLocalPlaylistClick: () -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private var localPlaylistEmpty = false

    fun setLocalPlaylistEmpty(empty: Boolean) {
        if (localPlaylistEmpty == empty) return
        localPlaylistEmpty = empty
        if (empty) notifyItemInserted(EMPTY_POSITION) else notifyItemRemoved(EMPTY_POSITION)
    }

    override fun getItemViewType(position: Int): Int = when (position) {
        FAVORITE_SONGS_POSITION, FAVORITE_PLAYLISTS_POSITION -> VIEW_TYPE_FAVORITES
        LOCAL_MUSIC_POSITION -> VIEW_TYPE_LOCAL_MUSIC
        SETTINGS_POSITION -> VIEW_TYPE_SETTINGS
        SECTION_POSITION -> VIEW_TYPE_SECTION
        else -> VIEW_TYPE_EMPTY
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            VIEW_TYPE_FAVORITES -> FavoritesViewHolder(
                ItemMineFavoritesRowBinding.inflate(inflater, parent, false),
            )
            VIEW_TYPE_LOCAL_MUSIC -> LocalMusicViewHolder(
                ItemMineLocalMusicRowBinding.inflate(inflater, parent, false),
            )
            VIEW_TYPE_SETTINGS -> SettingsViewHolder(
                ItemMineCoverTitleRowBinding.inflate(inflater, parent, false),
            )
            VIEW_TYPE_SECTION -> SectionViewHolder(
                ItemMineLocalPlaylistSectionHeaderBinding.inflate(inflater, parent, false),
            )
            else -> EmptyViewHolder(ItemMinePlaylistEmptyBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is FavoritesViewHolder -> {
                if (position == FAVORITE_SONGS_POSITION) {
                    holder.bind(
                        imageRes = R.drawable.mine_entry_favorite_songs,
                        titleRes = R.string.my_favorites,
                        onClick = onFavoriteSongsClick,
                    )
                } else {
                    holder.bind(
                        imageRes = R.drawable.mine_entry_favorite_playlists,
                        titleRes = R.string.my_favorite_playlists,
                        onClick = onFavoritePlaylistsClick,
                    )
                }
            }
            is LocalMusicViewHolder -> holder.bind(onLocalMusicClick)
            is SettingsViewHolder -> holder.bind(onSettingsClick)
            is SectionViewHolder -> holder.bind(onAddLocalPlaylistClick)
        }
    }

    override fun getItemCount(): Int = FIXED_ITEM_COUNT + if (localPlaylistEmpty) 1 else 0

    private class FavoritesViewHolder(
        private val binding: ItemMineFavoritesRowBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(imageRes: Int, titleRes: Int, onClick: () -> Unit) {
            binding.favoritesCoverImageView.setImageResource(imageRes)
            binding.titleTextView.setText(titleRes)
            binding.root.setOnClickListener { onClick() }
        }
    }

    private class LocalMusicViewHolder(
        private val binding: ItemMineLocalMusicRowBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(onClick: () -> Unit) {
            binding.localMusicCoverImageView.setImageResource(R.drawable.mine_entry_my_songs)
            binding.root.setOnClickListener { onClick() }
        }
    }

    private class SettingsViewHolder(
        private val binding: ItemMineCoverTitleRowBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(onClick: () -> Unit) {
            binding.entryCoverImageView.setImageResource(R.drawable.mine_entry_app_settings)
            binding.titleTextView.setText(R.string.settings)
            binding.root.setOnClickListener { onClick() }
        }
    }

    private class SectionViewHolder(
        private val binding: ItemMineLocalPlaylistSectionHeaderBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(onAddClick: () -> Unit) {
            binding.addLocalPlaylistButton.setOnClickListener { onAddClick() }
        }
    }

    private class EmptyViewHolder(
        binding: ItemMinePlaylistEmptyBinding,
    ) : RecyclerView.ViewHolder(binding.root)

    private companion object {
        private const val FAVORITE_SONGS_POSITION = 0
        private const val FAVORITE_PLAYLISTS_POSITION = 1
        private const val LOCAL_MUSIC_POSITION = 2
        private const val SETTINGS_POSITION = 3
        private const val SECTION_POSITION = 4
        private const val EMPTY_POSITION = 5
        private const val FIXED_ITEM_COUNT = 5

        private const val VIEW_TYPE_FAVORITES = 1
        private const val VIEW_TYPE_LOCAL_MUSIC = 2
        private const val VIEW_TYPE_SETTINGS = 3
        private const val VIEW_TYPE_SECTION = 4
        private const val VIEW_TYPE_EMPTY = 5
    }
}
