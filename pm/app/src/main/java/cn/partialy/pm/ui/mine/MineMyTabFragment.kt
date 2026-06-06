package cn.partialy.pm.ui.mine

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.FavoritePlaylistsActivity
import cn.partialy.pm.activity.LocalMusicActivity
import cn.partialy.pm.activity.LovedSongsPlaylistActivity
import cn.partialy.pm.activity.SettingsActivity
import cn.partialy.pm.databinding.FragmentMineMyTabBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import com.google.android.material.button.MaterialButton
import com.google.android.material.imageview.ShapeableImageView
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class MineMyTabFragment : Fragment() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentMineMyTabBinding? = null
    private val binding get() = _binding!!
    private var createLocalPlaylistDialogView: View? = null

    private val pickPlaylistCoverLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            val ctx = context ?: return@registerForActivityResult
            if (uri == null) return@registerForActivityResult
            val dv = createLocalPlaylistDialogView
            viewLifecycleOwner.lifecycleScope.launch {
                val ok = withContext(Dispatchers.IO) {
                    runCatching {
                        ctx.contentResolver.openInputStream(uri)?.use { input ->
                            MinePlaylistCoverResolver.pendingNewCoverFile(ctx).outputStream().use { output ->
                                input.copyTo(output)
                            }
                        } ?: error("no stream")
                    }.isSuccess
                }
                if (!ok) {
                    Toast.makeText(ctx, R.string.toast_playlist_cover_read_failed, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                refreshCreateDialogCustomCoverUi(dv, ctx)
            }
        }

    private val localPlaylistsAdapter = MinePlaylistsAdapter(
        onMoreClick = { playlist ->
            MinePlaylistMoreBottomSheet.show(this, playlist, playlistCollectionManager)
        },
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentMineMyTabBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.mineFavorites.root.setOnClickListener {
            LovedSongsPlaylistActivity.start(requireActivity())
        }

        binding.mineFavoritePlaylists.favoritesCoverImageView.setImageResource(R.drawable.my_favorites_cover_peach)
        binding.mineFavoritePlaylists.titleTextView.setText(R.string.my_favorite_playlists)
        binding.mineFavoritePlaylists.root.setOnClickListener {
            FavoritePlaylistsActivity.start(requireActivity())
        }

        binding.mineLocalMusic.root.setOnClickListener {
            LocalMusicActivity.start(requireActivity())
        }

        val settings = binding.mineSettingsCoverRow
        settings.entryCoverImageView.setImageResource(R.drawable.icon_settings)
        settings.titleTextView.setText(R.string.settings)
        settings.root.setOnClickListener {
            SettingsActivity.start(requireActivity())
        }
        val addButtonId = resources.getIdentifier("addLocalPlaylistButton", "id", requireContext().packageName)
        view.findViewById<View>(addButtonId).setOnClickListener {
            showCreateLocalPlaylistDialog()
        }

        val localRv = binding.localPlaylistsRecyclerView
        localRv.layoutManager = LinearLayoutManager(requireContext())
        localRv.adapter = localPlaylistsAdapter
        localRv.itemAnimator = null

        viewLifecycleOwner.lifecycleScope.launch {
            playlistCollectionManager.playlistsFlow.collectLatest { list ->
                val localOnly = list.filter { it.type == CollectedPlaylistType.LOCAL }
                binding.localPlaylistsHeaderTextView.isVisible = true
                binding.localPlaylistsEmptyTextView.isVisible = localOnly.isEmpty()
                localPlaylistsAdapter.submitList(localOnly) {
                    binding.localPlaylistsRecyclerView.post {
                        (parentFragment as? MineFragment)?.requestMineViewPagerHeightUpdate()
                    }
                }
            }
        }
    }

    private fun refreshCreateDialogCustomCoverUi(dialogView: View?, ctx: android.content.Context) {
        if (dialogView == null) return
        val pending = MinePlaylistCoverResolver.pendingNewCoverFile(ctx)
        val has = pending.exists() && pending.length() > 0L
        dialogView.findViewById<MaterialButton>(R.id.clearCustomCoverButton).isVisible = has
        val preview = dialogView.findViewById<ShapeableImageView>(R.id.customCoverPreview)
        preview.isVisible = has
        val ph = MinePlaylistCoverResolver.defaultLocalCoverRes()
        if (has) {
            preview.load(pending) {
                crossfade(true)
                placeholder(ph)
                error(ph)
            }
        } else {
            preview.setImageDrawable(null)
        }
    }

    private fun showCreateLocalPlaylistDialog() {
        val ctx = requireContext()
        MinePlaylistCoverResolver.pendingNewCoverFile(ctx).delete()
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_local_playlist, null, false)
        createLocalPlaylistDialogView = dialogView
        val coverRv = dialogView.findViewById<RecyclerView>(R.id.coverPickerRecyclerView)
        val titleEt = dialogView.findViewById<EditText>(R.id.playlistTitleEdit)
        val introEt = dialogView.findViewById<EditText>(R.id.playlistIntroEdit)
        val pickBtn = dialogView.findViewById<MaterialButton>(R.id.pickCustomCoverButton)
        val clearBtn = dialogView.findViewById<MaterialButton>(R.id.clearCustomCoverButton)

        val coverAdapter = CreateLocalPlaylistCoverPickerAdapter()
        coverAdapter.onTemplateSelected = {
            MinePlaylistCoverResolver.pendingNewCoverFile(ctx).delete()
            refreshCreateDialogCustomCoverUi(dialogView, ctx)
        }
        coverRv.layoutManager = LinearLayoutManager(ctx, RecyclerView.HORIZONTAL, false)
        coverRv.adapter = coverAdapter
        coverRv.itemAnimator = null

        pickBtn.setOnClickListener { pickPlaylistCoverLauncher.launch("image/*") }
        clearBtn.setOnClickListener {
            MinePlaylistCoverResolver.pendingNewCoverFile(ctx).delete()
            refreshCreateDialogCustomCoverUi(dialogView, ctx)
        }

        val dialog = PmSlotDialog.Builder(ctx)
            .setContentView(dialogView)
            .setCancelButton(getString(R.string.cancel))
            .setConfirmButton(
                text = getString(R.string.dialog_ok),
                dismissOnConfirm = false,
            ) { dialog ->
                val name = titleEt.text?.toString()?.trim().orEmpty()
                if (name.isEmpty()) {
                    Toast.makeText(ctx, R.string.toast_playlist_name_required, Toast.LENGTH_SHORT).show()
                    return@setConfirmButton
                }
                val intro = introEt.text?.toString()?.trim().orEmpty()
                val coverTemplate = MinePlaylistCoverResolver.coverStorageValue(coverAdapter.selectedSuffix)
                val pending = MinePlaylistCoverResolver.pendingNewCoverFile(ctx)
                val hasCustom = pending.exists() && pending.length() > 0L
                viewLifecycleOwner.lifecycleScope.launch {
                    val id = playlistCollectionManager.createLocalPlaylist(name, intro, coverTemplate)
                    if (hasCustom) {
                        val ok = withContext(Dispatchers.IO) {
                            runCatching {
                                val dest = MinePlaylistCoverResolver.persistedCoverFile(ctx, id)
                                pending.copyTo(dest, overwrite = true)
                                pending.delete()
                                playlistCollectionManager.updateLocalPlaylistMeta(
                                    id,
                                    cover = MinePlaylistCoverResolver.storageValueForAbsolutePath(dest.absolutePath),
                                )
                            }.isSuccess
                        }
                        if (!ok) {
                            Toast.makeText(ctx, R.string.toast_playlist_cover_save_failed, Toast.LENGTH_SHORT).show()
                        }
                    }
                    dialog.dismiss()
                }
            }
            .show()

        dialog.setOnDismissListener {
            createLocalPlaylistDialogView = null
            MinePlaylistCoverResolver.pendingNewCoverFile(ctx).delete()
        }
    }
}
