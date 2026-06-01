package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.content.ContentUris
import android.provider.MediaStore
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.core.view.updatePadding
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.util.UnstableApi
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityLocalMusicBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.local.LocalFragmentStateAdapter
import cn.partialy.pm.ui.local.viewModels.DownloadedMusicViewModel
import cn.partialy.pm.ui.local.viewModels.LocalMusicViewModel
import cn.partialy.pm.utils.AudioEmbeddedArtReader
import cn.partialy.pm.utils.DownloadManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@AndroidEntryPoint
class LocalMusicActivity : BaseDownloadActivity() {
    private lateinit var binding: ActivityLocalMusicBinding
    private val localMusicViewModel by lazy { ViewModelProvider(this)[LocalMusicViewModel::class.java] }
    private val downloadedViewModel by lazy { ViewModelProvider(this)[DownloadedMusicViewModel::class.java] }
    private val downloadManager : DownloadManager = DownloadManager.getInstance(context = this)
    private val PERMISSION_REQUEST_CODE = 123
    private val localSongs = mutableListOf<SongInfo>()
    private val downloadedSongs = mutableListOf<SongInfo>()

    private val localMusicEditLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadLocalMusic()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // 先创建绑定
        binding = ActivityLocalMusicBinding.inflate(layoutInflater)
        // 在调用 super.onCreate 之前设置 contentView，这样父类就能找到根视图
        setContentView(binding.root)
        // 调用父类的 onCreate，它会添加悬浮按钮
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        applyLocalMusicInsets()

        // 设置工具栏
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = ""

        // 设置返回按钮点击事件
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }

        // 设置viewPager2
        binding.viewPager.adapter = LocalFragmentStateAdapter(this)
        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                updateTabSelection(position)
                updateEditButtonVisibility()
                when (position) {
                    0 -> updateSongCount(localMusicViewModel.getSongInfos())
                    1 -> updateSongCount(downloadedViewModel.getSongInfos())
                }
            }
        })
        val initialTab = intent.getIntExtra(EXTRA_INITIAL_TAB, TAB_LOCAL).coerceIn(TAB_LOCAL, TAB_DOWNLOADED)
        binding.viewPager.setCurrentItem(initialTab, false)
        updateEditButtonVisibility()

        // 设置ui
        setupUIAndListener()

        // 检查权限
//        checkPermissionAndLoadMusic()
        loadLocalMusic()
    }

    private fun applyLocalMusicInsets() {
        binding.localMusicRoot.applySystemBarsInsets { insets ->
            val lp = binding.localMusicStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.localMusicStatusBarSpacer.layoutParams = lp
            binding.viewPager.updatePadding(bottom = insets.bottom)
        }
    }

    @OptIn(UnstableApi::class)
    @SuppressLint("SetTextI18n")
    private fun setupUIAndListener(){
        binding.apply {
            // 观察本地音乐数量变化
            localMusicViewModel.songInfos.observe(this@LocalMusicActivity) { songs ->
                if (viewPager.currentItem == 0) {
                    updateSongCount(songs)
                }
            }

            // 观察下载音乐数量变化
            downloadedViewModel.songInfos.observe(this@LocalMusicActivity) { songs ->
                if (viewPager.currentItem == 1) {
                    updateSongCount(songs)
                }
            }

            // 监听器
            mineMusic.setOnClickListener {
                viewPager.setCurrentItem(0, true)
            }
            downloadMusic.setOnClickListener {
                viewPager.setCurrentItem(1, true)
            }

            // 播放全部按钮点击事件
            btnPlayAll.setOnClickListener {
                val songs = when (viewPager.currentItem) {
                    0 -> localMusicViewModel.getSongInfos()
                    1 -> downloadedViewModel.getSongInfos()
                    else -> emptyList()
                }
                if (songs.isNotEmpty()) {
                    lifecycleScope.launch {
                        musicController.setPlayList(songs)
                    }
                }
            }
            btnPlayAll.imageTintList = ColorStateList.valueOf(getColor(R.color.primary))

            btnEditLocal.setOnClickListener {
                localMusicEditLauncher.launch(Intent(this@LocalMusicActivity, LocalMusicEditActivity::class.java))
                AppActivityTransitions.applyForward(this@LocalMusicActivity)
            }
        }
    }

    private fun updateEditButtonVisibility() {
        binding.btnEditLocal.visibility =
            if (binding.viewPager.currentItem == TAB_LOCAL) View.VISIBLE else View.GONE
    }

    // 更新歌曲数量显示
    @SuppressLint("SetTextI18n")
    private fun updateSongCount(songs: List<SongInfo>) {
        binding.apply {
            if (songs.isEmpty()) {
                songCountTextView.text = if (viewPager.currentItem == 0) "没有本地歌曲" else "没有下载的歌曲"
                btnPlayAll.isClickable = false
                btnPlayAll.alpha = 0.5f
            } else {
                songCountTextView.text = "共${songs.size}首歌曲"
                btnPlayAll.isClickable = true
                btnPlayAll.alpha = 1.0f
            }
        }
    }

