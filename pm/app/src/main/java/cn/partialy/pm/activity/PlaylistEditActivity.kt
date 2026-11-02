package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.animation.LinearInterpolator
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityPlaylistEditBinding
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.dialog.ActionMenuBottomSheet
import cn.partialy.pm.ui.dialog.ActionMenuItem
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.CreateLocalPlaylistCoverPickerAdapter
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.ui.playlistdetail.PlaylistCoverRequestBinder
import cn.partialy.pm.ui.playlistedit.PlaylistEditError
import cn.partialy.pm.ui.playlistedit.PlaylistEditViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PlaylistEditActivity : BaseActivity() {
    private val viewModel: PlaylistEditViewModel by viewModels()
    private lateinit var binding: ActivityPlaylistEditBinding
    private lateinit var coverBinder: PlaylistCoverRequestBinder
    private var coverValue: String? = null
    private var spinner: ValueAnimator? = null
    private var rendering = false
    private var discardDialog: android.app.Dialog? = null
    private val imagePicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let(viewModel::selectImage)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlaylistEditBinding.inflate(layoutInflater)
        setContentView(binding.root)
        coverBinder = PlaylistCoverRequestBinder(binding.coverView, MinePlaylistCoverResolver.defaultLocalCoverRes())
        enableEdgeToEdgeSystemBars()
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            binding.root.updatePadding(left = bars.left, right = bars.right, top = bars.top, bottom = maxOf(bars.bottom, ime.bottom))
            insets
        }
        ViewCompat.requestApplyInsets(binding.root)
        binding.backButton.setOnClickListener { requestLeave() }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = requestLeave()
        })
        binding.nameInput.doAfterTextChanged { if (!rendering) viewModel.setName(it.toString()) }
        binding.descriptionInput.doAfterTextChanged { if (!rendering) viewModel.setDescription(it.toString()) }
        binding.coverButton.setOnClickListener { showCoverActions() }
        binding.saveButton.setOnClickListener {
            if (!viewModel.state.value.hasChanges) {
                viewModel.discard()
                finish()
            } else viewModel.save()
        }
        viewModel.initialize(intent.getStringExtra(EXTRA_ID).orEmpty())
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    rendering = true
                    if (binding.nameInput.text.toString() != state.name) binding.nameInput.setText(state.name)
                    if (binding.descriptionInput.text.toString() != state.description) binding.descriptionInput.setText(state.description)
                    rendering = false
                    if (coverValue != state.cover) {
                        coverValue = state.cover
                        coverBinder.bind(SongType.LOCAL, state.cover)
                    }
                    val enabled = !state.loading && !state.busy && !state.saving && !completionScheduled
                    binding.nameLayout.isEnabled = enabled
                    binding.descriptionLayout.isEnabled = enabled
                    binding.coverButton.isEnabled = enabled
                    binding.saveButton.isEnabled = enabled
                    binding.backButton.isEnabled = enabled || completionScheduled
                    renderSaving(state.saving)
                    state.error?.let { error ->
                        val message = when (error) {
                            PlaylistEditError.NOT_FOUND -> R.string.playlist_edit_not_found
                            PlaylistEditError.NAME_REQUIRED, PlaylistEditError.NAME_TOO_LONG -> R.string.playlist_edit_name_invalid
                            PlaylistEditError.DESCRIPTION_TOO_LONG -> R.string.playlist_edit_description_invalid
                            PlaylistEditError.IMAGE_FAILED -> R.string.playlist_edit_image_failed
                            PlaylistEditError.SAVE_FAILED -> R.string.playlist_edit_save_failed
                        }
                        when (error) {
                            PlaylistEditError.NAME_REQUIRED, PlaylistEditError.NAME_TOO_LONG,
                            PlaylistEditError.DESCRIPTION_TOO_LONG -> PmMessage.warning(this@PlaylistEditActivity, message)
                            else -> PmMessage.error(this@PlaylistEditActivity, message)
                        }
                        viewModel.consumeError()
                        if (error == PlaylistEditError.NOT_FOUND) finish()
                    }
                    if (state.saved && !completionScheduled) {
                        completionScheduled = true
                        binding.saveButton.isEnabled = false
                        cn.partialy.pm.ui.message.PmMessageFlow.showSuccessThenFinish(this@PlaylistEditActivity, getString(R.string.playlist_edit_saved))
                    }
                }
            }
        }
    }

    private var completionScheduled = false

    private fun requestLeave() {
        if (completionScheduled) { finish(); return }
        val state = viewModel.state.value
        if (state.busy || state.saving || state.loading) return
        if (!state.hasChanges) {
            viewModel.discard()
            finish()
        } else if (discardDialog?.isShowing != true) {
            discardDialog = PmMinimalDialog.Builder(this)
                .setMessage(getString(R.string.playlist_edit_discard))
                .setCancelButton(getString(R.string.cancel))
                .setConfirmButton(getString(R.string.playlist_edit_discard_confirm)) {
                    viewModel.discard()
                    finish()
                }.show()
        }
    }

    private fun showCoverActions() {
        ActionMenuBottomSheet.show(this, listOf(
            ActionMenuItem(R.drawable.ic_image_24, getString(R.string.playlist_edit_gallery)) { imagePicker.launch("image/*") },
            ActionMenuItem(R.drawable.ic_playlist_24, getString(R.string.playlist_edit_templates)) { showTemplates() },
            ActionMenuItem(R.drawable.ic_delete_24, getString(R.string.playlist_edit_default)) { viewModel.selectCover("local_chill") },
        ), bindHeader = { root ->
            root.findViewById<TextView>(R.id.songInfoTitleView).text = getString(R.string.playlist_edit_cover)
            root.findViewById<TextView>(R.id.songInfoArtistView).text = viewModel.state.value.name
            root.findViewById<android.widget.ImageView>(R.id.songInfoCoverView).setImageDrawable(binding.coverView.drawable)
        })
    }

    private fun showTemplates() {
        val adapter = CreateLocalPlaylistCoverPickerAdapter()
        val recycler = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@PlaylistEditActivity, RecyclerView.HORIZONTAL, false)
            this.adapter = adapter
            setPadding(12, 12, 12, 12)
        }
        PmSlotDialog.Builder(this)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ ->
                view.findViewById<TextView>(R.id.dialogTitleText).setText(R.string.playlist_edit_templates)
            }.setContentView(recycler)
            .setCancelButton(getString(R.string.cancel))
            .setConfirmButton(getString(R.string.dialog_ok)) {
                viewModel.selectCover(MinePlaylistCoverResolver.coverStorageValue(adapter.selectedSuffix))
            }.show()
    }

    private fun renderSaving(saving: Boolean) {
        if (saving && spinner == null) {
            binding.saveButton.setText(R.string.playlist_edit_saving)
            binding.saveButton.icon = android.graphics.drawable.RotateDrawable().apply {
                drawable = androidx.appcompat.content.res.AppCompatResources.getDrawable(this@PlaylistEditActivity, R.drawable.ic_loading_loop_24)
                fromDegrees = 0f
                toDegrees = 360f
            }
            spinner = ValueAnimator.ofInt(0, 10000).apply {
                duration = 1000
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener { binding.saveButton.icon?.level = it.animatedValue as Int }
                start()
            }
        } else if (!saving) {
            spinner?.cancel()
            spinner = null
            binding.saveButton.icon = null
            binding.saveButton.setText(R.string.playlist_edit_save)
        }
    }

    override fun onDestroy() {
        spinner?.cancel()
        discardDialog?.dismiss()
        coverBinder.dispose()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_ID = "playlist_edit_id"
        fun start(context: Context, playlistId: String) {
            context.startActivity(Intent(context, PlaylistEditActivity::class.java).putExtra(EXTRA_ID, playlistId))
            AppActivityTransitions.applyForward(context)
        }
    }
}
