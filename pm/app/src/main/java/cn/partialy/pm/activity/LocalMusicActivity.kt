package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.core.view.isGone
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityLocalMusicBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.local.LocalFragmentStateAdapter
import cn.partialy.pm.ui.local.viewModels.DownloadedMusicViewModel
import cn.partialy.pm.ui.local.viewModels.LocalMusicViewModel
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.LocalSongProvider
import com.google.android.material.color.MaterialColors
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class LocalMusicActivity : BaseDownloadActivity() {
    private lateinit var binding: ActivityLocalMusicBinding
    private val localMusicViewModel by lazy { ViewModelProvider(this)[LocalMusicViewModel::class.java] }
    private val downloadedViewModel by lazy { ViewModelProvider(this)[DownloadedMusicViewModel::class.java] }
    private val downloadManager: DownloadManager = DownloadManager.getInstance(context = this)
    private val localSongs = mutableListOf<SongInfo>()
    private val downloadedSongs = mutableListOf<SongInfo>()
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var localMenuPopup: PopupWindow? = null

    @Inject
    lateinit var localSongProvider: LocalSongProvider

    private val localMusicEditLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadLocalMusic()
        }
    }

    private val importSongsLauncher = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        if (uris.isNullOrEmpty()) return@registerForActivityResult
        importSelectedSongs(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalMusicBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        applyLocalMusicInsets()
        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@LocalMusicActivity)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = ""
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.viewPager.adapter = LocalFragmentStateAdapter(this)
        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                updateTabSelection(position)
                applyCurrentSearchFilter()
            }
        })
        val initialTab = intent.getIntExtra(EXTRA_INITIAL_TAB, TAB_LOCAL).coerceIn(TAB_LOCAL, TAB_DOWNLOADED)
        binding.viewPager.setCurrentItem(initialTab, false)

        setupUIAndListener()
        loadLocalMusic()
    }

    private fun applyLocalMusicInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        binding.localMusicRoot.applySystemBarsInsets { insets ->
            binding.localMusicStatusBarSpacer.layoutParams = binding.localMusicStatusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.viewPager.updatePadding(bottom = 0)
            binding.homeMiniPlayer.root.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                bottomMargin = miniBottomBase + overlapPx + insets.bottom
            }
        }
    }

    @OptIn(UnstableApi::class)
    @SuppressLint("SetTextI18n")
    private fun setupUIAndListener() {
        binding.apply {
            localMusicViewModel.songInfos.observe(this@LocalMusicActivity) { songs ->
                if (viewPager.currentItem == TAB_LOCAL) {
                    updateSongCount(songs)
                }
            }
            downloadedViewModel.songInfos.observe(this@LocalMusicActivity) { songs ->
                if (viewPager.currentItem == TAB_DOWNLOADED) {
                    updateSongCount(songs)
                }
            }

            mineMusic.setOnClickListener { viewPager.setCurrentItem(TAB_LOCAL, true) }
            downloadMusic.setOnClickListener { viewPager.setCurrentItem(TAB_DOWNLOADED, true) }

            btnPlayAll.setOnClickListener {
                val songs = currentDisplayedSongs()
                if (songs.isNotEmpty()) {
                    lifecycleScope.launch {
                        musicController.setPlayList(songs)
                    }
                }
            }
            btnPlayAll.imageTintList = ColorStateList.valueOf(getColor(R.color.primary))

            search.setOnClickListener { toggleSearchBar() }
            localSearchCancelText.setOnClickListener { hideSearchBar() }
            localSearchInput.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    applyCurrentSearchFilter()
                }
                override fun afterTextChanged(s: Editable?) = Unit
            })

            localMoreButton.setOnClickListener { showLocalMenu() }
        }
    }

    private fun toggleSearchBar() {
        if (binding.localSearchBarLayout.isGone) {
            binding.localSearchBarLayout.visibility = View.VISIBLE
            binding.localSearchInput.requestFocus()
            showSoftKeyboard(binding.localSearchInput)
        } else {
            hideSearchBar()
        }
    }

    private fun hideSearchBar() {
        binding.localSearchBarLayout.visibility = View.GONE
        binding.localSearchInput.text?.clear()
        binding.localSearchInput.clearFocus()
        hideSoftKeyboard()
        applyCurrentSearchFilter()
    }

    private fun applyCurrentSearchFilter() {
        val keyword = binding.localSearchInput.text?.toString().orEmpty().trim()
        when (binding.viewPager.currentItem) {
            TAB_LOCAL -> localMusicViewModel.setSongInfos(filterSongs(localSongs, keyword))
            TAB_DOWNLOADED -> downloadedViewModel.setSongInfos(filterSongs(downloadedSongs, keyword))
        }
    }

    private fun filterSongs(songs: List<SongInfo>, keyword: String): List<SongInfo> {
        if (keyword.isBlank()) return songs
        return songs.filter { song ->
            song.name.contains(keyword, ignoreCase = true) ||
                song.artist.contains(keyword, ignoreCase = true)
        }
    }

    private fun currentDisplayedSongs(): List<SongInfo> =
        when (binding.viewPager.currentItem) {
            TAB_LOCAL -> localMusicViewModel.getSongInfos()
            TAB_DOWNLOADED -> downloadedViewModel.getSongInfos()
            else -> emptyList()
        }

    private fun showSoftKeyboard(view: View) {
        (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
            ?.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun hideSoftKeyboard() {
        currentFocus?.let { view ->
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
                ?.hideSoftInputFromWindow(view.windowToken, 0)
        }
    }

    private fun showLocalMenu() {
        localMenuPopup?.dismiss()
        val content = LayoutInflater.from(this).inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        addLocalMenuRow(
            container = container,
            iconRes = R.drawable.ic_scan_radio_24,
            text = getString(R.string.local_music_import_songs),
        ) {
            localMenuPopup?.dismiss()
            importSongsLauncher.launch(arrayOf("audio/*"))
        }
        addLocalMenuRow(
            container = container,
            iconRes = R.drawable.ic_scan_qrcode_24,
            text = getString(R.string.local_music_scan_songs),
        ) {
            localMenuPopup?.dismiss()
            Toast.makeText(this, R.string.local_music_scan_not_ready, Toast.LENGTH_SHORT).show()
        }
        addLocalMenuRow(
            container = container,
            iconRes = R.drawable.ic_edit_24,
            text = getString(R.string.local_music_edit_list),
        ) {
            localMenuPopup?.dismiss()
            openEditLocalMusic()
        }

        val width = (resources.displayMetrics.density * 220).toInt()
        localMenuPopup = PopupWindow(
            content,
            width,
            RecyclerView.LayoutParams.WRAP_CONTENT,
            true,
        ).apply {
            isOutsideTouchable = true
            elevation = resources.displayMetrics.density * 8f
        }
        localMenuPopup?.showAsDropDown(
            binding.localMoreButton,
            0,
            (resources.displayMetrics.density * 6).toInt(),
            Gravity.END,
        )
    }

    private fun addLocalMenuRow(
        container: LinearLayout,
        iconRes: Int,
        text: CharSequence,
        onClick: () -> Unit,
    ) {
        val row = LayoutInflater.from(this).inflate(R.layout.item_action_menu_row, container, false)
        val color = MaterialColors.getColor(
            container,
            com.google.android.material.R.attr.colorOnSurface,
            ContextCompat.getColor(this, R.color.colorOnBgNormal),
        )
        row.findViewById<ImageView>(R.id.actionMenuItemIcon).apply {
            setImageResource(iconRes)
            setColorFilter(color)
        }
        row.findViewById<TextView>(R.id.actionMenuItemText).apply {
            this.text = text
            setTextColor(color)
        }
        row.setOnClickListener { onClick() }
        container.addView(row)
    }

    private fun openEditLocalMusic() {
        localMusicEditLauncher.launch(Intent(this, LocalMusicEditActivity::class.java))
        AppActivityTransitions.applyForward(this)
    }

    private fun importSelectedSongs(uris: List<Uri>) {
        uris.forEach(::takeReadPersistablePermission)
        lifecycleScope.launch(Dispatchers.IO) {
            val result = localSongProvider.importSongs(uris)
            val songsLocal = queryLocalMusic()
            withContext(Dispatchers.Main) {
                localSongs.clear()
                localSongs.addAll(songsLocal)
                applyCurrentSearchFilter()
                Toast.makeText(
                    this@LocalMusicActivity,
                    getString(R.string.local_music_import_done, result.importedCount, result.skippedCount),
                    Toast.LENGTH_SHORT,
                ).show()
            }
        }
    }

    private fun takeReadPersistablePermission(uri: Uri) {
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun loadLocalMusic() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val songsLocal = queryLocalMusic()
                val songsDownload = queryDownloadedMusic()

                withContext(Dispatchers.Main) {
                    localSongs.clear()
                    downloadedSongs.clear()
                    localSongs.addAll(songsLocal)
                    downloadedSongs.addAll(songsDownload)
                    applyCurrentSearchFilter()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun queryDownloadedMusic(): List<SongInfo> {
        return downloadManager.getDownloadedFiles()
    }

    private fun queryLocalMusic(): List<SongInfo> {
        return localSongProvider.refreshLocalSongs()
    }

    @SuppressLint("SetTextI18n")
    private fun updateSongCount(songs: List<SongInfo>) {
        binding.apply {
            if (songs.isEmpty()) {
                songCountTextView.text =
                    if (viewPager.currentItem == TAB_LOCAL) getString(R.string.local_music_empty)
                    else getString(R.string.downloaded_music_empty)
                btnPlayAll.isClickable = false
                btnPlayAll.alpha = 0.5f
            } else {
                songCountTextView.text = getString(R.string.local_music_song_count, songs.size)
                btnPlayAll.isClickable = true
                btnPlayAll.alpha = 1.0f
            }
        }
    }

    override fun onDestroy() {
        localMenuPopup?.dismiss()
        localMenuPopup = null
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    private fun updateTabSelection(position: Int) {
        binding.apply {
            when (position) {
                TAB_LOCAL -> {
                    mineMusic.alpha = 1.0f
                    mineMusic.setTextColor(getColor(R.color.primary))
                    downloadMusic.alpha = 0.5f
                    downloadMusic.setTextColor(getColor(R.color.text_secondary))
                }
                TAB_DOWNLOADED -> {
                    downloadMusic.alpha = 1.0f
                    downloadMusic.setTextColor(getColor(R.color.primary))
                    mineMusic.alpha = 0.5f
                    mineMusic.setTextColor(getColor(R.color.text_secondary))
                }
            }
        }
    }

    companion object {
        const val EXTRA_INITIAL_TAB = "cn.partialy.pm.extra.LOCAL_MUSIC_TAB"
        const val TAB_LOCAL = 0
        const val TAB_DOWNLOADED = 1

        fun start(context: Context, initialTab: Int = TAB_LOCAL) {
            val intent = Intent(context, LocalMusicActivity::class.java).apply {
                putExtra(EXTRA_INITIAL_TAB, initialTab.coerceIn(TAB_LOCAL, TAB_DOWNLOADED))
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