//    // 检查权限
//    private fun checkPermissionAndLoadMusic() {
//        if (ContextCompat.checkSelfPermission(
//                this,
//                Manifest.permission.READ_EXTERNAL_STORAGE
//            ) != PackageManager.PERMISSION_GRANTED
//        ) {
//            ActivityCompat.requestPermissions(
//                this,
//                arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE),
//                PERMISSION_REQUEST_CODE
//            )
//        } else {
//            loadLocalMusic()
//        }
//    }

    // 加载本地歌曲和下载的歌曲
    private fun loadLocalMusic() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val songs_local = queryLocalMusic()
                val songs_download = queryDownloadedMusic()

                withContext(Dispatchers.Main) {
                    localSongs.clear()
                    downloadedSongs.clear()
                    localSongs.addAll(songs_local)
                    downloadedSongs.addAll(songs_download)
                    updateUI()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    //获取已下载的歌曲
    private fun queryDownloadedMusic(): List<SongInfo> {
        return downloadManager.getDownloadedFiles()
    }

    // 搜索本地歌曲
    private fun queryLocalMusic(): List<SongInfo> {
        val songs = mutableListOf<SongInfo>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DURATION
        )

        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"

        contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            null,
            sortOrder
        )?.use { cursor ->
            val appCtx = applicationContext
            while (cursor.moveToNext()) {
                val mediaId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID))
                val title = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE))
                val artist = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST))
                val path = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA))
                val duration = cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION))

                val contentUri = ContentUris.withAppendedId(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    mediaId,
                )
                var coverBytes = AudioEmbeddedArtReader.readEmbeddedCoverBytes(appCtx, contentUri)
                if (coverBytes == null) {
                    val f = java.io.File(path)
                    if (f.exists()) {
                        coverBytes = AudioEmbeddedArtReader.readEmbeddedCoverBytes(appCtx, f)
                    }
                }

                songs.add(
                    SongInfo(
                        name = title,
                        artist = artist,
                        id = path,
                        coverUrl = "",
                        embeddedCoverArt = coverBytes,
                        duration = duration,
                        type = SongType.LOCAL
                    )
                )
            }
        }
        return songs
    }

    // 更新列表
    private fun updateUI() {
        localMusicViewModel.setSongInfos(localSongs)
        downloadedViewModel.setSongInfos(downloadedSongs)
        setupUIAndListener() // 更新UI后重新设置界面
    }

//    override fun onRequestPermissionsResult(
//        requestCode: Int,
//        permissions: Array<out String>,
//        grantResults: IntArray
//    ) {
//        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
//        if (requestCode == PERMISSION_REQUEST_CODE) {
//            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
//                loadLocalMusic()
//            } else {
//                Toast.makeText(this, "需要存储权限才能访问本地音乐", Toast.LENGTH_SHORT).show()
//                finish()
//            }
//        }
//    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    private fun updateTabSelection(position: Int) {
        binding.apply {
            when (position) {
                0 -> {
                    mineMusic.alpha = 1.0f
                    mineMusic.setTextColor(getColor(R.color.primary))
                    downloadMusic.alpha = 0.5f
                    downloadMusic.setTextColor(getColor(R.color.text_secondary))
                }
                1 -> {
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

        /** 与 [PlaylistDetailActivity.start] 一致的进入动画。 */
        fun start(context: Context, initialTab: Int = TAB_LOCAL) {
            val intent = Intent(context, LocalMusicActivity::class.java).apply {
                putExtra(EXTRA_INITIAL_TAB, initialTab.coerceIn(TAB_LOCAL, TAB_DOWNLOADED))
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
